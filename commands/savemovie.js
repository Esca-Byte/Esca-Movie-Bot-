const config = require('../config/config.json');
const { SlashCommandBuilder, PermissionsBitField, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const tmdbApi = require('../utils/tmdbApi');
const dbManager = require('../utils/dbManager');
const embedGenerator = require('../utils/embedGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('savemovie')
        .setDescription('Saves a movie/webseries and auto-shortens 1080p links with GPLinks. (Admin Only)')
        .addStringOption(option => option.setName('name').setDescription('The name of the movie/webseries or TMDB ID (e.g., 12345).').setRequired(true))
        .addStringOption(option => option.setName('watch_links').setDescription('Format: 1080p:link1,4k:link2,...').setRequired(true))
        .addStringOption(option => option.setName('languages').setDescription('Comma-separated languages: hindi,english,...').setRequired(true))
        .addStringOption(option => option.setName('screenshotlinks').setDescription('Comma-separated links to screenshots (optional).').setRequired(false))
        .addStringOption(option => option.setName('poster_url').setDescription('Direct URL to poster if TMDB fails (optional).').setRequired(false))
        .addStringOption(option => option.setName('media_type').setDescription('Media type: movie or tv (optional, helps with TMDB ID lookup).').setRequired(false).addChoices({ name: 'Movie', value: 'movie' }, { name: 'TV Show', value: 'tv' }))
        .addBooleanOption(option => option.setName('force_save').setDescription('Force save if TMDB API fails (default: false).').setRequired(false))
        .addIntegerOption(option => option.setName('retry_attempts').setDescription('TMDB API retry attempts (1-5, default: 3).').setRequired(false).setMinValue(1).setMaxValue(5))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        if (!config.adminUserIds.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name');
        const rawWatchLinks = interaction.options.getString('watch_links');
        const rawLanguages = interaction.options.getString('languages');
        const screenshotLinks = interaction.options.getString('screenshotlinks')?.split(',').map(link => link.trim()).filter(Boolean) || [];
        const posterUrl = interaction.options.getString('poster_url');
        const mediaType = interaction.options.getString('media_type');
        const forceSave = interaction.options.getBoolean('force_save') || false;
        const retryAttempts = interaction.options.getInteger('retry_attempts') || 3;

        // --- All validation and parsing logic remains the same ---
        // (Your existing validation for languages and links was good)
        const languages = [...new Set(rawLanguages.split(',').map(lang => lang.trim().toLowerCase()).filter(Boolean))];
        if (languages.length === 0) return interaction.editReply('You must provide at least one valid language.');

        const watchLinks = {};
        const original1080pLinks = [];
        const linkParts = rawWatchLinks.split(',').filter(p => p.trim() !== '');
        if (linkParts.length === 0) return interaction.editReply('You must provide at least one watch link.');
        for (const part of linkParts) {
            const split = part.split(/:(.+)/); // Split only on the first colon
            if (split.length < 2) return interaction.editReply(`Invalid format: "${part}". Use "quality:link".`);
            const quality = split[0].trim();
            const link = split[1].trim();
            watchLinks[quality] = link;
            if (quality.toLowerCase().includes('1080p') && !quality.toLowerCase().includes('4k')) {
                original1080pLinks.push({ quality, link });
            }
        }
        // --- End of validation ---

        await interaction.editReply('🔗 Processing and shortening 1080p links with GPLinks...');
        let shorteningResults = { successful: 0, failed: 0, skipped: 0 };
        
        for (const quality in watchLinks) {
            const isEligibleForShortening = quality.toLowerCase().includes('1080p') && !quality.toLowerCase().includes('4k');
            
            if (isEligibleForShortening) {
                console.log(`[DEBUG] Shortening ${quality} link: ${watchLinks[quality]}`);
                const originalUrl = watchLinks[quality];
                const shortenedUrl = await shortenUrl(originalUrl);
                
                if (shortenedUrl !== originalUrl) {
                    watchLinks[quality] = shortenedUrl;
                    shorteningResults.successful++;
                    console.log(`[DEBUG] Successfully shortened ${quality}: ${originalUrl} -> ${shortenedUrl}`);
                } else {
                    shorteningResults.failed++;
                    console.log(`[DEBUG] Failed to shorten ${quality}: ${originalUrl}`);
                }
            } else {
                shorteningResults.skipped++;
                console.log(`[DEBUG] Skipped shortening for ${quality} (not 1080p or is 4K)`);
            }
        }
        
        console.log(`[DEBUG] URL shortening results:`, shorteningResults);

        try {
            if (dbManager.getMovie(name)) {
                return interaction.editReply(`"${name}" already exists. Use \`/updatemovie\`.`);
            }

            // Check if name is a TMDB ID or regular text
            const isTmdbId = /^\d+$/.test(name.trim());
            const searchMessage = isTmdbId ? `🔍 Looking up TMDB ID: ${name}${mediaType ? ` (${mediaType})` : ''}...` : '🔍 Searching TMDB...';
            
            await interaction.editReply(searchMessage);
            let tmdbDetails = null;
            let tmdbError = null;
            for (let i = 0; i < retryAttempts; i++) {
                tmdbDetails = await tmdbApi.searchAndGetDetails(name, mediaType);
                if (tmdbDetails) {
                    tmdbError = null;
                    break;
                }
                tmdbError = new Error('No results found on TMDB.');
            }

            if (!tmdbDetails && !forceSave) {
                return interaction.editReply(`⚠️ **TMDB API Error:** ${tmdbError.message}. Use \`force_save:true\` to save anyway.`);
            }

            // Create the exact data structure as shown in movies.json
            const movieId = tmdbDetails ? tmdbDetails.id.toString() : `custom_${Date.now()}`;
            // Use TMDB title/name if available, otherwise use the provided name
            const movieName = tmdbDetails?.title || tmdbDetails?.name || name;

            // Store original unshortened 1080p links for admin reference
            try {
                if (original1080pLinks.length > 0) {
                    for (const item of original1080pLinks) {
                        dbManager.addUnshortenedLink({ name: movieName, link: item.link });
                    }
                }
            } catch (e) {
                console.warn('[WARNING] Failed to persist unshortened links:', e.message);
            }

            // Create tmdbDetails in the exact format from your movies.json
            const formattedTmdbDetails = tmdbDetails ? {
                tmdb_id: tmdbDetails.id,
                overview: tmdbDetails.overview || 'No description available.',
                release_date: tmdbDetails.release_date || tmdbDetails.first_air_date || null,
                poster_path: tmdbDetails.poster_path,
                backdrop_path: tmdbDetails.backdrop_path,
                genres: tmdbDetails.genres || [],
                vote_average: tmdbDetails.vote_average,
                media_type: tmdbDetails.media_type || 'unknown'
            } : {
                tmdb_id: null,
                overview: 'No description available.',
                release_date: null,
                poster_path: null,
                backdrop_path: null,
                genres: [],
                vote_average: null,
                media_type: 'unknown'
            };

            const newMovie = {
                id: movieId,
                name: movieName,
                aliases: [],
                languages: languages,
                watchLinks: watchLinks,
                screenshotLinks: screenshotLinks,
                customPosterUrl: posterUrl,
                tmdbDetails: formattedTmdbDetails,
                saveMetadata: {
                    savedAt: new Date().toISOString(),
                    tmdbStatus: tmdbDetails ? 'success' : 'failed',
                    tmdbError: tmdbError ? tmdbError.message : null,
                    forceSaved: !tmdbDetails && forceSave
                }
            };

            dbManager.addMovie(newMovie);
            
            const successEmbed = embedGenerator.createMovieEmbed(newMovie, true)
                 .setTitle(`✅ Successfully Saved: ${newMovie.name}`);

            await interaction.editReply({ embeds: [successEmbed], ephemeral: true });

            await findAndNotifyRequesters(interaction.client, newMovie);
            await sendGlobalMovieNotification(interaction.client, newMovie);

        } catch (error) {
            console.error('Error in /savemovie command:', error);
            await interaction.editReply('❌ An unexpected error occurred. Please check the bot logs.');
        }
    },
};

// Helper function for URL shortening using GPLinks API
async function shortenUrl(url) {
    try {
        console.log(`[DEBUG] Attempting to shorten URL with GPLinks: ${url}`);
        
        const axios = require('axios');
        const apiToken = '56b7be9cebf2ff9b2629744a16cef4898189dcb7';
        
        // GPLinks API endpoint
        const response = await axios.get(`https://api.gplinks.com/api?api=${apiToken}&url=${encodeURIComponent(url)}`, {
            timeout: 10000 // 10 second timeout
        });
        
        if (response.data && response.data.status === 'success' && response.data.shortenedUrl) {
            const shortenedUrl = response.data.shortenedUrl;
            console.log(`[DEBUG] Successfully shortened URL with GPLinks: ${url} -> ${shortenedUrl}`);
            return shortenedUrl;
        } else {
            console.warn(`[WARNING] GPLinks API returned error for ${url}:`, response.data);
            return url; // Return original URL if shortening fails
        }
        
    } catch (error) {
        console.error(`[ERROR] Failed to shorten URL ${url} with GPLinks:`, error.message);
        
        // If GPLinks fails, return the original URL
        console.log(`[DEBUG] GPLinks shortening failed, returning original URL: ${url}`);
        return url;
    }
}

// Helper function to create download buttons for movie qualities
function createDownloadButtons(movie) {
    if (!movie.watchLinks || Object.keys(movie.watchLinks).length === 0) {
        return null;
    }
    
    const buttons = [];
    
    // Define quality priority (highest quality first)
    const qualityPriority = ['4k', '2160p', '1440p', '1080p', '720p', '480p', '360p'];
    
    // Sort qualities by priority
    const sortedQualities = Object.keys(movie.watchLinks).sort((a, b) => {
        const aIndex = qualityPriority.findIndex(q => a.toLowerCase().includes(q));
        const bIndex = qualityPriority.findIndex(q => b.toLowerCase().includes(q));
        
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        
        return aIndex - bIndex;
    });
    
    // Create buttons for up to 5 qualities (Discord limit)
    for (let i = 0; i < Math.min(sortedQualities.length, 5); i++) {
        const quality = sortedQualities[i];
        const link = movie.watchLinks[quality];
        
        // Create URL button that directly opens the download link
        buttons.push(
            new ButtonBuilder()
                .setURL(link)
                .setLabel(`📋 ${quality.toUpperCase()}`)
                .setStyle(ButtonStyle.Link)
        );
    }
    
    if (buttons.length === 0) {
        return null;
    }
    
    return new ActionRowBuilder().addComponents(buttons);
}

// Helper function to find and notify requesters
async function findAndNotifyRequesters(client, movie) {
    try {
        console.log(`Checking for requesters for movie: ${movie.name}`);
        
        // Get all pending requests for this movie
        const requests = dbManager.getRequests();
        const movieRequests = requests.filter(request => 
            request.status === 'pending' && 
            request.movieName.toLowerCase().includes(movie.name.toLowerCase())
        );
        
        if (movieRequests.length === 0) {
            console.log(`No pending requests found for: ${movie.name}`);
            return;
        }
        
        console.log(`Found ${movieRequests.length} pending requests for: ${movie.name}`);
        
        // Notify each requester
        for (const request of movieRequests) {
            try {
                const user = await client.users.fetch(request.requestedBy);
                if (user) {
                    const requestEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🎉 Your Requested Movie is Now Available!')
                        .setDescription(`**${movie.name}** has been added to the database!`)
                        .addFields(
                            { name: 'Your Request', value: request.movieName, inline: true },
                            { name: 'Status', value: '✅ Fulfilled', inline: true }
                        )
                        .setTimestamp();
                    
                    if (movie.tmdbDetails?.poster_path) {
                        requestEmbed.setThumbnail(`https://image.tmdb.org/t/p/w500${movie.tmdbDetails.poster_path}`);
                    }
                    
                    // Create download buttons for the requester
                    const downloadButtons = createDownloadButtons(movie);
                    const messageOptions = { embeds: [requestEmbed] };
                    if (downloadButtons) {
                        messageOptions.components = [downloadButtons];
                    }
                    
                    await user.send(messageOptions);
                    console.log(`✅ Notified requester: ${user.tag}`);
                    
                    // Update request status to fulfilled
                    dbManager.updateRequestStatus(request.id, 'fulfilled', {
                        fulfilledAt: new Date().toISOString(),
                        fulfilledWith: movie.name
                    });
                }
            } catch (error) {
                console.error(`Failed to notify requester ${request.requestedBy}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Error notifying requesters:', error);
    }
}

// Helper function to send global movie notification
async function sendGlobalMovieNotification(client, movie) {
    try {
        console.log(`Sending global notifications for new movie: ${movie.name}`);
        
        // Get all guild settings
        const settings = dbManager.getSettings();
        if (!settings || !settings.guildSettings) {
            console.log('No guild settings found for notifications');
            return;
        }
        
        let notificationCount = 0;
        let errorCount = 0;
        
        // Send notification to each guild's movie channel
        for (const [guildId, guildSettings] of Object.entries(settings.guildSettings)) {
            if (!guildSettings.movieChannelId) {
                console.log(`No movie channel configured for guild ${guildId}`);
                continue;
            }
            
            try {
                // Get the guild
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    console.warn(`Guild ${guildId} not found in cache, skipping...`);
                    errorCount++;
                    continue;
                }
                
                // Get the movie channel
                const channel = guild.channels.cache.get(guildSettings.movieChannelId);
                if (!channel) {
                    console.warn(`Movie channel ${guildSettings.movieChannelId} not found in guild ${guild.name}`);
                    errorCount++;
                    continue;
                }
                
                // Check if channel is text-based
                if (!channel.isTextBased()) {
                    console.warn(`Channel ${channel.name} in guild ${guild.name} is not text-based`);
                    errorCount++;
                    continue;
                }
                
                // Check bot permissions
                const permissions = channel.permissionsFor(guild.members.me);
                if (!permissions || !permissions.has('SendMessages')) {
                    console.warn(`Bot lacks SendMessages permission in channel ${channel.name} in guild ${guild.name}`);
                    errorCount++;
                    continue;
                }
                
                // Create and send the movie announcement embed
                const movieEmbed = embedGenerator.createMovieEmbed(movie, true)
                    .setTitle(`🎬 New Movie Added: ${movie.name}`)
                    .setColor(0x00FF00)
                    .setFooter({ text: `Added to ${guild.name} • Powered by Esca` });
                
                // Create download buttons for available qualities
                const downloadButtons = createDownloadButtons(movie);
                
                const messageOptions = { embeds: [movieEmbed] };
                if (downloadButtons) {
                    messageOptions.components = [downloadButtons];
                }
                
                await channel.send(messageOptions);
                console.log(`✅ Sent movie notification to ${guild.name} (#${channel.name})`);
                notificationCount++;
                
            } catch (error) {
                console.error(`Failed to send notification to guild ${guildId}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`Movie notifications sent: ${notificationCount} successful, ${errorCount} failed`);
        
    } catch (error) {
        console.error('Error sending global movie notifications:', error);
    }
}
