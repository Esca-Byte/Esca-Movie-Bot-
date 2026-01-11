const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Discord bot token and application ID from environment variables
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN is not set in your .env file');
    process.exit(1);
}

if (!clientId) {
    console.error('❌ CLIENT_ID is not set in your .env file');
    process.exit(1);
}

const commands = [];

// Read all command files from the commands directory
const foldersPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

console.log('🔍 Loading commands...');

for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    try {
        const command = require(filePath);
        
        // Check if the command has the required 'data' and 'execute' properties
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
            console.log(`⚠️  Skipped ${file}: Missing 'data' or 'execute' property`);
        }
    } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error.message);
    }
}

// Create REST instance and set token
const rest = new REST().setToken(token);

// Deploy commands
(async () => {
    try {
        console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands.`);

        // Deploy globally (takes up to 1 hour to propagate)
        console.log('🌍 Deploying globally...');
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
        
        // List deployed commands
        console.log('\n📋 Deployed commands:');
        data.forEach(cmd => {
            console.log(`   • /${cmd.name} - ${cmd.description}`);
        });

        console.log('\n🎉 Command deployment completed successfully!');
        console.log('⏰ Note: Global commands may take up to 1 hour to appear in Discord.');

    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        
        if (error.code === 20012) {
            console.error('💡 AUTHORIZATION ERROR: The bot token is not authorized for this application.');
            console.error('   Possible causes:');
            console.error('   • Wrong CLIENT_ID - make sure it matches your bot application ID');
            console.error('   • Wrong DISCORD_BOT_TOKEN - make sure it\'s the correct bot token');
            console.error('   • Bot token doesn\'t belong to the application specified in CLIENT_ID');
            console.error('   • Bot application doesn\'t have command permissions');
            console.error('');
            console.error('🔧 How to fix:');
            console.error('   1. Go to https://discord.com/developers/applications');
            console.error('   2. Select your bot application');
            console.error('   3. Copy the Application ID and set it as CLIENT_ID in .env');
            console.error('   4. Go to Bot section and copy the bot token');
            console.error('   5. Set it as DISCORD_BOT_TOKEN in .env');
            console.error('   6. Make sure both values are from the SAME application');
        } else if (error.code === 50001) {
            console.error('💡 Bot is missing access to the application. Check bot permissions.');
        } else if (error.code === 50013) {
            console.error('💡 Bot lacks required permissions. Check bot permissions in the server.');
        } else if (error.status === 401) {
            console.error('💡 Invalid bot token. Check your DISCORD_BOT_TOKEN in .env file.');
        } else if (error.status === 403) {
            console.error('💡 Forbidden: Bot doesn\'t have permission to manage commands for this application.');
        }
        
        process.exit(1);
    }
})();