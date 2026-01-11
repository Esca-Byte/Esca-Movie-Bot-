const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const permissionChecker = require('../utils/permissionChecker');
const dbManager = require('../utils/dbManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('validatesetup')
        .setDescription('Validate the bot setup in the current guild')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Check if user has Manage Guild permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need "Manage Server" permissions to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            
            // Check bot permissions
            const permissionCheck = await permissionChecker.checkBotPermissions(guild);
            
            // Get current guild settings
            const guildSettings = dbManager.getGuildSettings(guild.id);
            
            const embed = new EmbedBuilder()
                .setColor(permissionCheck.issues.length === 0 ? 0x00FF00 : 0xFF4444)
                .setTitle('🔍 Bot Setup Validation')
                .setDescription(`Validation results for **${guild.name}**`)
                .setTimestamp();

            // Add configuration status
            if (guildSettings.movieChannelId) {
                const channel = guild.channels.cache.get(guildSettings.movieChannelId);
                embed.addFields({
                    name: '📺 Movie Channel',
                    value: channel ? `✅ ${channel.name} (${channel.id})` : `❌ Channel not found (${guildSettings.movieChannelId})`,
                    inline: true
                });
            } else {
                embed.addFields({
                    name: '📺 Movie Channel',
                    value: '❌ No channel configured',
                    inline: true
                });
            }

            // Add permission status
            if (permissionCheck.issues.length === 0) {
                embed.addFields({
                    name: '✅ Permissions',
                    value: 'All permissions are properly configured!',
                    inline: true
                });
            } else {
                embed.addFields({
                    name: '❌ Permission Issues',
                    value: permissionCheck.issues.map(issue => `• ${issue}`).join('\n'),
                    inline: false
                });
            }

            // Add recommendations
            const recommendations = [];
            
            if (!guildSettings.movieChannelId) {
                recommendations.push('Use `/setmoviechannel #channel-name` to configure a movie channel');
            }
            
            if (permissionCheck.issues.includes('Bot lacks SendMessages permission')) {
                recommendations.push('Give the bot "Send Messages" permission in the movie channel');
            }
            
            if (permissionCheck.issues.includes('Bot lacks EmbedLinks permission (recommended)')) {
                recommendations.push('Give the bot "Embed Links" permission for better message formatting');
            }
            
            if (permissionCheck.issues.includes('Bot lacks AttachFiles permission (recommended)')) {
                recommendations.push('Give the bot "Attach Files" permission for media support');
            }

            if (recommendations.length > 0) {
                embed.addFields({
                    name: '🛠️ Recommendations',
                    value: recommendations.map(rec => `• ${rec}`).join('\n'),
                    inline: false
                });
            }

            // Add overall status
            const overallStatus = permissionCheck.issues.length === 0 ? '✅ Setup is valid!' : '❌ Setup needs attention';
            embed.addFields({
                name: '📊 Overall Status',
                value: overallStatus,
                inline: true
            });

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Error in validatesetup command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while validating the setup. Please try again.',
                ephemeral: true
            });
        }
    },
}; 