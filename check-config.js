const { REST, Routes } = require('discord.js');
require('dotenv').config();

// Load environment variables
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

console.log('🔍 Discord Bot Configuration Diagnostics\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`   CLIENT_ID: ${clientId ? `${clientId} ✅` : '❌ MISSING'}`);
console.log(`   DISCORD_BOT_TOKEN: ${token ? `${token.substring(0, 10)}... ✅` : '❌ MISSING'}`);

if (!token || !clientId) {
    console.log('\n❌ Missing required environment variables in .env file');
    console.log('📝 Required .env format:');
    console.log('DISCORD_BOT_TOKEN=your_bot_token_here');
    console.log('CLIENT_ID=your_application_id_here');
    process.exit(1);
}

// Validate CLIENT_ID format (should be a snowflake - 17-19 digits)
if (!/^\d{17,19}$/.test(clientId)) {
    console.log('\n⚠️  CLIENT_ID format looks incorrect. It should be 17-19 digits.');
    console.log('💡 Make sure you copied the Application ID, not User ID or Guild ID.');
}

// Test bot token validity
const rest = new REST().setToken(token);

(async () => {
    try {
        console.log('\n🔑 Testing bot token validity...');
        
        // Try to get bot information
        const botUser = await rest.get(Routes.user('@me'));
        console.log(`✅ Bot token is valid`);
        console.log(`   Bot Name: ${botUser.username}#${botUser.discriminator}`);
        console.log(`   Bot ID: ${botUser.id}`);
        
        // Check if CLIENT_ID matches bot ID
        if (clientId === botUser.id) {
            console.log('✅ CLIENT_ID matches bot application ID');
        } else {
            console.log('❌ CLIENT_ID does NOT match bot application ID');
            console.log('💡 Fix: Set CLIENT_ID to your bot\'s Application ID in .env file');
            console.log(`   Your bot ID: ${botUser.id}`);
            console.log(`   Current CLIENT_ID: ${clientId}`);
        }
        
        console.log('\n🎯 Testing command management permissions...');
        
        // Try to get existing commands (this tests permission)
        try {
            const commands = await rest.get(Routes.applicationCommands(clientId));
            console.log(`✅ Can access commands (found ${commands.length} existing commands)`);
            
            if (commands.length > 0) {
                console.log('📋 Existing commands:');
                commands.forEach(cmd => {
                    console.log(`   • /${cmd.name}`);
                });
            }
            
        } catch (cmdError) {
            if (cmdError.code === 20012) {
                console.log('❌ Cannot access commands - Authorization error');
                console.log('💡 The bot token doesn\'t have permission for this application');
                console.log('🔧 Solutions:');
                console.log('   1. Make sure CLIENT_ID is your bot\'s Application ID');
                console.log('   2. Make sure DISCORD_BOT_TOKEN is from the same application');
                console.log('   3. Regenerate bot token if needed');
            } else {
                console.log('❌ Error accessing commands:', cmdError.message);
            }
        }
        
        console.log('\n🔗 Quick links:');
        console.log(`   • Developer Portal: https://discord.com/developers/applications/${clientId}`);
        console.log('   • Bot Settings: https://discord.com/developers/applications');
        
    } catch (error) {
        console.log('❌ Bot token test failed:', error.message);
        
        if (error.status === 401) {
            console.log('💡 Invalid bot token. Check your DISCORD_BOT_TOKEN in .env file.');
        }
    }
})();