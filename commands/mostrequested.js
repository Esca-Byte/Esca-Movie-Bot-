const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mostrequested')
        .setDescription('📊 Show most requested movies')
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
            const mostRequested = statisticsManager.getMostRequestedMovies(limit);

            if (mostRequested.length === 0) {
                const noDataEmbed = new EmbedBuilder()
                    .setTitle('📊 No Request Data')
                    .setDescription('No movie requests have been tracked yet.')
                    .setColor(0xFF6B6B)
                    .addFields({
                        name: '💡 How to get data:',
                        value: 'Users need to use `/requestmovie` to start generating request statistics.',
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [noDataEmbed] });
            }

            const movieList = mostRequested.map((item, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊';
                return `${medal} **${item.movieName}** • ${item.count} request${item.count > 1 ? 's' : ''}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('📊 Most Requested Movies')
                .setDescription(movieList)
                .setColor(0x9B59B6)
                .setFooter({ 
                    text: `Showing top ${mostRequested.length} requested movies • Use /requestmovie to request a movie` 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in mostrequested command:', error);
            await interaction.editReply({
                content: '❌ There was an error while getting most requested movies!',
                ephemeral: true
            });
        }
    },
}; 