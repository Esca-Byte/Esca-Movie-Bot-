const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands and help information'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });
        try {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🎬 Stream Sage Commands')
                .setDescription('Here are all available commands:')
                .setColor(0x0099ff)
                .addFields(
                    { 
                        name: '🎥 Movie Commands', 
                        value: '`/getmovie <name>` - Gets movie details with similar movies suggestions.\n`/listmovies` - Lists all movies with interactive genre filtering and pagination.\n`/randommovie` - Get 3 random movie recommendations with smart filters.\n`/requestmovie <name>` - Requests a movie to be added to the database.',
                        inline: false 
                    },
                    { 
                        name: '🔍 Search & Filter Commands', 
                        value: '`/searchmovie` - Advanced movie search with fuzzy search and multiple criteria.\n`/filterbyyear` - Filter movies by year with decade presets.\n`/filterbyrating` - Filter movies by TMDB rating with presets.\n`/filterbylanguage` - Filter movies by available language.',
                        inline: false 
                    },
                    { 
                        name: '📊 Statistics Commands', 
                        value: '`/botstats` - Show comprehensive bot statistics.\n`/mostrequested` - Show most requested movies.\n`/popularmovies` - Show most viewed movies.\n`/leaderboard` - Show top users leaderboard.',
                        inline: false 
                    },
                    { 
                        name: '⚙️ Settings Commands', 
                        value: '`/setmoviechannel` - Set the designated movie channel (Admin only)\n`/setupguide` - Show step-by-step bot setup tutorial\n`/validatesetup` - Check current bot configuration and permissions',
                        inline: false 
                    },
                    { 
                        name: '🔧 Admin Commands', 
                        value: '`/savemovie` - Add a new movie to the database (Admin only)\n`/deletemovie <id>` - Delete a movie from the database (Admin only)\n`/update_movie <id>` - Update movie information (Admin only)\n`/requestlist` - View all pending movie requests (Admin only)\n`/optimizedb` - Optimize database performance (Admin only)\n`/cleanup` - Clean up old/duplicate entries (Admin only)\n`/scheduledstatus` - Check scheduled message status (Admin only)',
                        inline: false 
                    },
                    { 
                        name: '🛠️ Utility Commands', 
                        value: '`/checkpermissions` - Check bot permissions in channel\n`/delmessage` - Delete bot messages (Admin only)\n`!tr [language]` - Translate replied message (default: English)',
                        inline: false 
                    }
                )
                .addFields({
                    name: '💡 Quick Tips',
                    value: '• Use `/searchmovie` for advanced searching\n• Try decade presets in `/filterbyyear`\n• `/randommovie` now shows 3 recommendations\n• `/getmovie` includes similar movie suggestions\n• `/requestlist` shows all pending movie requests for admins\n• `/savemovie` includes download buttons and URL shortening',
                    inline: false
                })
                .setFooter({ text: 'Stream Sage | Need more help? Contact an administrator' })
                .setTimestamp();

            await interaction.editReply({ embeds: [helpEmbed] });
        } catch (error) {
            console.error('Error in help command:', error);
            await interaction.editReply({
                content: '❌ There was an error while executing the help command!',
                ephemeral: true
            });
        }
    },
};