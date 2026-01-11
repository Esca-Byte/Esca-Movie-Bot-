const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const permissionChecker = require('../utils/permissionChecker');
const config = require('../config/config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkpermissions')
        .setDescription('Check bot permissions across all guilds and send notifications (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Check if user is in the admin user IDs list
        if (!config.adminUserIds.includes(interaction.user.id)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Permission Denied')
                .setDescription('You do not have permission to use this command.');
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Run the validation and notification process
            const results = await permissionChecker.runValidationAndNotify(interaction.client);
            
            // Create a detailed report embed
            const reportEmbed = permissionChecker.createPermissionReportEmbed(results);
            
            // Add notification information
            reportEmbed.addFields({
                name: '📧 Notifications',
                value: `Sent ${results.notificationsSent} notification(s) to guild owners`,
                inline: true
            });

            await interaction.editReply({
                embeds: [reportEmbed],
                content: `✅ Permission check completed! Checked ${results.totalGuilds} guilds.`
            });

        } catch (error) {
            console.error('Error in checkpermissions command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while checking permissions. Please try again.',
                ephemeral: true
            });
        }
    },
}; 