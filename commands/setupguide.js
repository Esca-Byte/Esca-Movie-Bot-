const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupguide')
        .setDescription('Get a comprehensive setup guide for the Stream Sage'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🎬 Stream Sage Setup Guide')
            .setDescription('Welcome to Stream Sage! Follow this guide to set up your server properly.')
            .addFields(
                {
                    name: '📋 Prerequisites',
                    value: 'Make sure you have "Manage Server" permissions in this Discord server.',
                    inline: false
                },
                {
                    name: '1️⃣ Create a Movie Channel',
                    value: 'Create a text channel where you want movie updates to be posted.\n**Examples:** #movies, #movie-updates, #cinema',
                    inline: false
                },
                {
                    name: '2️⃣ Set Bot Permissions',
                    value: 'In your movie channel, ensure the bot has these permissions:\n• ✅ **Send Messages** (Required)\n• ✅ **Embed Links** (Recommended)\n• ✅ **Attach Files** (Recommended)',
                    inline: false
                },
                {
                    name: '3️⃣ Configure the Bot',
                    value: 'Use this command to set your movie channel:\n`/setmoviechannel #your-channel-name`',
                    inline: false
                },
                {
                    name: '4️⃣ Validate Setup',
                    value: 'Use `/validatesetup` to check if everything is configured correctly.',
                    inline: false
                },
                {
                    name: '5️⃣ Test the Bot',
                    value: 'Try these commands to test the bot:\n• `/help` - View all commands\n• `/listmovies` - List available movies\n• `/getmovie movie-name` - Get movie details',
                    inline: false
                }
            )
            .addFields(
                {
                    name: '🔧 Additional Features',
                    value: '• **Scheduled Messages**: Bot sends movie info every 4 hours\n• **Movie Requests**: Users can request new movies\n• **Search Function**: Find movies by name or partial matches',
                    inline: false
                },
                {
                    name: '❓ Need Help?',
                    value: 'If you encounter issues:\n• Use `/validatesetup` to diagnose problems\n• Check bot permissions in the channel\n• Ensure the channel is text-based',
                    inline: false
                }
            )
            .setFooter({ text: 'Stream Sage Setup Guide • Follow each step carefully' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_guide')
                    .setLabel('📖 Detailed Guide')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('support_server')
                    .setLabel('🆘 Get Help')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setLabel('🔗 Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=2048&scope=bot%20applications.commands')
            );

        await interaction.reply({
            embeds: [embed],
            components: [buttons],
            ephemeral: true
        });
    },
}; 