const dbManager = require('../utils/dbManager');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const adminCheck = require('../utils/adminCheck');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('optimizedb')
        .setDescription('⚡ Optimize database performance (Admin only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Optimization action to perform')
                .addChoices(
                    { name: 'Analyze Database', value: 'analyze' },
                    { name: 'Clean Duplicates', value: 'clean' },
                    { name: 'Compact Database', value: 'compact' },
                    { name: 'Backup Database', value: 'backup' }
                )
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if user is admin
            if (!adminCheck.isAdminUser(interaction.user.id)) {
                return interaction.editReply({
                    content: '❌ You do not have permission to use this command!',
                    ephemeral: true
                });
            }

            const action = interaction.options.getString('action');
            let embed;

            switch (action) {
                case 'analyze':
                    const movies = dbManager.getMovies();
                    const requests = dbManager.getRequests();
                    
                    // Analyze database
                    const totalSize = fs.statSync(path.join(__dirname, '../data/movies.json')).size + 
                                    fs.statSync(path.join(__dirname, '../data/requests.json')).size;
                    
                    const moviesWithTMDB = movies.filter(m => m.tmdbDetails).length;
                    const moviesWithoutTMDB = movies.length - moviesWithTMDB;
                    const pendingRequests = requests.filter(r => r.status === 'pending').length;
                    const fulfilledRequests = requests.filter(r => r.status === 'fulfilled').length;
                    
                    embed = new EmbedBuilder()
                        .setTitle('📊 Database Analysis')
                        .setColor(0x3498DB)
                        .addFields(
                            { name: '📁 Database Size', value: `${(totalSize / 1024).toFixed(2)} KB`, inline: true },
                            { name: '🎬 Total Movies', value: movies.length.toString(), inline: true },
                            { name: '📝 Total Requests', value: requests.length.toString(), inline: true },
                            { name: '✅ Movies with TMDB', value: moviesWithTMDB.toString(), inline: true },
                            { name: '❌ Movies without TMDB', value: moviesWithoutTMDB.toString(), inline: true },
                            { name: '⏳ Pending Requests', value: pendingRequests.toString(), inline: true },
                            { name: '✅ Fulfilled Requests', value: fulfilledRequests.toString(), inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;

                case 'clean':
                    const moviesBefore = dbManager.getMovies();
                    const requestsBefore = dbManager.getRequests();
                    
                    // Remove duplicate movies (same name)
                    const uniqueMovies = [];
                    const seenNames = new Set();
                    
                    moviesBefore.forEach(movie => {
                        const lowerName = movie.name.toLowerCase();
                        if (!seenNames.has(lowerName)) {
                            seenNames.add(lowerName);
                            uniqueMovies.push(movie);
                        }
                    });
                    
                    // Remove duplicate requests (same movie name and user)
                    const uniqueRequests = [];
                    const seenRequests = new Set();
                    
                    requestsBefore.forEach(request => {
                        const key = `${request.movieName.toLowerCase()}-${request.requestedBy}`;
                        if (!seenRequests.has(key)) {
                            seenRequests.add(key);
                            uniqueRequests.push(request);
                        }
                    });
                    
                    // Write cleaned data
                    fs.writeFileSync(path.join(__dirname, '../data/movies.json'), JSON.stringify(uniqueMovies, null, 4));
                    fs.writeFileSync(path.join(__dirname, '../data/requests.json'), JSON.stringify(uniqueRequests, null, 4));
                    
                    const moviesRemoved = moviesBefore.length - uniqueMovies.length;
                    const requestsRemoved = requestsBefore.length - uniqueRequests.length;
                    
                    embed = new EmbedBuilder()
                        .setTitle('🧹 Database Cleaned')
                        .setDescription('Duplicate entries have been removed.')
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '🎬 Movies Removed', value: moviesRemoved.toString(), inline: true },
                            { name: '📝 Requests Removed', value: requestsRemoved.toString(), inline: true },
                            { name: '📊 Total Savings', value: `${moviesRemoved + requestsRemoved} entries`, inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;

                case 'compact':
                    // Compact JSON files by removing extra whitespace
                    const moviesData = dbManager.getMovies();
                    const requestsData = dbManager.getRequests();
                    const settingsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/settings.json'), 'utf8'));
                    
                    const sizeBefore = fs.statSync(path.join(__dirname, '../data/movies.json')).size +
                                     fs.statSync(path.join(__dirname, '../data/requests.json')).size +
                                     fs.statSync(path.join(__dirname, '../data/settings.json')).size;
                    
                    // Write compacted data
                    fs.writeFileSync(path.join(__dirname, '../data/movies.json'), JSON.stringify(moviesData));
                    fs.writeFileSync(path.join(__dirname, '../data/requests.json'), JSON.stringify(requestsData));
                    fs.writeFileSync(path.join(__dirname, '../data/settings.json'), JSON.stringify(settingsData));
                    
                    const sizeAfter = fs.statSync(path.join(__dirname, '../data/movies.json')).size +
                                    fs.statSync(path.join(__dirname, '../data/requests.json')).size +
                                    fs.statSync(path.join(__dirname, '../data/settings.json')).size;
                    
                    const spaceSaved = sizeBefore - sizeAfter;
                    const savingsPercent = ((spaceSaved / sizeBefore) * 100).toFixed(2);
                    
                    embed = new EmbedBuilder()
                        .setTitle('⚡ Database Compacted')
                        .setDescription('Database files have been compacted.')
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '📁 Size Before', value: `${(sizeBefore / 1024).toFixed(2)} KB`, inline: true },
                            { name: '📁 Size After', value: `${(sizeAfter / 1024).toFixed(2)} KB`, inline: true },
                            { name: '💾 Space Saved', value: `${(spaceSaved / 1024).toFixed(2)} KB (${savingsPercent}%)`, inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;

                case 'backup':
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    
                    // Files to backup
                    const files = ['movies.json', 'requests.json', 'settings.json', 'statistics.json'];
                    const attachments = [];
                    const backedUpFiles = [];
                    
                    // Create attachments for each file
                    for (const file of files) {
                        const filePath = path.join(__dirname, '../data', file);
                        
                        if (fs.existsSync(filePath)) {
                            const attachment = new AttachmentBuilder(filePath, { 
                                name: `${timestamp}_${file}`,
                                description: `Backup of ${file} at ${timestamp}`
                            });
                            attachments.push(attachment);
                            backedUpFiles.push(file);
                        }
                    }
                    
                    embed = new EmbedBuilder()
                        .setTitle('💾 Database Backup')
                        .setDescription(`Here are your database files as of ${timestamp}`)
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '📄 Files Backed Up', value: backedUpFiles.length.toString(), inline: true },
                            { name: '📋 Files', value: backedUpFiles.join(', '), inline: false }
                        )
                        .setTimestamp();

                    // Send the files as attachments
                    await interaction.editReply({ 
                        embeds: [embed],
                        files: attachments
                    });
                    break;
            }

        } catch (error) {
            console.error('Error in optimizedb command:', error);
            await interaction.editReply({
                content: '❌ There was an error while optimizing the database!',
                ephemeral: true
            });
        }
    },
}; 