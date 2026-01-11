const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require('discord.js');
const dbManager = require('../utils/dbManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmoviechannel')
        .setDescription('Sets the channel where movie messages will be sent. (Admin Only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to set as the movie output channel.')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) // Restrict to text or announcement channels
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator), // Discord's built-in permission check
    async execute(interaction) {
        // No need for custom adminUserIds check here as default_member_permissions handles visibility and basic access

        const channel = interaction.options.getChannel('channel');

        try {
            dbManager.setMovieChannel(interaction.guild.id, channel.id);
            
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Channel Set Successfully')
                .setDescription(`Movie notifications will now be sent in ${channel}.`);
            
            await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        } catch (error) {
            console.error(`Error setting movie channel for guild ${interaction.guild.id}:`, error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Error')
                .setDescription('There was an error setting the movie channel. Please try again.');
            
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};