const { EmbedBuilder } = require('discord.js');
const config = require('../config/config.json');

/**
 * Check if a user is authorized to use admin commands
 * @param {string} userId - The Discord user ID to check
 * @returns {boolean} True if user is authorized, false otherwise
 */
function isAdminUser(userId) {
    return config.adminUserIds.includes(userId);
}

/**
 * Create a standardized permission denied embed
 * @returns {EmbedBuilder} The permission denied embed
 */
function createPermissionDeniedEmbed() {
    return new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('❌ Permission Denied')
        .setDescription('You do not have permission to use this command.')
        .setTimestamp();
}

/**
 * Check admin permissions and return error response if unauthorized
 * @param {string} userId - The Discord user ID to check
 * @returns {Object|null} Error response object if unauthorized, null if authorized
 */
function checkAdminPermission(userId) {
    if (!isAdminUser(userId)) {
        return {
            embeds: [createPermissionDeniedEmbed()],
            ephemeral: true
        };
    }
    return null;
}

module.exports = {
    isAdminUser,
    createPermissionDeniedEmbed,
    checkAdminPermission
}; 