require('dotenv').config(); // Load environment variables from .env file at the very top
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initScheduledMessages } = require('./utils/scheduledMessage'); // Import the scheduled message system
const statisticsManager = require('./utils/statisticsManager'); // Import the statistics manager

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Ensure all required JSON files exist
const requiredFiles = ['movies.json', 'requests.json', 'settings.json', 'statistics.json'];
requiredFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
        // Create with default empty structure
        let defaultContent = '[]';
        if (file === 'settings.json') {
            defaultContent = '{"guildSettings":{}}';
        } else if (file === 'statistics.json') {
            defaultContent = JSON.stringify({
                botStats: {
                    totalCommands: 0,
                    totalMovies: 0,
                    totalRequests: 0,
                    uptime: {
                        startTime: new Date().toISOString(),
                        lastRestart: new Date().toISOString()
                    },
                    commandUsage: {},
                    dailyStats: {}
                },
                userActivity: {
                    userStats: {},
                    mostActiveUsers: [],
                    topRequesters: []
                },
                movieStats: {
                    mostRequested: [],
                    mostViewed: [],
                    popularGenres: [],
                    popularLanguages: []
                },
                serverStats: {
                    totalServers: 0,
                    activeServers: 0,
                    serverActivity: {}
                }
            }, null, 4);
        }
        fs.writeFileSync(filePath, defaultContent);
        console.log(`Created default ${file}`);
    }
});

// Check for critical environment variables
if (!process.env.DISCORD_BOT_TOKEN) {
    console.error("DISCORD_BOT_TOKEN is not set in your .env file. Please check your .env file.");
    process.exit(1); // Exit the process if token is missing
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Required for guild-related events
        GatewayIntentBits.GuildMessages,   // Required for reading messages
        GatewayIntentBits.MessageContent,  // Required for reading message content
        GatewayIntentBits.GuildMembers,    // Required for guild member events
        GatewayIntentBits.DirectMessages,  // Required for DM functionality
    ],
});

// Create a Collection to store commands, making them easily accessible
client.commands = new Collection();

// --- Load Commands ---
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    try {
        const command = require(path.join(__dirname, `commands/${file}`));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[WARNING] The command file "${file}" is missing a required "data" or "execute" property.`);
        }
    } catch (error) {
        console.error(`[ERROR] Failed to load command "${file}":`, error);
    }
}

// --- Load Events ---
const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    try {
        const event = require(path.join(__dirname, `events/${file}`));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    } catch (error) {
        console.error(`[ERROR] Failed to load event "${file}":`, error);
    }
}

// --- Initialize Bot ---
client.once('ready', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    
    // Initialize the statistics system
    statisticsManager.setBotStartTime();
    
    // Initialize the scheduled message system
    initScheduledMessages(client);
});

// Log in to Discord
client.login(process.env.DISCORD_BOT_TOKEN)
    .catch(error => {
        console.error("Failed to log in to Discord:", error);
        process.exit(1); // Exit if login fails
    });
