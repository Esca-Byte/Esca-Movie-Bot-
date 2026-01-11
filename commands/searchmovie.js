const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const dbManager = require('../utils/dbManager');
const statisticsManager = require('../utils/statisticsManager');

// Create a Map to store search history
const searchHistory = new Map();

/**
 * Performs advanced search with multiple criteria using the same logic as getmovie
 * @param {object} searchOptions - Search parameters
 * @param {array} movies - All movies
 * @returns {array} Filtered movies
 */
function advancedSearch(searchOptions, movies) {
    let results = [...movies];

    // Title search using the same logic as getmovie
    if (searchOptions.title) {
        const titleResults = dbManager.searchMovies(searchOptions.title);
        results = titleResults;
    }

    // Genre filter
    if (searchOptions.genre) {
        results = results.filter(movie => 
            movie.tmdbDetails?.genres?.some(g => 
                g.name.toLowerCase().includes(searchOptions.genre.toLowerCase())
            )
        );
    }

    // Year filter
    if (searchOptions.year) {
        results = results.filter(movie => {
            if (!movie.tmdbDetails?.release_date) return false;
            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
            return movieYear === searchOptions.year;
        });
    }

    // Rating filter
    if (searchOptions.minRating) {
        results = results.filter(movie => 
            movie.tmdbDetails?.vote_average >= searchOptions.minRating
        );
    }

    // Language filter
    if (searchOptions.language) {
        results = results.filter(movie => 
            movie.languages?.some(lang => 
                lang.toLowerCase().includes(searchOptions.language.toLowerCase())
            )
        );
    }

    return results;
}

/**
 * Creates search results embed
 * @param {array} movies - Search results
 * @param {object} searchOptions - Search parameters
 * @param {number} page - Current page
 * @param {number} totalPages - Total pages
 * @returns {EmbedBuilder}
 */
function createSearchResultsEmbed(movies, searchOptions, page = 1, totalPages = 1) {
    const moviesPerPage = 8;
    const startIndex = (page - 1) * moviesPerPage;
    const endIndex = startIndex + moviesPerPage;
    const pageMovies = movies.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
        .setTitle('🔍 Search Results')
        .setColor(0x00D4AA)
        .setTimestamp();

    // Add search criteria
    const criteria = [];
    if (searchOptions.title) criteria.push(`**Title:** ${searchOptions.title}`);
    if (searchOptions.genre) criteria.push(`**Genre:** ${searchOptions.genre}`);
    if (searchOptions.year) criteria.push(`**Year:** ${searchOptions.year}`);
    if (searchOptions.minRating) criteria.push(`**Min Rating:** ${searchOptions.minRating}/10`);
    if (searchOptions.language) criteria.push(`**Language:** ${searchOptions.language}`);

    if (criteria.length > 0) {
        embed.addFields({
            name: '🔎 Search Criteria',
            value: criteria.join('\n'),
            inline: false
        });
    }

    // Add results info
    embed.addFields({
        name: '📊 Results',
        value: `Found **${movies.length}** movies\nShowing **${startIndex + 1}-${Math.min(endIndex, movies.length)}** of **${movies.length}**\nPage **${page}** of **${totalPages}**`,
        inline: false
    });

    // Add movie list
    if (pageMovies.length > 0) {
        const movieList = pageMovies.map((movie, index) => {
            const movieYear = movie.tmdbDetails?.release_date ? 
                new Date(movie.tmdbDetails.release_date).getFullYear() : 'N/A';
            const movieRating = movie.tmdbDetails?.vote_average ? 
                `${movie.tmdbDetails.vote_average.toFixed(1)}/10` : 'N/A';
            const genres = movie.tmdbDetails?.genres ? 
                movie.tmdbDetails.genres.map(g => g.name).slice(0, 2).join(', ') : 'N/A';

                         return `**${startIndex + index + 1}.** **${movie.name}** \`${movieYear}\` • ⭐ ${movieRating} • 🎭 ${genres}`;
        }).join('\n');

        embed.addFields({
            name: '🎬 Movies',
            value: movieList,
            inline: false
        });

        // Add poster of first movie as thumbnail
        if (pageMovies[0]?.tmdbDetails?.poster_path) {
            embed.setThumbnail(`https://image.tmdb.org/t/p/w500${pageMovies[0].tmdbDetails.poster_path}`);
        }
    } else {
        embed.addFields({
            name: '❌ No Results',
            value: 'No movies found matching your search criteria. Try adjusting your search terms.',
            inline: false
        });
    }

    return embed;
}

/**
 * Creates pagination buttons
 * @param {number} currentPage - Current page
 * @param {number} totalPages - Total pages
 * @returns {ActionRowBuilder}
 */
function createPaginationButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder();

    // Previous page button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1)
    );

    // Page indicator
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('page_info')
            .setLabel(`${currentPage}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );

    // Next page button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages)
    );

    return row;
}

/**
 * Creates action buttons
 * @param {array} movies - Search results
 * @returns {ActionRowBuilder}
 */
function createActionButtons(movies) {
    const row = new ActionRowBuilder();

    if (movies.length > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('get_details')
                .setLabel('📖 Get Link')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('random_from_results')
                .setLabel('🎲 Random Results')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('new_search')
            .setLabel('🔍 New Search')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('search_history')
            .setLabel('📚 Search History')
            .setStyle(ButtonStyle.Secondary)
    );

    return row;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('searchmovie')
        .setDescription('🔍 Advanced movie search with multiple criteria')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Search by movie title (uses same logic as /getmovie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('genre')
                .setDescription('Filter by genre')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('year')
                .setDescription('Filter by release year')
                .setRequired(false))
        .addNumberOption(option =>
            option.setName('min_rating')
                .setDescription('Minimum TMDB rating (1-10)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Filter by language')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const title = interaction.options.getString('title');
            const genre = interaction.options.getString('genre');
            const year = interaction.options.getInteger('year');
            const minRating = interaction.options.getNumber('min_rating');
            const language = interaction.options.getString('language');

            // Check if at least one search criteria is provided
            if (!title && !genre && !year && !minRating && !language) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🔍 Movie Search Help')
                    .setColor(0x00D4AA)
                    .setDescription('Use at least one search criteria to find movies.')
                    .addFields(
                        { name: '📝 Title Search', value: 'Search by movie title (same logic as /getmovie)', inline: true },
                        { name: '🎭 Genre Filter', value: 'Filter by movie genre', inline: true },
                        { name: '📅 Year Filter', value: 'Filter by release year', inline: true },
                        { name: '⭐ Rating Filter', value: 'Filter by minimum TMDB rating', inline: true },
                        { name: '🌍 Language Filter', value: 'Filter by available language', inline: true }
                    )
                    .addFields({
                        name: '💡 Examples',
                        value: '`/searchmovie title:avengers`\n`/searchmovie genre:action year:2020 min_rating:7`\n`/searchmovie language:english min_rating:8`',
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [helpEmbed] });
            }

            // Store search in history
            const searchData = {
                userId: interaction.user.id,
                timestamp: Date.now(),
                criteria: { title, genre, year, minRating, language },
                results: 0
            };

            // Get all movies
            const allMovies = dbManager.getMovies();

            // Perform search using the same logic as getmovie
            let searchResults = [];
            const searchOptions = { title, genre, year, minRating, language };

            if (title) {
                // Use the same search logic as getmovie command
                searchResults = dbManager.searchMovies(title);
            } else {
                searchResults = advancedSearch(searchOptions, allMovies);
            }

            // Update search history
            searchData.results = searchResults.length;
            if (!searchHistory.has(interaction.user.id)) {
                searchHistory.set(interaction.user.id, []);
            }
            const userHistory = searchHistory.get(interaction.user.id);
            userHistory.unshift(searchData);
            if (userHistory.length > 10) userHistory.pop(); // Keep only last 10 searches

            // Track search for statistics
            statisticsManager.incrementCommandUsage('searchmovie', interaction.user.id);

            // Create pagination
            const moviesPerPage = 8;
            const totalPages = Math.ceil(searchResults.length / moviesPerPage);
            const currentPage = 1;

            // Create embed and buttons
            const embed = createSearchResultsEmbed(searchResults, searchOptions, currentPage, totalPages);
            const paginationButtons = totalPages > 1 ? createPaginationButtons(currentPage, totalPages) : null;
            const actionButtons = createActionButtons(searchResults);

            const components = [];
            if (paginationButtons) components.push(paginationButtons);
            components.push(actionButtons);

            const response = await interaction.editReply({
                embeds: [embed],
                components
            });

            // Create collector for button interactions
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 minutes
            });

            let currentPageState = currentPage;

            collector.on('collect', async i => {
                if (i.customId === 'prev_page' && currentPageState > 1) {
                    currentPageState--;
                    const newEmbed = createSearchResultsEmbed(searchResults, searchOptions, currentPageState, totalPages);
                    const newPaginationButtons = createPaginationButtons(currentPageState, totalPages);
                    const newComponents = [newPaginationButtons, actionButtons];
                    await i.update({ embeds: [newEmbed], components: newComponents });
                } else if (i.customId === 'next_page' && currentPageState < totalPages) {
                    currentPageState++;
                    const newEmbed = createSearchResultsEmbed(searchResults, searchOptions, currentPageState, totalPages);
                    const newPaginationButtons = createPaginationButtons(currentPageState, totalPages);
                    const newComponents = [newPaginationButtons, actionButtons];
                    await i.update({ embeds: [newEmbed], components: newComponents });
                } else if (i.customId === 'get_details') {
                    if (searchResults.length > 0) {
                        const firstMovie = searchResults[0];
                        await i.reply({ 
                            content: `Use \`/getmovie ${firstMovie.name}\` to get detailed information about this movie!`, 
                            ephemeral: true 
                        });
                    }
                } else if (i.customId === 'random_from_results') {
                    if (searchResults.length > 0) {
                        const randomMovie = searchResults[Math.floor(Math.random() * searchResults.length)];
                        await i.reply({ 
                            content: `🎲 Random pick from your search results: **${randomMovie.name}**\nUse \`/getmovie ${randomMovie.name}\` for details!`, 
                            ephemeral: true 
                        });
                    }
                } else if (i.customId === 'new_search') {
                    await i.reply({ 
                        content: `Use \`/searchmovie\` with your search criteria to perform a new search!`, 
                        ephemeral: true 
                    });
                } else if (i.customId === 'search_history') {
                    const userHistory = searchHistory.get(interaction.user.id) || [];
                    if (userHistory.length === 0) {
                        await i.reply({ 
                            content: '📚 No search history found. Your searches will appear here!', 
                            ephemeral: true 
                        });
                    } else {
                        const historyEmbed = new EmbedBuilder()
                            .setTitle('📚 Your Search History')
                            .setColor(0x00D4AA)
                            .setDescription('Your recent searches:')
                            .setTimestamp();

                        userHistory.slice(0, 5).forEach((search, index) => {
                            const criteria = [];
                            if (search.criteria.title) criteria.push(`Title: ${search.criteria.title}`);
                            if (search.criteria.genre) criteria.push(`Genre: ${search.criteria.genre}`);
                            if (search.criteria.year) criteria.push(`Year: ${search.criteria.year}`);
                            if (search.criteria.minRating) criteria.push(`Rating: ${search.criteria.minRating}+`);
                            if (search.criteria.language) criteria.push(`Language: ${search.criteria.language}`);

                            const date = new Date(search.timestamp).toLocaleString();
                            historyEmbed.addFields({
                                name: `${index + 1}. Search (${date})`,
                                value: criteria.length > 0 ? criteria.join(', ') : 'No criteria',
                                inline: false
                            });
                        });

                        await i.reply({ embeds: [historyEmbed], ephemeral: true });
                    }
                }
            });

            collector.on('end', () => {
                // Disable all buttons after timeout
                const disabledComponents = components.map(row => {
                    const disabledRow = new ActionRowBuilder();
                    row.components.forEach(button => {
                        disabledRow.addComponents(
                            ButtonBuilder.from(button).setDisabled(true)
                        );
                    });
                    return disabledRow;
                });
                
                interaction.editReply({ components: disabledComponents }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in searchmovie command:', error);
            await interaction.editReply({
                content: '❌ There was an error while searching for movies!',
                ephemeral: true
            });
        }
    },
};