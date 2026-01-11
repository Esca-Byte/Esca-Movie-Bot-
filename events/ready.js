const { Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const permissionChecker = require('../utils/permissionChecker');

// Function to update bot presence with member count
function updatePresence(client) {
    try {
        // Calculate total members across all guilds
        const totalMembers = client.guilds.cache.reduce((total, guild) => {
            return total + guild.memberCount;
        }, 0);

        // Format the number with commas for better readability
        const formattedMembers = totalMembers.toLocaleString();

        // Cool movie-themed presence messages
        const presenceMessages = [
            `🎬 ${formattedMembers} movie lovers`,
            `🍿 with ${formattedMembers} cinema fans`,
            `📽️ ${formattedMembers} film enthusiasts`,
            `🎭 over ${formattedMembers} movie buffs`,
            `🌟 ${formattedMembers} entertainment seekers`,
            `🎪 alongside ${formattedMembers} movie addicts`,
            `🎨 ${formattedMembers} cinephiles worldwide`,
            `🚀 ${formattedMembers} streaming warriors`
        ];

        // Activity types for variety
        const activityTypes = [
            ActivityType.Watching,
            ActivityType.Playing,
            ActivityType.Listening
        ];

        // Randomly select a message and activity type
        const randomMessage = presenceMessages[Math.floor(Math.random() * presenceMessages.length)];
        const randomActivity = activityTypes[Math.floor(Math.random() * activityTypes.length)];

        // Set the presence
        client.user.setPresence({
            activities: [{
                name: randomMessage,
                type: randomActivity,
            }],
            status: 'online',
        });

        console.log(`🎯 Cool presence updated: ${getActivityText(randomActivity)} ${randomMessage} (${client.guilds.cache.size} servers)`);
    } catch (error) {
        console.error('❌ Error updating presence:', error);
    }
}

// Helper function to get activity text for logging
function getActivityText(activityType) {
    switch(activityType) {
        case ActivityType.Playing: return 'Playing with';
        case ActivityType.Watching: return 'Watching';
        case ActivityType.Listening: return 'Listening to';
        default: return 'With';
    }
}

// Function to deploy slash commands to Discord
async function deployCommands(client) {
    const commands = [];
    // Read all command files from the 'commands' directory
    const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(__dirname, `../commands/${file}`));
        // Check if the command object has 'data' (SlashCommandBuilder) and 'execute' function
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] The command at ${path.join(__dirname, `../commands/${file}`)} is missing a required "data" or "execute" property.`);
        }
    }

    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Use client.application.commands.set for global commands (takes a few minutes to update)
        const data = await client.application.commands.set(commands);

        console.log(`Successfully reloaded ${data.size} application (/) commands.`);
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}

module.exports = {
    name: Events.ClientReady, // The event name when the client is ready
    once: true, // This event should only run once
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // --- Set Initial Bot's Presence ---
        updatePresence(client);
        console.log("✅ Initial bot presence set successfully.");
        
        // --- Update Presence Every 5 Minutes ---
        setInterval(() => {
            updatePresence(client);
        }, 5 * 60 * 1000); // 5 minutes in milliseconds
        console.log("🎭 Cool presence rotation started (every 5 minutes)");
        // --- End Set Bot's Presence ---

        await deployCommands(client); // Deploy commands when the bot is ready
        
        // Run initial permission validation after a short delay
        setTimeout(async () => {
            console.log('🔍 Running initial permission validation...');
            try {
                const results = await permissionChecker.runValidationAndNotify(client);
                console.log(`✅ Initial validation complete: ${results.validGuilds} valid, ${results.invalidGuilds} invalid, ${results.notificationsSent} notifications sent`);
            } catch (error) {
                console.error('❌ Error during initial validation:', error);
            }
        }, 10000); // Wait 10 seconds after bot is ready
    },
};