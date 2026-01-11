const { Events } = require('discord.js');
const { prefix } = require('../config/config.json');
const translateCommand = require('../commands/translate');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        try {
            if (!message || !message.content) return;
            if (message.author?.bot) return;

            // Ensure we have a valid prefix and the message starts with it
            if (!prefix || !message.content.startsWith(prefix)) return;

            const withoutPrefix = message.content.slice(prefix.length).trim();
            if (withoutPrefix.length === 0) return;

            const args = withoutPrefix.split(/\s+/);
            const commandName = args.shift().toLowerCase();

            if (commandName === 'translate' || commandName === 'tr') {
                await translateCommand.execute(message, args);
            }
        } catch (error) {
            console.error('Error handling messageCreate:', error);
            try {
                await message.reply('An error occurred while processing your command.');
            } catch (_) {}
        }
    }
};
