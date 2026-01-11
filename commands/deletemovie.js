const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const dbManager = require('../utils/dbManager');
const config = require('../config/config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletemovie')
        .setDescription('Deletes a movie/webseries from the database by its exact name. (Admin Only)')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The exact name of the movie or webseries to delete.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        // Add debug logging
        console.log(`[DEBUG] ${interaction.user.tag} (${interaction.user.id}) executed /deletemovie`);
        
        // First check: Discord's built-in permission check (handled by setDefaultMemberPermissions)
        // Second check: Custom admin check for additional security
        if (!config.adminUserIds.includes(interaction.user.id)) {
            console.log(`[DEBUG] User ${interaction.user.tag} (${interaction.user.id}) not in admin list`);
            console.log(`[DEBUG] Current admin IDs: ${config.adminUserIds.join(', ')}`);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Permission Denied')
                .setDescription('You do not have permission to use this command.')
                .addFields(
                    { name: 'Required Permission', value: 'Administrator role in this server + Bot admin status', inline: false },
                    { name: 'Your User ID', value: interaction.user.id, inline: true },
                    { name: 'Need Help?', value: 'Contact the bot administrator to be added to the admin list.', inline: false }
                )
                .setFooter({ text: 'This command requires special permissions for security.' });
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        console.log(`[DEBUG] Admin check passed for ${interaction.user.tag}`);
        await interaction.deferReply({ ephemeral: true });
        
        const movieName = interaction.options.getString('name');
        console.log(`[DEBUG] Searching for movie: "${movieName}"`);
        
        // Search for the movie by name (case insensitive)
        const movieToDelete = dbManager.getMovie(movieName);
        
        if (!movieToDelete) {
            console.log(`[DEBUG] Movie not found: "${movieName}"`);
            const notFoundEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('❌ Movie Not Found')
                .setDescription(`No movie found with the exact name "**${movieName}**" in the database.\n\n**Tip:** Use \`/listmovies\` to see all available movies and their exact names.`);
            
            return interaction.editReply({ embeds: [notFoundEmbed] });
        }
        
        console.log(`[DEBUG] Movie found: ID=${movieToDelete.id} (${typeof movieToDelete.id}), Name="${movieToDelete.name}"`);
        
        try {
            // Use the movie's ID for deletion
            console.log(`[DEBUG] Attempting to delete movie with ID: ${movieToDelete.id}`);
            const deleted = dbManager.deleteMovie(movieToDelete.id);
            console.log(`[DEBUG] Deletion result: ${deleted}`);

            if (deleted) {
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Movie Deleted')
                    .setDescription(`Successfully deleted "**${movieToDelete.name}**" from the database.`)
                    .addFields(
                        { name: 'Movie ID', value: movieToDelete.id.toString(), inline: true },
                        { name: 'Languages', value: Array.isArray(movieToDelete.languages) ? movieToDelete.languages.join(', ') : (movieToDelete.language || 'N/A'), inline: true }
                    )
                    .setTimestamp();
                
                // Add thumbnail if available
                if (movieToDelete.tmdbDetails?.poster_path) {
                    successEmbed.setThumbnail(`https://image.tmdb.org/t/p/w500${movieToDelete.tmdbDetails.poster_path}`);
                } else if (movieToDelete.customPosterUrl) {
                    successEmbed.setThumbnail(movieToDelete.customPosterUrl);
                }
                
                await interaction.editReply({ embeds: [successEmbed] });
                
                // Log the deletion
                console.log(`Movie deleted: ${movieToDelete.name} (ID: ${movieToDelete.id}) by ${interaction.user.tag}`);
            } else {
                console.log(`[DEBUG] Deletion failed for movie ID: ${movieToDelete.id}`);
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF4444)
                    .setTitle('❌ Deletion Failed')
                    .setDescription(`Failed to delete "**${movieToDelete.name}**". It might have been removed already or there was a database error.`);
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        } catch (error) {
            console.error('Error deleting movie:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Error')
                .setDescription('An unexpected error occurred while trying to delete the movie. Please check the bot logs.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};