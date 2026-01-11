const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('requestlist')
        .setDescription('Show list of pending movie requests (Admin only)'),

    async execute(interaction) {
        try {
            // Load config to check admin permissions
            const configPath = path.join(__dirname, '..', 'config', 'config.json');
            let config = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }

            // Check if user is admin
            const isAdmin = config.adminUserIds && config.adminUserIds.includes(interaction.user.id);
            if (!isAdmin) {
                return await interaction.reply({
                    content: '❌ You do not have permission to use this command. Only admins can view the request list.',
                    ephemeral: true
                });
            }

            // Load requests database
            const requestsPath = path.join(__dirname, '..', 'data', 'requests.json');
            let requests = [];
            
            if (fs.existsSync(requestsPath)) {
                try {
                    const requestsData = fs.readFileSync(requestsPath, 'utf8');
                    requests = JSON.parse(requestsData);
                } catch (error) {
                    console.error('Error reading requests.json:', error);
                    return await interaction.reply({
                        content: '❌ Error reading requests database.',
                        ephemeral: true
                    });
                }
            }

            // Filter pending requests
            const pendingRequests = requests.filter(request => request.status === 'pending');

            if (pendingRequests.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Pending Movie Requests')
                    .setDescription('No pending movie requests found.')
                    .setColor(0x00AE86)
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed] });
            }

            // Create embed with pending requests
            const embed = new EmbedBuilder()
                .setTitle('📋 Pending Movie Requests')
                .setColor(0xFFD700)
                .setTimestamp();

            let description = '';
            const maxRequests = 25; // Discord embed description limit
            
            for (let i = 0; i < Math.min(pendingRequests.length, maxRequests); i++) {
                const request = pendingRequests[i];
                const movieName = request.movieName || 'Unknown Movie';
                const requesterId = request.requestedBy || 'Unknown User';
                const requestDate = request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : 'Unknown Date';
                const guildName = request.guildName || 'Unknown Server';
                const requestId = request.id || i + 1;

                description += `**${i + 1}.** ${movieName}\n`;
                description += `   👤 Requester: <@${requesterId}>\n`;
                description += `   📅 Date: ${requestDate}\n`;
                description += `   🏠 Server: ${guildName}\n`;
                description += `   🆔 ID: ${requestId}\n\n`;
            }

            if (pendingRequests.length > maxRequests) {
                description += `\n⚠️ Showing first ${maxRequests} of ${pendingRequests.length} pending requests.`;
            }

            embed.setDescription(description);
            embed.setFooter({ 
                text: `Total pending requests: ${pendingRequests.length} | Use /approverequest or /rejectrequest to manage requests` 
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in requestlist command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching the request list.',
                ephemeral: true
            });
        }
    },
};