const dbManager = require('../utils/dbManager');
const { EmbedBuilder } = require('discord.js');
const permissionChecker = require('./permissionChecker');

/**
 * Get a random movie recommendation for the scheduled message
 * @returns {Object|null} Random movie or null if none available
 */
async function getRandomMovieRecommendation() {
    try {
        const movies = dbManager.getMovies();
        if (movies.length === 0) return null;
        
        // Filter movies with TMDB details and good ratings
        const goodMovies = movies.filter(movie => 
            movie.tmdbDetails?.vote_average >= 7.0 && 
            movie.tmdbDetails?.overview
        );
        
        if (goodMovies.length === 0) return null;
        
        // Get a random movie
        const randomIndex = Math.floor(Math.random() * goodMovies.length);
        return goodMovies[randomIndex];
    } catch (error) {
        console.error('Error getting random movie:', error);
        return null;
    }
}

/**
 * Create a professional embedded message with variety
 * @returns {EmbedBuilder} The embedded message
 */
function createScheduledEmbed() {
    // Get a random movie for recommendation
    const randomMovie = null;

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🎬 Stream Sage')
        .setDescription('**Your ultimate destination for high-quality movie downloads!**\n\n🌐 **Visit our website:** https://stream-sage-2-0.onrender.com/')
        .addFields(
            {
                name: '🎥 Download Options',
                value: '• **1080p Links**: GPLinks shortened (supports our service)\n• **4K Links**: Direct download links',
                inline: false
            },
            {
                name: '🛡️ Pro Tips',
                value: '• Use **Brave Browser** for ad-free experience\n• **Ad blockers** recommended for 1080p links',
                inline: false
            },
            {
                name: '📊 Quick Stats',
                value: `• **Multiple languages** supported\n• **Regular updates** with new releases`,
                inline: false
            }
        )
        .setFooter({ 
            text: '💫 Every click helps keep this service free! Use /help for all commands.' 
        })
        .setTimestamp();

    // Add movie recommendation if available
    if (randomMovie) {
        const movieYear = randomMovie.tmdbDetails?.release_date ? 
            new Date(randomMovie.tmdbDetails.release_date).getFullYear() : 'Unknown';
        const rating = randomMovie.tmdbDetails?.vote_average ? 
            `${randomMovie.tmdbDetails.vote_average}/10` : 'N/A';
        
        embed.addFields({
            name: '⭐ Featured Movie',
            value: `**${randomMovie.name}** (${movieYear})\n⭐ ${rating} • \`#${randomMovie.id}\`\n\n*Use \`/getmovie ${randomMovie.name}\` for details*`,
            inline: false
        });
    }

    return embed;
}

/**
 * Create an alternative scheduled message (for variety)
 * @returns {EmbedBuilder} Alternative embedded message
 */
function createAlternativeScheduledEmbed() {
    const movies = dbManager.getMovies();
    const recentMovies = movies.filter(movie => {
        if (!movie.tmdbDetails?.release_date) return false;
        const releaseYear = new Date(movie.tmdbDetails.release_date).getFullYear();
        return releaseYear >= new Date().getFullYear() - 2; // Last 2 years
    });

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🎭 Stream Sage Collection Update')
        .setDescription('**Your movie library is constantly growing!**\n\nDiscover new releases and hidden gems from our extensive collection.\n\n🌐 **Visit our website:** https://stream-sage-2-0.onrender.com/')
        .addFields(
            {
                name: '🔍 Quick Commands',
                value: '• `/randommovie` - Get a random recommendation\n• `/listmovies` - Browse all movies\n• `/searchmovie` - Find specific movies',
                inline: true
            },
            {
                name: '💎 Premium Features',
                value: '• **4K Quality** downloads\n• **Multiple sources** per movie\n• **Advanced filtering** options',
                inline: false
            }
        )
        .setFooter({ 
            text: '🎬 New movies added regularly! Check back often for updates.' 
        })
        .setTimestamp();

    return embed;
}

/**
 * Initialize the scheduled message system
 * @param {Client} client - Discord client instance
 */
async function initScheduledMessages(client) {
    console.log('Initializing scheduled message system...');
    
    // Send the first message immediately when bot starts
    console.log('Sending initial scheduled message...');
    await sendScheduledMessage(client);
    
    // Set up interval to send message every 6 hours (6 * 60 * 60 * 1000 milliseconds)
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    
    setInterval(async () => {
        console.log('Running scheduled message task (6-hour interval)...');
        await sendScheduledMessage(client);
    }, SIX_HOURS);

    console.log('✅ Scheduled message system initialized - messages will be sent every 6 hours starting now');
}

/**
 * Send the scheduled message to all configured movie channels
 * @param {Client} client - Discord client instance
 */
async function sendScheduledMessage(client) {
    try {
        // Get all guild settings from the database
        // Since dbManager.getAllGuildSettings() doesn't exist, we'll use a workaround
        const settings = dbManager.getSettings();
        const allGuildSettings = [];
        
        // Convert the settings format to an array of guild settings
        if (settings && settings.guildSettings) {
            for (const [guildId, guildData] of Object.entries(settings.guildSettings)) {
                allGuildSettings.push({
                    guildId,
                    movieChannelId: guildData.movieChannelId,
                    // Include any other settings you need
                });
            }
        }
        
        if (allGuildSettings.length === 0) {
            console.log('No guild settings found for scheduled messages');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        let permissionIssues = [];

        // Iterate through each guild's settings
        for (const guildSettings of allGuildSettings) {
            const { guildId, movieChannelId } = guildSettings;
            
            if (!movieChannelId) {
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
                const channel = guild.channels.cache.get(movieChannelId);
                if (!channel) {
                    console.warn(`Movie channel ${movieChannelId} not found in guild ${guild.name} (${guildId})`);
                    errorCount++;
                    continue;
                }

                // Check if channel is text-based
                if (!channel.isTextBased()) {
                    console.warn(`Channel ${channel.name} in guild ${guild.name} is not text-based`);
                    errorCount++;
                    continue;
                }

                // Check bot permissions in the channel
                const permissions = channel.permissionsFor(guild.members.me);
                if (!permissions || !permissions.has('SendMessages')) {
                    console.warn(`Bot lacks SendMessages permission in channel ${channel.name} in guild ${guild.name}`);
                    errorCount++;
                    continue;
                }

                // Use the permission checker to validate the setup (optional check)
                try {
                    const permissionCheck = await permissionChecker.checkBotPermissions(guild);
                    if (permissionCheck.issues.length > 0) {
                        console.warn(`Permission issues in guild ${guild.name} (${guildId}): ${permissionCheck.issues.join(', ')}`);
                        // Don't skip, just log the warning
                    }
                } catch (permError) {
                    console.warn(`Error checking permissions for guild ${guild.name}:`, permError.message);
                    // Continue anyway, we already checked basic permissions above
                }
                
                // Alternate between two different message types for variety
                const useAlternative = Math.random() > 0.5;
                const embed = useAlternative ? createAlternativeScheduledEmbed() : createScheduledEmbed();
                
                await channel.send({ embeds: [embed] });
                successCount++;
                console.log(`✅ Scheduled message sent to ${channel.name} in ${guild.name} (${useAlternative ? 'alternative' : 'standard'} format)`);

            } catch (error) {
                errorCount++;
                console.error(`❌ Error sending scheduled message to guild ${guildId}:`, error.message);
            }
        }

        console.log(`Scheduled message task completed. Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error) {
        console.error('Error in scheduled message system:', error);
    }
}

/**
 * Send a test message immediately (useful for testing)
 * @param {Client} client - Discord client instance
 */
async function sendTestMessage(client) {
    console.log('Sending test scheduled message...');
    await sendScheduledMessage(client);
}

/**
 * Create a standard scheduled embed
 * @returns {EmbedBuilder} The embed to send
 */
function createScheduledEmbed() {
    const { EmbedBuilder } = require('discord.js');
    
    return new EmbedBuilder()
        .setColor(0x00D4AA)
        .setTitle('🎬 Stream Sage Reminder')
        .setDescription('Looking for something to watch? Check out our movie collection!\n\n🌐 **Visit our website:** https://stream-sage-2-0.onrender.com/')
        .addFields(
            { name: '🔍 Find Movies', value: 'Use `/getmovie` to find and watch movies', inline: true },
            { name: '📋 Browse Collection', value: 'Use `/listmovies` to browse all available movies', inline: true },
            { name: '🔥 Popular Movies', value: 'Use `/popularmovies` to see what others are watching', inline: true }
        )
        .setFooter({ text: 'Automated reminder • Stream Sage' })
        .setTimestamp();
}

/**
 * Create an alternative scheduled embed with different styling
 * @returns {EmbedBuilder} The embed to send
 */
function createAlternativeScheduledEmbed() {
    const { EmbedBuilder } = require('discord.js');
    
    return new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🍿 Movie Night Suggestion')
        .setDescription('Need entertainment ideas? Our movie collection has you covered!\n\n🌐 **Visit our website:** https://stream-sage-2-0.onrender.com/')
        .addFields(
            { name: '🎯 Quick Suggestion', value: 'Try `/randomovie` for a surprise movie pick', inline: false },
            { name: '🔎 Advanced Search', value: 'Use `/searchmovie` to find movies by genre, year, or rating', inline: false }
        )
        .setFooter({ text: 'Automated suggestion • Stream Sage' })
        .setTimestamp();
}

module.exports = {
    initScheduledMessages,
    sendTestMessage
};