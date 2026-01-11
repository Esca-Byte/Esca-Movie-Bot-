const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config/config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delmsg')
        .setDescription('Delete a message by its ID')
        .addStringOption(option =>
            option.setName('messageid')
                .setDescription('The ID of the message to delete')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the message is located (optional, defaults to current channel)')
                .setRequired(false))
        .setDefaultMemberPermissions(null), // Make visible to everyone

    async execute(interaction) {
        try {
            // Check if user is authorized to use this command
            if (!config.adminUserIds.includes(interaction.user.id)) {
                return await interaction.reply({
                    content: '❌ You are not authorized to use this command.',
                    ephemeral: true
                });
            }

            const messageId = interaction.options.getString('messageid');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            // Validate message ID format
            if (!/^\d{17,19}$/.test(messageId)) {
                return await interaction.reply({
                    content: '❌ Invalid message ID format. Message IDs should be 17-19 digits long.',
                    ephemeral: true
                });
            }

            // Try to fetch and delete the message
            const message = await targetChannel.messages.fetch(messageId).catch(() => null);
            
            if (!message) {
                return await interaction.reply({
                    content: '❌ Message not found. Make sure the message ID is correct and the message exists in the specified channel.',
                    ephemeral: true
                });
            }

            // Check if the message was sent by this bot
            if (message.author.id !== interaction.client.user.id) {
                return await interaction.reply({
                    content: '❌ I can only delete messages that were sent by me.',
                    ephemeral: true
                });
            }

            // Check if the message can be deleted (not too old)
            const messageAge = Date.now() - message.createdTimestamp;
            const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
            
            if (messageAge > twoWeeksInMs) {
                return await interaction.reply({
                    content: '❌ Cannot delete messages older than 2 weeks due to Discord limitations.',
                    ephemeral: true
                });
            }

            // Delete the message
            await message.delete();

            await interaction.reply({
                content: `✅ Message deleted successfully from ${targetChannel}.`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error deleting message:', error);
            
            let errorMessage = '❌ An error occurred while trying to delete the message.';
            
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to delete messages in that channel.';
            } else if (error.code === 10008) {
                errorMessage = '❌ Message not found. It may have already been deleted.';
            } else if (error.code === 50034) {
                errorMessage = '❌ You can only delete messages that are less than 2 weeks old.';
            }

            await interaction.reply({
                content: errorMessage,
                ephemeral: true
            });
        }
    },
};