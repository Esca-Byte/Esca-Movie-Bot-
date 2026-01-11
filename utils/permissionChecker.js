const dbManager = require('./dbManager');
const { EmbedBuilder } = require('discord.js');

/**
 * Check bot permissions in a specific guild
 * @param {Guild} guild - The guild to check
 * @returns {Object} Permission status object
 */
async function checkBotPermissions(guild) {
    const results = {
        guildAccess: false,
        channelConfigured: false,
        channelExists: false,
        channelPermissions: false,
        issues: []
    };

    try {
        // Check if bot is still in the guild
        if (!guild.members.me) {
            results.issues.push('Bot is not a member of this guild');
            return results;
        }
        results.guildAccess = true;

        // Check if movie channel is configured
        const settings = dbManager.getSettings();
        const guildSettings = settings && settings.guildSettings ? settings.guildSettings[guild.id] : null;
        
        if (!guildSettings || !guildSettings.movieChannelId) {
            results.issues.push('No movie channel configured');
            return results;
        }
        results.channelConfigured = true;

        // Check if the channel exists
        const channel = guild.channels.cache.get(guildSettings.movieChannelId);
        if (!channel) {
            results.issues.push('Configured movie channel does not exist');
            return results;
        }
        results.channelExists = true;

        // Check if channel is text-based
        if (!channel.isTextBased()) {
            results.issues.push('Configured channel is not text-based');
            return results;
        }

        // Check bot permissions in the channel
        const permissions = channel.permissionsFor(guild.members.me);
        if (!permissions) {
            results.issues.push('Cannot check permissions in the channel');
            return results;
        }

        if (!permissions.has('SendMessages')) {
            results.issues.push('Bot lacks SendMessages permission');
            return results;
        }

        if (!permissions.has('EmbedLinks')) {
            results.issues.push('Bot lacks EmbedLinks permission (recommended)');
        }

        if (!permissions.has('AttachFiles')) {
            results.issues.push('Bot lacks AttachFiles permission (recommended)');
        }

        results.channelPermissions = true;

    } catch (error) {
        results.issues.push(`Error checking permissions: ${error.message}`);
    }

    return results;
}

/**
 * Validate all guilds and return a report
 * @param {Client} client - Discord client instance
 * @returns {Object} Validation report
 */
async function validateAllGuilds(client) {
    const report = {
        totalGuilds: 0,
        validGuilds: 0,
        invalidGuilds: 0,
        guildDetails: []
    };

    try {
        // Get settings from dbManager
        const settings = dbManager.getSettings();
        const allGuildSettings = [];
        
        // Convert the settings format to an array of guild settings
        if (settings && settings.guildSettings) {
            for (const [guildId, guildData] of Object.entries(settings.guildSettings)) {
                allGuildSettings.push({
                    guildId,
                    ...guildData
                });
            }
        }
        
        report.totalGuilds = allGuildSettings.length;

        for (const guildSettings of allGuildSettings) {
            const guild = client.guilds.cache.get(guildSettings.guildId);
            
            if (!guild) {
                report.invalidGuilds++;
                report.guildDetails.push({
                    guildId: guildSettings.guildId,
                    guildName: 'Unknown Guild',
                    status: 'Bot not in guild',
                    issues: ['Bot is not a member of this guild']
                });
                continue;
            }

            const permissionCheck = await checkBotPermissions(guild);
            
            if (permissionCheck.issues.length === 0) {
                report.validGuilds++;
                report.guildDetails.push({
                    guildId: guild.id,
                    guildName: guild.name,
                    status: 'Valid',
                    issues: []
                });
            } else {
                report.invalidGuilds++;
                report.guildDetails.push({
                    guildId: guild.id,
                    guildName: guild.name,
                    status: 'Invalid',
                    issues: permissionCheck.issues
                });
            }
        }

    } catch (error) {
        console.error('Error validating guilds:', error);
    }

    return report;
}

/**
 * Send notification to guild owner about permission issues
 * @param {Guild} guild - The guild with issues
 * @param {Array} issues - Array of issue descriptions
 */
async function notifyGuildOwner(guild, issues) {
    try {
        const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
        if (!owner) {
            console.log(`Cannot notify owner for guild ${guild.name} - owner not accessible`);
            return false;
        }

        const issueEmbed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('⚠️ Bot Setup Issues Detected')
            .setDescription(`Your bot setup in **${guild.name}** needs attention.`)
            .addFields({
                name: '🔍 Issues Found',
                value: issues.map(issue => `• ${issue}`).join('\n'),
                inline: false
            }, {
                name: '🛠️ How to Fix',
                value: '1. Use `/setmoviechannel #channel-name` to set a valid channel\n2. Ensure the bot has "Send Messages" permission\n3. Make sure the channel is text-based',
                inline: false
            })
            .setFooter({ text: 'This message was sent automatically to help you fix bot issues' })
            .setTimestamp();

        await owner.send({ embeds: [issueEmbed] });
        console.log(`✅ Permission issue notification sent to ${owner.user.tag} for guild ${guild.name}`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to send permission notification for guild ${guild.name}:`, error.message);
        return false;
    }
}

/**
 * Create a detailed permission report embed
 * @param {Object} report - The validation report
 * @returns {EmbedBuilder} The report embed
 */
function createPermissionReportEmbed(report) {
    const embed = new EmbedBuilder()
        .setColor(report.invalidGuilds > 0 ? 0xFFAA00 : 0x00FF00)
        .setTitle('🔍 Bot Permission Report')
        .setDescription(`Validation completed for ${report.totalGuilds} guilds`)
        .addFields(
            {
                name: '📊 Summary',
                value: `✅ Valid: ${report.validGuilds}\n❌ Invalid: ${report.invalidGuilds}\n📋 Total: ${report.totalGuilds}`,
                inline: true
            }
        )
        .setTimestamp();

    // Add details for invalid guilds
    const invalidGuilds = report.guildDetails.filter(guild => guild.status === 'Invalid');
    if (invalidGuilds.length > 0) {
        const issuesList = invalidGuilds.map(guild => 
            `**${guild.guildName}**\n${guild.issues.map(issue => `• ${issue}`).join('\n')}`
        ).join('\n\n');
        
        embed.addFields({
            name: '❌ Issues Found',
            value: issuesList.length > 1024 ? issuesList.substring(0, 1021) + '...' : issuesList,
            inline: false
        });
    }

    return embed;
}

/**
 * Run a complete validation and notification process
 * @param {Client} client - Discord client instance
 * @returns {Object} Validation results
 */
async function runValidationAndNotify(client) {
    console.log('🔍 Starting comprehensive guild validation...');
    
    const report = await validateAllGuilds(client);
    let notificationsSent = 0;

    // Send notifications for invalid guilds
    for (const guildDetail of report.guildDetails) {
        if (guildDetail.status === 'Invalid' && guildDetail.issues.length > 0) {
            const guild = client.guilds.cache.get(guildDetail.guildId);
            if (guild) {
                const sent = await notifyGuildOwner(guild, guildDetail.issues);
                if (sent) notificationsSent++;
            }
        }
    }

    console.log(`✅ Validation complete. Notifications sent: ${notificationsSent}/${report.invalidGuilds}`);
    
    return {
        ...report,
        notificationsSent
    };
}

module.exports = {
    checkBotPermissions,
    validateAllGuilds,
    notifyGuildOwner,
    createPermissionReportEmbed,
    runValidationAndNotify
};
