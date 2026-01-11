const { REST, Routes } = require('discord.js');
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

// Create REST instance and set token
const rest = new REST().setToken(token);

// Function to remove all commands
async function removeAllCommands() {
    try {
        console.log('🗑️  Starting command removal process...');

        // Remove global commands
        console.log('\n🌍 Removing global commands...');
        const globalCommands = await rest.get(Routes.applicationCommands(clientId));
        console.log(`📋 Found ${globalCommands.length} global commands to remove.`);
        
        if (globalCommands.length > 0) {
            // Remove all global commands by setting empty array
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: [] }
            );
            console.log(`✅ Successfully removed ${globalCommands.length} global commands.`);
            
            // List removed commands
            console.log('\n🗑️  Removed global commands:');
            globalCommands.forEach(cmd => {
                console.log(`   • /${cmd.name}`);
            });
        } else {
            console.log('ℹ️  No global commands found to remove.');
        }

        console.log('\n🎉 Command removal completed successfully!');
        console.log('⏰ Note: It may take a few minutes for changes to reflect in Discord.');

    } catch (error) {
        console.error('❌ Error removing commands:', error);
        
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
            console.error('💡 Bot lacks required permissions. Check bot permissions.');
        } else if (error.status === 401) {
            console.error('💡 Invalid bot token. Check your DISCORD_BOT_TOKEN in .env file.');
        } else if (error.status === 403) {
            console.error('💡 Forbidden: Bot doesn\'t have permission to manage commands for this application.');
        }
        
        process.exit(1);
    }
}

// Function to remove specific command by name
async function removeSpecificCommand(commandName) {
    try {
        console.log(`🔍 Looking for command: ${commandName}`);
        
        let found = false;
        
        // Check global commands
        const globalCommands = await rest.get(Routes.applicationCommands(clientId));
        const globalCommand = globalCommands.find(cmd => cmd.name === commandName);
        
        if (globalCommand) {
            await rest.delete(Routes.applicationCommand(clientId, globalCommand.id));
            console.log(`✅ Removed global command: /${commandName}`);
            found = true;
        }
        
        if (!found) {
            console.log(`⚠️  Command '${commandName}' not found.`);
        }
        
    } catch (error) {
        console.error(`❌ Error removing command '${commandName}':`, error);
        
        if (error.code === 20012) {
            console.error('💡 AUTHORIZATION ERROR: Check that CLIENT_ID and DISCORD_BOT_TOKEN match the same application.');
        }
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const commandName = args[0];

if (commandName) {
    // Remove specific command
    console.log(`🎯 Removing specific command: ${commandName}\n`);
    removeSpecificCommand(commandName);
} else {
    // Remove all commands
    console.log('🗑️  Removing ALL global commands\n');
    console.log('⚠️  This will remove all global commands!');
    console.log('💡 To remove a specific command, use: node remove-commands.js <command-name>\n');
    
    // Add a 3-second delay for user to cancel if needed
    setTimeout(() => {
        removeAllCommands();
    }, 3000);
    
    console.log('⏳ Starting removal in 3 seconds... (Press Ctrl+C to cancel)');
}