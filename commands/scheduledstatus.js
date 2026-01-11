const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const dbManager = require('../utils/dbManager');
const config = require('../config/config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scheduledstatus')
        .setDescription('Check the status of scheduled messages and configured channels (Admin Only)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        if (!config.adminUserIds.includes(interaction.user.id)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Permission Denied')
                .setDescription('You do not have permission to use this command.');
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get all guild settings from the database using the same approach as in scheduledMessage.js
            const settings = dbManager.getSettings();
            const allGuildSettings = [];
            
            // Convert the settings format to an array of guild settings
            if (settings && settings.guildSettings) {
                for (const [guildId, guildData] of Object.entries(settings.guildSettings)) {
                    allGuildSettings.push({
                        guildId,
                        movieChannelId: guildData.movieChannelId,
                        // Include any other settings you need
                    });
                }
            }
            
            if (!allGuildSettings || allGuildSettings.length === 0) {
                const noSettingsEmbed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle('⚠️ No Scheduled Message Settings')
                    .setDescription('No guild settings found. Use `/setmoviechannel` to configure movie channels for scheduled messages.')
                    .setTimestamp();

                return interaction.editReply({ embeds: [noSettingsEmbed] });
            }

            const statusEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📊 Scheduled Message Status')
                .setDescription(`Found ${allGuildSettings.length} configured guild(s)`)
                .setTimestamp();

            let validChannels = 0;
            let invalidChannels = 0;

            for (const guildSettings of allGuildSettings) {
                const { guildId, movieChannelId } = guildSettings;
                
                if (!movieChannelId) {
                    invalidChannels++;
                    continue;
                }

                try {
                    const guild = interaction.client.guilds.cache.get(guildId);
                    if (!guild) {
                        invalidChannels++;
                        statusEmbed.addFields({
                            name: `❌ Guild ${guildId}`,
                            value: 'Guild not found in cache',
                            inline: true
                        });
                        continue;
                    }

                    const channel = guild.channels.cache.get(movieChannelId);
                    if (!channel) {
                        invalidChannels++;
                        statusEmbed.addFields({
                            name: `❌ ${guild.name}`,
                            value: `Channel ${movieChannelId} not found`,
                            inline: true
                        });
                        continue;
                    }

                    const permissions = channel.permissionsFor(interaction.client.user);
                    if (!permissions || !permissions.has('SendMessages')) {
                        invalidChannels++;
                        statusEmbed.addFields({
                            name: `⚠️ ${guild.name}`,
                            value: `No permission in #${channel.name}`,
                            inline: true
                        });
                        continue;
                    }

                    validChannels++;
                    statusEmbed.addFields({
                        name: `✅ ${guild.name}`,
                        value: `#${channel.name}`,
                        inline: true
                    });

                } catch (error) {
                    invalidChannels++;
                    statusEmbed.addFields({
                        name: `❌ Guild ${guildId}`,
                        value: `Error: ${error.message}`,
                        inline: true
                    });
                }
            }

            statusEmbed.addFields({
                name: '📈 Summary',
                value: `✅ Valid: ${validChannels}\n❌ Invalid: ${invalidChannels}\n📅 Interval: Every 6 hours`,
                inline: false
            });

            if (validChannels === 0) {
                statusEmbed.setColor(0xFF4444);
                statusEmbed.addFields({
                    name: '⚠️ Warning',
                    value: 'No valid channels found. Scheduled messages will not be sent.',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [statusEmbed] });

        } catch (error) {
            console.error('Error checking scheduled message status:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Error')
                .setDescription(`Error checking scheduled message status: ${error.message}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};