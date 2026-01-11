const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../utils/dbManager');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        console.log(`🎉 Bot joined guild: ${guild.name} (${guild.id})`);
        
        try {
            // Get the audit logs to find who added the bot
            const auditLogs = await guild.fetchAuditLogs({
                type: 'BOT_ADD',
                limit: 1,
            }).catch(() => null);

            let addedBy = null;
            if (auditLogs && auditLogs.entries.size > 0) {
                const entry = auditLogs.entries.first();
                addedBy = entry.executor;
            }

            // If we can't find who added the bot, try to get the owner
            if (!addedBy) {
                addedBy = guild.ownerId ? await guild.members.fetch(guild.ownerId).catch(() => null) : null;
            }

            if (addedBy) {
                await sendWelcomeDM(addedBy, guild);
            }

            // Check if guild already has settings and validate them
            await validateGuildSetup(guild);

        } catch (error) {
            console.error(`Error handling guild join for ${guild.name}:`, error);
        }
    },
};

/**
 * Send welcome DM to the person who added the bot
 * @param {User} user - The user to send DM to
 * @param {Guild} guild - The guild the bot joined
 */
async function sendWelcomeDM(user, guild) {
    try {
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎬 Welcome to Stream Sage!')
            .setDescription(`Thank you for adding **Stream Sage** to **${guild.name}**!`)
            .addFields(
                {
                    name: '📋 Setup Required',
                    value: 'To get started, you need to set up a movie channel where the bot will send movie updates.',
                    inline: false
                },
                {
                    name: '🔧 Quick Setup',
                    value: 'Use `/setmoviechannel #channel-name` in your server to configure the bot.',
                    inline: false
                },
                {
                    name: '📚 Available Commands',
                    value: '• `/help` - View all available commands\n• `/setmoviechannel` - Set the movie channel\n• `/listmovies` - List all available movies',
                    inline: false
                }
            )
            .setFooter({ text: 'Need help? Contact the bot developer!' })
            .setTimestamp();

        const setupButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_guide')
                    .setLabel('📖 Setup Guide')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('support_server')
                    .setLabel('🆘 Support')
                    .setStyle(ButtonStyle.Secondary)
            );

        await user.send({
            embeds: [welcomeEmbed],
            components: [setupButton]
        });

        console.log(`✅ Welcome DM sent to ${user.tag} for guild ${guild.name}`);

    } catch (error) {
        console.error(`❌ Failed to send welcome DM to ${user.tag}:`, error.message);
    }
}

/**
 * Validate guild setup and notify about issues
 * @param {Guild} guild - The guild to validate
 */
async function validateGuildSetup(guild) {
    try {
        const guildSettings = dbManager.getGuildSettings(guild.id);
        
        if (!guildSettings.movieChannelId) {
            console.log(`⚠️ Guild ${guild.name} has no movie channel configured`);
            return;
        }

        // Check if the configured channel exists
        const channel = guild.channels.cache.get(guildSettings.movieChannelId);
        if (!channel) {
            console.log(`❌ Configured movie channel not found in guild ${guild.name}`);
            await notifyChannelIssue(guild, 'channel_not_found');
            return;
        }

        // Check bot permissions in the channel
        const permissions = channel.permissionsFor(guild.members.me);
        if (!permissions || !permissions.has('SendMessages')) {
            console.log(`❌ Bot lacks SendMessages permission in channel ${channel.name} in guild ${guild.name}`);
            await notifyChannelIssue(guild, 'missing_permissions');
            return;
        }

        console.log(`✅ Guild ${guild.name} setup validated successfully`);

    } catch (error) {
        console.error(`Error validating guild setup for ${guild.name}:`, error);
    }
}

/**
 * Notify guild owner about channel/permission issues
 * @param {Guild} guild - The guild with issues
 * @param {string} issueType - Type of issue ('channel_not_found' or 'missing_permissions')
 */
async function notifyChannelIssue(guild, issueType) {
    try {
        const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
        if (!owner) return;

        const issueEmbed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('⚠️ Bot Setup Issue Detected')
            .setDescription(`There's an issue with the bot setup in **${guild.name}**`);

        if (issueType === 'channel_not_found') {
            issueEmbed.addFields({
                name: '🔍 Issue',
                value: 'The configured movie channel no longer exists or is inaccessible.',
                inline: false
            }, {
                name: '🛠️ Solution',
                value: 'Please reconfigure the movie channel using `/setmoviechannel #new-channel-name`',
                inline: false
            });
        } else if (issueType === 'missing_permissions') {
            issueEmbed.addFields({
                name: '🔍 Issue',
                value: 'The bot lacks permission to send messages in the configured movie channel.',
                inline: false
            }, {
                name: '🛠️ Solution',
                value: 'Please give the bot "Send Messages" permission in the movie channel or reconfigure it.',
                inline: false
            });
        }

        await owner.send({ embeds: [issueEmbed] });
        console.log(`✅ Issue notification sent to ${owner.user.tag} for guild ${guild.name}`);

    } catch (error) {
        console.error(`❌ Failed to send issue notification for guild ${guild.name}:`, error.message);
    }
} 