const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const adminCheck = require('../utils/adminCheck');
const dbManager = require('../utils/dbManager');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('🧹 Clean up old and duplicate entries (Admin only)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of cleanup to perform')
                .addChoices(
                    { name: 'Old Requests (30+ days)', value: 'old_requests' },
                    { name: 'Duplicate Movies', value: 'duplicate_movies' },
                    { name: 'Full Cleanup', value: 'full' }
                )
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('dry_run')
                .setDescription('Show what would be cleaned without actually doing it')
                .setRequired(false)),

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

            const type = interaction.options.getString('type');
            const dryRun = interaction.options.getBoolean('dry_run') || false;

            let embed;
            let cleanedItems = [];

            switch (type) {
                case 'old_requests':
                    const requests = dbManager.getRequests();
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                    const oldRequests = requests.filter(request => {
                        const requestDate = new Date(request.requestedAt);
                        return requestDate < thirtyDaysAgo && request.status !== 'pending';
                    });

                    cleanedItems = oldRequests.map(req => `Request: ${req.movieName} (${req.requestedAt})`);

                    if (!dryRun && oldRequests.length > 0) {
                        const updatedRequests = requests.filter(request => {
                            const requestDate = new Date(request.requestedAt);
                            return !(requestDate < thirtyDaysAgo && request.status !== 'pending');
                        });
                        fs.writeFileSync(path.join(__dirname, '../data/requests.json'), JSON.stringify(updatedRequests, null, 4));
                    }

                    embed = new EmbedBuilder()
                        .setTitle(dryRun ? '🔍 Old Requests Analysis' : '🧹 Old Requests Cleaned')
                        .setDescription(dryRun ? 'Items that would be cleaned:' : 'Old requests have been removed.')
                        .setColor(dryRun ? 0x3498DB : 0x00FF00)
                        .addFields({
                            name: '📝 Items Found',
                            value: `${oldRequests.length} old requests (30+ days, non-pending)`,
                            inline: false
                        })
                        .setTimestamp();

                    break;

                case 'duplicate_movies':
                    const movies = dbManager.getMovies();
                    const seenNames = new Set();
                    const duplicates = [];

                    movies.forEach((movie, index) => {
                        const lowerName = movie.name.toLowerCase();
                        if (seenNames.has(lowerName)) {
                            duplicates.push(movie);
                        } else {
                            seenNames.add(lowerName);
                        }
                    });

                    cleanedItems = duplicates.map(movie => `Movie: ${movie.name} (ID: ${movie.id})`);

                    if (!dryRun && duplicates.length > 0) {
                        const uniqueMovies = movies.filter(movie => {
                            const lowerName = movie.name.toLowerCase();
                            if (seenNames.has(lowerName)) {
                                seenNames.delete(lowerName);
                                return true;
                            }
                            return false;
                        });
                        fs.writeFileSync(path.join(__dirname, '../data/movies.json'), JSON.stringify(uniqueMovies, null, 4));
                    }

                    embed = new EmbedBuilder()
                        .setTitle(dryRun ? '🔍 Duplicate Movies Analysis' : '🧹 Duplicate Movies Cleaned')
                        .setDescription(dryRun ? 'Items that would be cleaned:' : 'Duplicate movies have been removed.')
                        .setColor(dryRun ? 0x3498DB : 0x00FF00)
                        .addFields({
                            name: '🎬 Duplicates Found',
                            value: `${duplicates.length} duplicate movies`,
                            inline: false
                        })
                        .setTimestamp();

                    break;





                case 'full':
                    // Perform all cleanup operations
                    const fullCleanupResults = [];
                    
                    // Old requests
                    const requests2 = dbManager.getRequests();
                    const thirtyDaysAgo2 = new Date();
                    thirtyDaysAgo2.setDate(thirtyDaysAgo2.getDate() - 30);
                    const oldRequests2 = requests2.filter(request => {
                        const requestDate = new Date(request.requestedAt);
                        return requestDate < thirtyDaysAgo2 && request.status !== 'pending';
                    });
                    fullCleanupResults.push(`Old Requests: ${oldRequests2.length}`);

                    // Duplicate movies
                    const movies2 = dbManager.getMovies();
                    const seenNames2 = new Set();
                    const duplicates2 = [];
                    movies2.forEach(movie => {
                        const lowerName = movie.name.toLowerCase();
                        if (seenNames2.has(lowerName)) {
                            duplicates2.push(movie);
                        } else {
                            seenNames2.add(lowerName);
                        }
                    });
                    fullCleanupResults.push(`Duplicate Movies: ${duplicates2.length}`);

                    

                    if (!dryRun) {
                        // Apply all cleanup operations
                        const updatedRequests = requests2.filter(request => {
                            const requestDate = new Date(request.requestedAt);
                            return !(requestDate < thirtyDaysAgo2 && request.status !== 'pending');
                        });
                        fs.writeFileSync(path.join(__dirname, '../data/requests.json'), JSON.stringify(updatedRequests, null, 4));

                        const uniqueMovies = movies2.filter(movie => {
                            const lowerName = movie.name.toLowerCase();
                            if (seenNames2.has(lowerName)) {
                                seenNames2.delete(lowerName);
                                return true;
                            }
                            return false;
                        });
                        fs.writeFileSync(path.join(__dirname, '../data/movies.json'), JSON.stringify(uniqueMovies, null, 4));
                    }

                    embed = new EmbedBuilder()
                        .setTitle(dryRun ? '🔍 Full Cleanup Analysis' : '🧹 Full Cleanup Completed')
                        .setDescription(dryRun ? 'Items that would be cleaned:' : 'All cleanup operations have been completed.')
                        .setColor(dryRun ? 0x3498DB : 0x00FF00)
                        .addFields({
                            name: '📊 Cleanup Summary',
                            value: fullCleanupResults.join('\n'),
                            inline: false
                        })
                        .setTimestamp();

                    break;
            }

            // Add detailed list if there are items to show
            if (cleanedItems.length > 0 && cleanedItems.length <= 10) {
                embed.addFields({
                    name: '📋 Items to Clean',
                    value: cleanedItems.join('\n'),
                    inline: false
                });
            } else if (cleanedItems.length > 10) {
                embed.addFields({
                    name: '📋 Sample Items to Clean',
                    value: cleanedItems.slice(0, 10).join('\n') + '\n... and ' + (cleanedItems.length - 10) + ' more',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in cleanup command:', error);
            await interaction.editReply({
                content: '❌ There was an error while performing cleanup!',
                ephemeral: true
            });
        }
    },
}; 