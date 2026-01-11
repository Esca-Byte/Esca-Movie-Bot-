const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('popularmovies')
        .setDescription('🔥 Show most viewed/popular movies')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of movies to show (1-20)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const limit = interaction.options.getInteger('limit') || 10;
            const mostViewed = statisticsManager.getMostViewedMovies(limit);

            if (mostViewed.length === 0) {
                const noDataEmbed = new EmbedBuilder()
                    .setTitle('🔥 No View Data')
                    .setDescription('No movie views have been tracked yet.')
                    .setColor(0xFF6B6B)
                    .addFields({
                        name: '💡 How to get data:',
                        value: 'Users need to use `/getmovie` to start generating view statistics.',
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [noDataEmbed] });
            }

            const movieList = mostViewed.map((item, index) => {
                const medal = index === 0 ? '🔥' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊';
                return `${medal} **${item.movieName}** • ${item.count} view${item.count > 1 ? 's' : ''}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🔥 Most Viewed Movies')
                .setDescription(movieList)
                .setColor(0xE74C3C)
                .setFooter({ 
                    text: `Showing top ${mostViewed.length} viewed movies • Use /getmovie <name> to view a movie` 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in popularmovies command:', error);
            await interaction.editReply({
                content: '❌ There was an error while getting popular movies!',
                ephemeral: true
            });
        }
    },
}; 