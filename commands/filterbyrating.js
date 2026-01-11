const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../utils/dbManager');
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filterbyrating')
        .setDescription('⭐ Filter movies by TMDB rating')
        .addNumberOption(option =>
            option.setName('min_rating')
                .setDescription('Minimum TMDB rating (1-10)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const minRating = interaction.options.getNumber('min_rating');
            
            // Get all movies from dbManager
            const allMovies = dbManager.getMovies();
            
            // Filter movies by rating
            const filteredMovies = allMovies.filter(movie => {
                // Check if movie has TMDB details with a vote_average
                return movie.tmdbDetails && 
                       movie.tmdbDetails.vote_average && 
                       movie.tmdbDetails.vote_average >= minRating;
            });
            
            // Sort movies by rating (highest first)
            filteredMovies.sort((a, b) => {
                return b.tmdbDetails.vote_average - a.tmdbDetails.vote_average;
            });
            
            // Track command usage
            statisticsManager.incrementCommandUsage('filterbyrating', interaction.user.id);
            
            if (filteredMovies.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle(`⭐ No Movies Found with Rating ${minRating}+`)
                    .setColor(0xFFAA00)
                    .setDescription(`We couldn't find any movies with a TMDB rating of ${minRating} or higher.`)
                    .addFields({
                        name: '💡 Suggestions',
                        value: 'Try a lower rating threshold or check back later as our database grows.',
                        inline: false
                    })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [noResultsEmbed] });
            }
            
            // Create pagination
            const moviesPerPage = 10;
            const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
            const currentPage = 1;
            
            // Create embed for current page
            const embed = createRatingResultsEmbed(filteredMovies, minRating, currentPage, totalPages, moviesPerPage);
            
            // Create pagination buttons if needed
            const components = [];
            if (totalPages > 1) {
                const paginationRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('◀️ Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === 1),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next ▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === totalPages)
                    );
                components.push(paginationRow);
            }
            
            // Add action buttons
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('random_movie')
                        .setLabel('🎲 Random Pick')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('get_details')
                        .setLabel('ℹ️ Get Details')
                        .setStyle(ButtonStyle.Success)
                );
            components.push(actionRow);
            
            const response = await interaction.editReply({
                embeds: [embed],
                components
            });
            
            // Set up collector for button interactions
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 minutes
            });
            
            let currentPageState = currentPage;
            
            collector.on('collect', async i => {
                if (i.customId === 'prev_page' && currentPageState > 1) {
                    currentPageState--;
                    const newEmbed = createRatingResultsEmbed(filteredMovies, minRating, currentPageState, totalPages, moviesPerPage);
                    
                    const newPaginationRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('◀️ Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(currentPageState === 1),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Next ▶️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(currentPageState === totalPages)
                        );
                    
                    await i.update({
                        embeds: [newEmbed],
                        components: [newPaginationRow, actionRow]
                    });
                } 
                else if (i.customId === 'next_page' && currentPageState < totalPages) {
                    currentPageState++;
                    const newEmbed = createRatingResultsEmbed(filteredMovies, minRating, currentPageState, totalPages, moviesPerPage);
                    
                    const newPaginationRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('◀️ Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(currentPageState === 1),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Next ▶️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(currentPageState === totalPages)
                        );
                    
                    await i.update({
                        embeds: [newEmbed],
                        components: [newPaginationRow, actionRow]
                    });
                }
                else if (i.customId === 'random_movie') {
                    const randomMovie = filteredMovies[Math.floor(Math.random() * filteredMovies.length)];
                    await i.reply({
                        content: `🎲 **Random Highly Rated Movie:** ${randomMovie.name} (⭐${randomMovie.tmdbDetails.vote_average.toFixed(1)})\n\nUse \`/getmovie name:${randomMovie.name}\` to see details and watch link!`,
                        ephemeral: true
                    });
                }
                else if (i.customId === 'get_details') {
                    await i.reply({
                        content: `Use \`/getmovie\` with the movie name to see full details and watch link!`,
                        ephemeral: true
                    });
                }
            });
            
            collector.on('end', () => {
                // Disable all buttons when collector ends
                const disabledComponents = components.map(row => {
                    const newRow = new ActionRowBuilder();
                    row.components.forEach(button => {
                        newRow.addComponents(
                            ButtonBuilder.from(button).setDisabled(true)
                        );
                    });
                    return newRow;
                });
                
                interaction.editReply({ components: disabledComponents }).catch(() => {});
            });
            
        } catch (error) {
            console.error('Error in filterbyrating command:', error);
            await interaction.editReply({
                content: '❌ There was an error while filtering movies by rating!',
                ephemeral: true
            });
        }
    },
};

// Helper function to create embed for rating results
function createRatingResultsEmbed(movies, minRating, currentPage, totalPages, moviesPerPage) {
    const startIdx = (currentPage - 1) * moviesPerPage;
    const endIdx = Math.min(startIdx + moviesPerPage, movies.length);
    const currentMovies = movies.slice(startIdx, endIdx);
    
    const embed = new EmbedBuilder()
        .setTitle(`⭐ Top Rated Movies (${minRating}+ Stars)`)
        .setColor(0xFFD700) // Gold color for ratings
        .setDescription(`Showing ${movies.length} movies with TMDB rating of ${minRating} or higher.`)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • Use /getmovie for details` })
        .setTimestamp();
    
    // Add movie list to embed
    let movieList = '';
    currentMovies.forEach((movie, index) => {
        const year = movie.tmdbDetails?.release_date ? 
            new Date(movie.tmdbDetails.release_date).getFullYear() : 
            (movie.year || '????');
        
        const rating = movie.tmdbDetails.vote_average.toFixed(1);
        
        movieList += `${startIdx + index + 1}. **${movie.name}** (${year}) ⭐${rating}\n`;
    });
    
    embed.addFields({ name: 'Top Rated Titles', value: movieList || 'No movies found' });
    
    return embed;
}
