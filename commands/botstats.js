const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../utils/dbManager'); // Changed from dbAdapter
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('📊 Show comprehensive bot statistics'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const botStats = statisticsManager.getBotStats();
            const commandUsage = statisticsManager.getCommandUsage();
            const dailyStats = statisticsManager.getDailyStats(7);
            const uptime = statisticsManager.getBotUptime();
            const movies = dbManager.getMovies(); // Changed from dbAdapter
            const requests = dbManager.getRequests(); // Changed from dbAdapter

            // Update movie count
            statisticsManager.updateMovieCount(movies.length);

            // Calculate additional stats
            const totalServers = interaction.client.guilds.cache.size;
            const pendingRequests = requests.filter(req => req.status === 'pending').length;
            const fulfilledRequests = requests.filter(req => req.status === 'fulfilled').length;

            // Get top commands
            const topCommands = Object.entries(commandUsage)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([cmd, count]) => `${cmd}: ${count}`)
                .join('\n');

            // Format uptime
            let uptimeText = 'Unknown';
            if (uptime) {
                const parts = [];
                if (uptime.days > 0) parts.push(`${uptime.days}d`);
                if (uptime.hours > 0) parts.push(`${uptime.hours}h`);
                if (uptime.minutes > 0) parts.push(`${uptime.minutes}m`);
                if (parts.length === 0) parts.push(`${uptime.seconds}s`);
                uptimeText = parts.join(' ');
            }

            // Calculate daily averages
            const totalCommands7Days = dailyStats.reduce((sum, day) => sum + day.commands, 0);
            const avgCommandsPerDay = Math.round(totalCommands7Days / 7);

            const embed = new EmbedBuilder()
                .setTitle('📊 Bot Statistics Dashboard')
                .setColor(0x3498DB)
                .addFields(
                    {
                        name: '🤖 General Stats',
                        value: `**Total Commands:** ${botStats.totalCommands.toLocaleString()}\n**Total Movies:** ${movies.length.toLocaleString()}\n**Total Requests:** ${requests.length.toLocaleString()}\n**Servers:** ${totalServers.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '⏰ Uptime & Performance',
                        value: `**Uptime:** ${uptimeText}\n**Avg Commands/Day:** ${avgCommandsPerDay}\n**Last Restart:** ${botStats.uptime.lastRestart ? new Date(botStats.uptime.lastRestart).toLocaleString() : 'Unknown'}`,
                        inline: true
                    },
                    {
                        name: '📈 Request Status',
                        value: `**Pending:** ${pendingRequests}\n**Fulfilled:** ${fulfilledRequests}\n**Rejected:** ${requests.length - pendingRequests - fulfilledRequests}`,
                        inline: true
                    },
                    {
                        name: '🔥 Top Commands (Last 7 Days)',
                        value: topCommands || 'No command data available',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Statistics as of ${new Date().toLocaleString()}` 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in botstats command:', error);
            await interaction.editReply({
                content: '❌ There was an error while getting bot statistics!',
                ephemeral: true
            });
        }
    },
};