const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const dbManager = require('../utils/dbManager');

// Helper function to chunk an array into smaller pieces
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// Get all unique genres from the movie database
function getAllGenres() {
    const movies = dbManager.getMovies();
    const genreSet = new Set();
    
    movies.forEach(movie => {
        if (movie.tmdbDetails && movie.tmdbDetails.genres) {
            movie.tmdbDetails.genres.forEach(genre => {
                genreSet.add(genre.name);
            });
        }
    });
    
    return Array.from(genreSet).sort();
}

// Filter movies by genre
function filterMoviesByGenre(movies, selectedGenre) {
    if (!selectedGenre || selectedGenre === 'all') {
        return movies;
    }
    
    return movies.filter(movie => {
        if (!movie.tmdbDetails || !movie.tmdbDetails.genres) {
            return false;
        }
        return movie.tmdbDetails.genres.some(genre => genre.name === selectedGenre);
    });
}

// Enhanced genre emoji mapping with more comprehensive coverage
function getGenreEmoji(genre) {
    const genreEmojis = {
        'Action': '⚡',
        'Adventure': '🌟',
        'Animation': '🎨',
        'Comedy': '😂',
        'Crime': '🔍',
        'Documentary': '📺',
        'Drama': '🎭',
        'Family': '👨‍👩‍👧‍👦',
        'Fantasy': '🔮',
        'History': '📜',
        'Horror': '👻',
        'Music': '🎵',
        'Mystery': '🕵️',
        'Romance': '💝',
        'Science Fiction': '🚀',
        'TV Movie': '📻',
        'Thriller': '😱',
        'War': '⚔️',
        'Western': '🤠',
        'Action & Adventure': '🎯',
        'Sci-Fi & Fantasy': '🌌',
        'Biography': '📖',
        'Sport': '🏆',
        'News': '📰'
    };
    
    return genreEmojis[genre] || '🎬';
}

// Create genre selection dropdown with enhanced styling
function createGenreSelector(availableGenres, selectedGenre = 'all') {
    const options = [
        {
            label: 'All Genres',
            value: 'all',
            description: 'Browse complete movie collection',
            emoji: '🎭',
            default: selectedGenre === 'all'
        }
    ];
    
    availableGenres.forEach(genre => {
        options.push({
            label: genre,
            value: genre,
            description: `Discover ${genre.toLowerCase()} collection`,
            emoji: getGenreEmoji(genre),
            default: selectedGenre === genre
        });
    });
    
    // Discord select menu has a limit of 25 options
    const limitedOptions = options.slice(0, 25);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('genre_selector')
        .setPlaceholder('🎭 Choose genre • Click to filter movies')
        .addOptions(limitedOptions);
    
    return new ActionRowBuilder().addComponents(selectMenu);
}

// Create enhanced pagination buttons with better styling
function createPaginationButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder();
    
    // Previous button with enhanced styling
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0)
    );
    
    // Enhanced page indicator
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('current_page')
            .setLabel(`Page ${currentPage + 1} of ${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );
    
    // Next button with enhanced styling
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
    );
    
    return row;
}

// Format movie entry with professional styling
function formatMovieEntry(movie, index) {
    let movieInfo = `**${index}.** \`🎬\` **${movie.name}**`;
    
    // Add release year right after movie name if available
    if (movie.tmdbDetails && movie.tmdbDetails.release_date) {
        const year = new Date(movie.tmdbDetails.release_date).getFullYear();
        movieInfo += ` 󠁯•󠁏󠁏 ${year}`;
    }
    
    // Add ID in a more subtle way
    movieInfo += ` \`#${movie.id}\``;
    
    // Add genre info with better formatting
    if (movie.tmdbDetails && movie.tmdbDetails.genres && movie.tmdbDetails.genres.length > 0) {
        const genres = movie.tmdbDetails.genres
            .slice(0, 3)
            .map(g => g.name)
            .join(' • ');
        movieInfo += `\n   └─ ${genres}${movie.tmdbDetails.genres.length > 3 ? ' • ...' : ''}`;
    }
    
    return movieInfo;
}

// Create enhanced embed for a specific page
function createPageEmbed(movies, currentPage, totalPages, selectedGenre = 'all', totalMoviesCount = 0) {
    const startIndex = currentPage * 8 + 1;
    const movieList = movies.map((movie, index) => 
        formatMovieEntry(movie, startIndex + index)
    );
    
    const genreText = selectedGenre === 'all' ? 'Complete Collection' : selectedGenre;
    
    // Dynamic color based on genre
    const colors = {
        'Action': 0xFF4500,
        'Comedy': 0xFFD700,
        'Drama': 0x8B0000,
        'Horror': 0x800080,
        'Romance': 0xFF69B4,
        'Science Fiction': 0x00CED1,
        'Fantasy': 0x9370DB,
        'Adventure': 0x228B22,
        'Animation': 0xFF6347,
        'Crime': 0x2F4F4F,
        'Documentary': 0x708090,
        'Family': 0x87CEEB,
        'History': 0xD2691E,
        'Music': 0xDA70D6,
        'Mystery': 0x191970,
        'Thriller': 0x8B0000,
        'War': 0x556B2F,
        'Western': 0xD2B48C
    };
    
    const embedColor = selectedGenre === 'all' ? 0x1E90FF : (colors[selectedGenre] || 0x7289DA);
    
    const embed = new EmbedBuilder()
        .setTitle(`🎭 Stream Sage • ${genreText}`)
        .setDescription(`${movieList.join('\n\n')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .setColor(embedColor)
        .setFooter({ 
            text: `🎬 Page ${currentPage + 1}/${totalPages} • Showing ${movies.length} of ${totalMoviesCount} movies • Cinema Collection`, 
        })
        .setTimestamp();
    
    
    embed.addFields({
        name: '\`📊\` Collection Stats',
        value: `\`🎬\` **Total Movies:** ${totalMoviesCount}\n\`🎭\` **Current Filter:** ${genreText}\n\`📄\` **This Page:** ${movies.length} entries`,
        inline: true
    });
    

    return embed;
}

// Create enhanced error embed
function createErrorEmbed(selectedGenre, availableGenres) {
    return new EmbedBuilder()
        .setTitle(`🚫 No Movies Found • ${selectedGenre}`)
        .setDescription(`We couldn't find any movies in the **${selectedGenre}** genre.\n\n🎭 **Available Genres:**\n${availableGenres.join(' • ')}`)
        .setColor(0xFF4444)
        .addFields({
            name: '💡 Suggestion',
            value: 'Try selecting a different genre from the dropdown menu below, or choose "All Genres" to browse the complete collection.',
            inline: false
        })
        .setTimestamp();
}

// Create enhanced expired components
function createExpiredComponents() {
    const expiredGenreSelector = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('expired_genre')
                .setPlaceholder('⏱️ Session expired • Run /listmovies again')
                .setDisabled(true)
                .addOptions([
                    {
                        label: 'Session Expired',
                        value: 'expired',
                        emoji: '⏱️'
                    }
                ])
        );

    const expiredButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('expired')
                .setLabel('⏱️ Session Expired')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
        );

    return [expiredGenreSelector, expiredButtons];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listmovies')
        .setDescription('🎬 Browse your movie collection with advanced filtering and elegant pagination'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            // Get movies directly from dbManager instead of conditionally using dbAdapter
            const allMovies = dbManager.getMovies();
            const availableGenres = getAllGenres();
            
            if (allMovies.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle('🎬 Stream Sage • Empty Collection')
                    .setDescription('Your movie database is currently empty.\n\n📥 **Add movies to get started!**')
                    .setColor(0x95A5A6)
                    .addFields({
                        name: '💡 Getting Started',
                        value: 'Use movie management commands to add your first movies to the collection.',
                        inline: false
                    })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [emptyEmbed] });
            }

            // Start with all movies
            let selectedGenre = 'all';
            let filteredMovies = filterMoviesByGenre(allMovies, selectedGenre);
            
            // Enhanced pagination - 8 movies per page for better readability
            const movieChunks = chunkArray(filteredMovies, 8);
            const totalPages = movieChunks.length;
            let currentPage = 0;

            // Create initial components
            const embed = createPageEmbed(movieChunks[currentPage], currentPage, totalPages, selectedGenre, filteredMovies.length);
            const genreSelector = createGenreSelector(availableGenres, selectedGenre);
            const paginationButtons = totalPages > 1 ? createPaginationButtons(currentPage, totalPages) : null;

            // Prepare components array
            const components = [genreSelector];
            if (paginationButtons) {
                components.push(paginationButtons);
            }

            // Send initial message
            const response = await interaction.editReply({
                embeds: [embed],
                components: components
            });

            // Create collector for interactions with extended timeout
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 600000 // 10 minutes for better user experience
            });

            collector.on('collect', async i => {
                try {
                    // Handle genre selection
                    if (i.customId === 'genre_selector') {
                        selectedGenre = i.values[0];
                        filteredMovies = filterMoviesByGenre(allMovies, selectedGenre);
                        
                        if (filteredMovies.length === 0) {
                            const errorEmbed = createErrorEmbed(selectedGenre, availableGenres);
                            const newGenreSelector = createGenreSelector(availableGenres, selectedGenre);
                            
                            return i.update({
                                embeds: [errorEmbed],
                                components: [newGenreSelector]
                            });
                        }
                        
                        // Reset pagination for new genre
                        const newMovieChunks = chunkArray(filteredMovies, 8);
                        const newTotalPages = newMovieChunks.length;
                        currentPage = 0;
                        
                        const newEmbed = createPageEmbed(newMovieChunks[currentPage], currentPage, newTotalPages, selectedGenre, filteredMovies.length);
                        const newGenreSelector = createGenreSelector(availableGenres, selectedGenre);
                        const newPaginationButtons = newTotalPages > 1 ? createPaginationButtons(currentPage, newTotalPages) : null;
                        
                        const newComponents = [newGenreSelector];
                        if (newPaginationButtons) {
                            newComponents.push(newPaginationButtons);
                        }
                        
                        // Update the chunks for pagination
                        movieChunks.length = 0;
                        movieChunks.push(...newMovieChunks);
                        
                        await i.update({
                            embeds: [newEmbed],
                            components: newComponents
                        });
                    }
                    
                    // Handle pagination
                    else if (i.customId === 'prev_page' || i.customId === 'next_page') {
                        const totalPages = movieChunks.length;
                        
                        if (i.customId === 'prev_page' && currentPage > 0) {
                            currentPage--;
                        } else if (i.customId === 'next_page' && currentPage < totalPages - 1) {
                            currentPage++;
                        }

                        const newEmbed = createPageEmbed(movieChunks[currentPage], currentPage, totalPages, selectedGenre, filteredMovies.length);
                        const newGenreSelector = createGenreSelector(availableGenres, selectedGenre);
                        const newPaginationButtons = createPaginationButtons(currentPage, totalPages);

                        await i.update({
                            embeds: [newEmbed],
                            components: [newGenreSelector, newPaginationButtons]
                        });
                    }
                } catch (error) {
                    console.error('Error handling interaction:', error);
                    try {
                        await i.reply({ 
                            content: '❌ **Error:** Something went wrong while processing your request. Please try again.', 
                            ephemeral: true 
                        });
                    } catch (replyError) {
                        console.error('Error sending error reply:', replyError);
                    }
                }
            });

            collector.on('end', async () => {
                try {
                    const [expiredGenreSelector, expiredButtons] = createExpiredComponents();
                    await interaction.editReply({
                        components: [expiredGenreSelector, expiredButtons]
                    });
                } catch (error) {
                    // Message might have been deleted, ignore the error
                    console.log('Could not update expired components - message may have been deleted');
                }
            });

        } catch (error) {
            console.error('Error listing movies:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🚫 System Error')
                .setDescription('An unexpected error occurred while retrieving your movie collection.')
                .setColor(0xFF0000)
                .addFields({
                    name: '💡 What to do',
                    value: 'Please try running the command again. If the problem persists, contact support.',
                    inline: false
                })
                .setTimestamp();
            
            await interaction.editReply({ 
                embeds: [errorEmbed],
                components: []
            });
        }
    },
};
