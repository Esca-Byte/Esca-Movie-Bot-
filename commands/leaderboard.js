const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 Show top users leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard to show')
                .addChoices(
                    { name: 'Most Active Users', value: 'active' },
                    { name: 'Top Requesters', value: 'requesters' }
                )
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of users to show (1-15)')
                .setMinValue(1)
                .setMaxValue(15)
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const type = interaction.options.getString('type') || 'active';
            const limit = interaction.options.getInteger('limit') || 10;

            let users, title, description;

            if (type === 'active') {
                users = statisticsManager.getMostActiveUsers(limit);
                title = '🏆 Most Active Users';
                description = 'Users with the most bot interactions';
            } else {
                users = statisticsManager.getTopRequesters(limit);
                title = '🏆 Top Movie Requesters';
                description = 'Users who requested the most movies';
            }

            if (users.length === 0) {
                const noDataEmbed = new EmbedBuilder()
                    .setTitle('🏆 No Leaderboard Data')
                    .setDescription('No user activity has been tracked yet.')
                    .setColor(0xFF6B6B)
                    .addFields({
                        name: '💡 How to get data:',
                        value: 'Users need to interact with the bot to start generating leaderboard statistics.',
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [noDataEmbed] });
            }

            const userList = users.map((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏆';
                const lastActivity = user.lastActivity ? 
                    new Date(user.lastActivity).toLocaleDateString() : 'Unknown';
                
                if (type === 'active') {
                    return `${medal} <@${user.userId}> • ${user.totalCommands} commands • Last: ${lastActivity}`;
                } else {
                    return `${medal} <@${user.userId}> • ${user.requests} requests • ${user.totalCommands} total commands`;
                }
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .addFields({
                    name: '📊 Leaderboard',
                    value: userList,
                    inline: false
                })
                .setColor(0xF39C12)
                .setFooter({ 
                    text: `Showing top ${users.length} users • Keep using the bot to climb the ranks!` 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            await interaction.editReply({
                content: '❌ There was an error while getting the leaderboard!',
                ephemeral: true
            });
        }
    },
}; 