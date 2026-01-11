const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionResponseFlags } = require('discord.js');
const statisticsManager = require('../utils/statisticsManager');
const dbManager = require('../utils/dbManager');

/**
 * Creates a movie embed with all relevant information.
 * @param {object} movie - The movie object.
 * @param {string} searchTerm - The original search term.
 * @returns {EmbedBuilder}
 */
function createMovieEmbed(movie, searchTerm) {
    const embed = new EmbedBuilder()
        .setColor(0x00D4AA)
        .setTitle(movie.name);
    
    // Add TMDB details if available
    if (movie.tmdbDetails) {
        if (movie.tmdbDetails.overview) {
            embed.setDescription(movie.tmdbDetails.overview);
        }
        
        if (movie.tmdbDetails.poster_path) {
            embed.setThumbnail(`https://image.tmdb.org/t/p/w500${movie.tmdbDetails.poster_path}`);
        } else if (movie.customPosterUrl) {
            embed.setThumbnail(movie.customPosterUrl);
        }
        
        // Add release date if available
        if (movie.tmdbDetails.release_date) {
            const releaseDate = new Date(movie.tmdbDetails.release_date);
            embed.addFields({ name: '📅 Release Date', value: releaseDate.toLocaleDateString(), inline: true });
        }
        
        // Add rating if available
        if (movie.tmdbDetails.vote_average) {
            embed.addFields({ name: '⭐ Rating', value: `${movie.tmdbDetails.vote_average}/10`, inline: true });
        }
        
        // Add genres if available
        if (movie.tmdbDetails.genres && movie.tmdbDetails.genres.length > 0) {
            const genres = movie.tmdbDetails.genres.map(g => g.name).join(', ');
            embed.addFields({ name: '🎭 Genres', value: genres, inline: true });
        }
    }
    
    // Add languages
    if (movie.languages && movie.languages.length > 0) {
        embed.addFields({ name: '🌐 Languages', value: movie.languages.join(', '), inline: true });
    }
    
    // Add watch links info
    if (movie.watchLinks && Object.keys(movie.watchLinks).length > 0) {
        embed.addFields({ name: '🎬 Available Qualities', value: Object.keys(movie.watchLinks).join(', '), inline: true });
    }
    
    // Add screenshots if available
    if (movie.screenshotLinks && movie.screenshotLinks.length > 0) {
        embed.setImage(movie.screenshotLinks[0]);
    }
    
    embed.setFooter({ text: `Search: "${searchTerm}" • Stream Sage` });
    embed.setTimestamp();
    
    return embed;
}

/**
 * Creates an action row with watch link buttons.
 * @param {object} movie - The movie object.
 * @returns {ActionRowBuilder|null}
 */
function createWatchButtons(movie) {
    if (!movie.watchLinks || Object.keys(movie.watchLinks).length === 0) return null;

    const watchButtons = Object.entries(movie.watchLinks).map(([quality, url]) =>
        new ButtonBuilder()
        .setLabel(quality)
        .setStyle(ButtonStyle.Link)
        .setURL(url)
    );
    
    // A single action row can hold up to 5 buttons.
    if (watchButtons.length > 5) {
        watchButtons.splice(5);
    }

    return new ActionRowBuilder().addComponents(...watchButtons);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getmovie')
        .setDescription('Gets movie/webseries details and watch link from the database.')
        .addStringOption(option =>
            option.setName('name')
            .setDescription('The name of the movie or webseries.')
            .setRequired(true)),
    async execute(interaction) {
        // Use flags instead of ephemeral property
        await interaction.deferReply({ flags: [] });
        const searchTerm = interaction.options.getString('name');
        const searchTermLower = searchTerm.toLowerCase();

        // First, try an exact match.
        let movie = dbManager.getMovie(searchTermLower);

        // If no exact match, try a fuzzy search and take the first result.
        if (!movie) {
            const movies = dbManager.getMovies();
            const normalizedSearch = searchTermLower.trim();
            const candidates = movies.filter(m => {
                const nameMatch = m.name && m.name.toLowerCase().includes(normalizedSearch);
                const aliasMatch = m.aliases && Array.isArray(m.aliases) && m.aliases.some(a => a.toLowerCase().includes(normalizedSearch));
                const tmdbTitle = m.tmdbDetails && m.tmdbDetails.title ? m.tmdbDetails.title.toLowerCase() : '';
                const tmdbMatch = tmdbTitle && tmdbTitle.includes(normalizedSearch) && tmdbTitle !== (m.name || '').toLowerCase();
                return nameMatch || aliasMatch || tmdbMatch;
            });
            candidates.sort((a, b) => {
                const aName = (a.name || '').toLowerCase();
                const bName = (b.name || '').toLowerCase();
                const aExact = aName === normalizedSearch;
                const bExact = bName === normalizedSearch;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                const aStarts = aName.startsWith(normalizedSearch);
                const bStarts = bName.startsWith(normalizedSearch);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                const aIdx = aName.indexOf(normalizedSearch);
                const bIdx = bName.indexOf(normalizedSearch);
                if (aIdx !== bIdx) return aIdx - bIdx;
                return aName.length - bName.length;
            });
            if (candidates.length > 0) {
                movie = candidates[0];
            }
        }
        
        // If a movie is found (either exact or fuzzy)
        if (movie) {
            try {
                // Track movie view for statistics
                statisticsManager.trackMovieView(movie.name);
                
                const movieEmbed = createMovieEmbed(movie, searchTerm);
                const watchButtons = createWatchButtons(movie);
                const components = watchButtons ? [watchButtons] : [];

                await interaction.editReply({ embeds: [movieEmbed], components });
            } catch (error) {
                console.error("Error creating movie display:", error);
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Display Error').setDescription(`Found "${movie.name}" but failed to display it properly.`)],
                    flags: [InteractionResponseFlags.Ephemeral]
                });
            }
            return;
        }

        // If no movies are found, automatically create a request
        try {
            const { v4: uuidv4 } = require('uuid');
            const config = require('../config/config.json');
            
            // Create new request (using same structure as requestmovie)
            const newRequest = {
                id: uuidv4(),
                movieName: searchTerm,
                requestedBy: interaction.user.id,
                requestedAt: new Date().toISOString(),
                guildId: interaction.guild?.id || 'DM',
                guildName: interaction.guild?.name || 'Direct Message',
                status: 'pending'
            };

            // Add to database
            dbManager.addRequest(newRequest);
            statisticsManager.trackMovieRequest(searchTerm, interaction.user.id);

            // Show user confirmation
            const notFoundEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('❌ Movie Not Found')
                .setDescription(`No movies found matching **${searchTerm}**.\n\n✅ **Request automatically created!** Your request has been sent to the admin team.`);

            await interaction.editReply({ embeds: [notFoundEmbed] });

            // --- Send to Global Request Channel ---
            const globalRequestChannelId = config.globalRequestChannelId;
            if (!globalRequestChannelId) {
                const warningEmbed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle('⚠️ Warning')
                    .setDescription('No global request channel is configured. Your request has been saved but administrators might not be notified.');
                
                await interaction.followUp({ 
                    embeds: [warningEmbed], 
                    flags: [InteractionResponseFlags.Ephemeral]
                });
                return;
            }
            
            try {
                const globalRequestChannel = await interaction.client.channels.fetch(globalRequestChannelId);
                if (globalRequestChannel && globalRequestChannel.isTextBased()) {
                    const requestEmbed = new EmbedBuilder()
                        .setColor(0x1E90FF)
                        .setTitle('🔔 New Movie Request')
                        .setDescription(`**Requested Movie:** ${newRequest.movieName}`)
                        .addFields(
                            { name: 'Requested By', value: `<@${newRequest.requestedBy}>`, inline: true },
                            { name: 'Server', value: newRequest.guildName, inline: true },
                            { name: 'Requested At', value: new Date(newRequest.requestedAt).toLocaleString(), inline: true }
                        )
                        .setFooter({ text: `Request ID: ${newRequest.id} | Requested via /getmovie command` })
                        .setTimestamp();
                    
                    // Create reject button for admins
                    const actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`reject_${newRequest.id}`)
                                .setLabel('❌ Reject Request')
                                .setStyle(ButtonStyle.Danger)
                        );
                    
                    await globalRequestChannel.send({ embeds: [requestEmbed], components: [actionRow] });
                } else {
                    const warningEmbed = new EmbedBuilder()
                        .setColor(0xFFAA00)
                        .setTitle('⚠️ Warning')
                        .setDescription(`The configured global request channel (${globalRequestChannelId}) is invalid or inaccessible. Your request has been saved but administrators might not be notified.`);
                    
                    await interaction.followUp({ 
                        embeds: [warningEmbed], 
                        flags: [InteractionResponseFlags.Ephemeral]
                    });
                }
            } catch (channelError) {
                const warningEmbed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle('⚠️ Warning')
                    .setDescription('An error occurred while sending the request to the global channel. Your request has been saved but administrators might not be notified.');
                
                await interaction.followUp({ 
                    embeds: [warningEmbed], 
                    flags: [InteractionResponseFlags.Ephemeral]
                });
            }
            // --- End Send to Global Request Channel ---
        } catch (error) {
            console.error("Error creating automatic request:", error);
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Error').setDescription('Failed to create request. Please try again or contact an admin.')],
                flags: [InteractionResponseFlags.Ephemeral]
            });
        }
    },
};