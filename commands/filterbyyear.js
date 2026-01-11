const dbManager = require('../utils/dbManager');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filterbyyear')
        .setDescription('📅 Filter movies by release year with decade presets')
        .addStringOption(option =>
            option.setName('preset')
                .setDescription('Quick decade or period presets')
                .addChoices(
                    { name: '🎬 2020s (2020-2024)', value: '2020s' },
                    { name: '📱 2010s (2010-2019)', value: '2010s' },
                    { name: '💿 2000s (2000-2009)', value: '2000s' },
                    { name: '📺 1990s (1990-1999)', value: '1990s' },
                    { name: '🎵 1980s (1980-1989)', value: '1980s' },
                    { name: '🌟 1970s (1970-1979)', value: '1970s' },
                    { name: '🎭 1960s (1960-1969)', value: '1960s' },
                    { name: '📽️ 1950s (1950-1959)', value: '1950s' },
                    { name: '🎪 1940s (1940-1949)', value: '1940s' },
                    { name: '🎬 1930s (1930-1939)', value: '1930s' },
                    { name: '📽️ 1920s (1920-1929)', value: '1920s' },
                    { name: '🔥 Recent (Last 5 years)', value: 'recent' },
                    { name: '⭐ Classic Era (Pre-1980)', value: 'classic' },
                    { name: '🎯 Golden Age (1930-1960)', value: 'golden_age' },
                    { name: '🚀 Modern Era (2000+)', value: 'modern' }
                )
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('year')
                .setDescription('Filter by specific release year')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('operator')
                .setDescription('Filter operator (when using specific year)')
                .addChoices(
                    { name: 'Exactly', value: 'exact' },
                    { name: 'From this year onwards', value: 'from' },
                    { name: 'Up to this year', value: 'to' },
                    { name: 'Between years (use range)', value: 'range' }
                )
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('end_year')
                .setDescription('End year for range filter')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const preset = interaction.options.getString('preset');
            const year = interaction.options.getInteger('year');
            const operator = interaction.options.getString('operator') || 'exact';
            const endYear = interaction.options.getInteger('end_year');

            // Check if user provided either preset or year
            if (!preset && !year) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('📅 Year Filter Help')
                    .setColor(0x00D4AA)
                    .setDescription('Use either a preset or specific year to filter movies.')
                    .addFields(
                        { name: '🎯 Quick Presets', value: 'Choose from decades or special periods', inline: true },
                        { name: '📅 Custom Year', value: 'Filter by specific year with operators', inline: true },
                        { name: '🔧 Operators', value: 'exact, from, to, range', inline: true }
                    )
                    .addFields({
                        name: '💡 Examples',
                        value: '`/filterbyyear preset:2020s`\n`/filterbyyear year:2020`\n`/filterbyyear year:2020 operator:from`\n`/filterbyyear year:2020 end_year:2023`',
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [helpEmbed] });
            }

            // Get movies directly from dbManager
            let movies = dbManager.getMovies();
            let filteredMovies = [];
            let filterDescription = '';

            // Apply year filter based on preset or custom year
            if (preset) {
                const currentYear = new Date().getFullYear();
                
                switch (preset) {
                    case '2020s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 2020 && movieYear <= currentYear;
                        });
                        filterDescription = '2020s (2020-2024)';
                        break;

                    case '2010s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 2010 && movieYear <= 2019;
                        });
                        filterDescription = '2010s (2010-2019)';
                        break;

                    case '2000s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 2000 && movieYear <= 2009;
                        });
                        filterDescription = '2000s (2000-2009)';
                        break;

                    case '1990s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1990 && movieYear <= 1999;
                        });
                        filterDescription = '1990s (1990-1999)';
                        break;

                    case '1980s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1980 && movieYear <= 1989;
                        });
                        filterDescription = '1980s (1980-1989)';
                        break;

                    case '1970s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1970 && movieYear <= 1979;
                        });
                        filterDescription = '1970s (1970-1979)';
                        break;

                    case '1960s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1960 && movieYear <= 1969;
                        });
                        filterDescription = '1960s (1960-1969)';
                        break;

                    case '1950s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1950 && movieYear <= 1959;
                        });
                        filterDescription = '1950s (1950-1959)';
                        break;

                    case '1940s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1940 && movieYear <= 1949;
                        });
                        filterDescription = '1940s (1940-1949)';
                        break;

                    case '1930s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1930 && movieYear <= 1939;
                        });
                        filterDescription = '1930s (1930-1939)';
                        break;

                    case '1920s':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1920 && movieYear <= 1929;
                        });
                        filterDescription = '1920s (1920-1929)';
                        break;

                    case 'recent':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= currentYear - 5;
                        });
                        filterDescription = `Recent (${currentYear - 5}-${currentYear})`;
                        break;

                    case 'classic':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear < 1980;
                        });
                        filterDescription = 'Classic Era (Pre-1980)';
                        break;

                    case 'golden_age':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 1930 && movieYear <= 1960;
                        });
                        filterDescription = 'Golden Age (1930-1960)';
                        break;

                    case 'modern':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= 2000;
                        });
                        filterDescription = 'Modern Era (2000+)';
                        break;
                }
            } else {
                // Custom year filtering
                switch (operator) {
                    case 'exact':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear === year;
                        });
                        filterDescription = `Exactly ${year}`;
                        break;

                    case 'from':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= year;
                        });
                        filterDescription = `From ${year} onwards`;
                        break;

                    case 'to':
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear <= year;
                        });
                        filterDescription = `Up to ${year}`;
                        break;

                    case 'range':
                        if (!endYear) {
                            return interaction.editReply({
                                content: '❌ Please provide an end year for range filtering!',
                                ephemeral: true
                            });
                        }
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear >= year && movieYear <= endYear;
                        });
                        filterDescription = `${year}-${endYear}`;
                        break;

                    default:
                        filteredMovies = movies.filter(movie => {
                            if (!movie.tmdbDetails?.release_date) return false;
                            const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                            return movieYear === year;
                        });
                        filterDescription = `Exactly ${year}`;
                }
            }

            if (filteredMovies.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle('📅 No Movies Found')
                    .setDescription(`No movies found for: ${filterDescription}`)
                    .setColor(0xFF6B6B)
                    .addFields({
                        name: '💡 Try:',
                        value: preset ? 
                            '• Using a different decade preset\n• Using a custom year filter' :
                            `• Using a different year\n• Using 'from' operator to see movies from ${year} onwards\n• Using 'to' operator to see movies up to ${year}`,
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [noResultsEmbed] });
            }

            // Sort movies by year (newest first)
            filteredMovies.sort((a, b) => {
                const yearA = a.tmdbDetails?.release_date ? new Date(a.tmdbDetails.release_date).getFullYear() : 0;
                const yearB = b.tmdbDetails?.release_date ? new Date(b.tmdbDetails.release_date).getFullYear() : 0;
                return yearB - yearA;
            });

            // Pagination setup
            const moviesPerPage = 8;
            const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
            let currentPage = 1;

            function createPageEmbed(page) {
                const startIndex = (page - 1) * moviesPerPage;
                const endIndex = startIndex + moviesPerPage;
                const pageMovies = filteredMovies.slice(startIndex, endIndex);

                const embed = new EmbedBuilder()
                    .setTitle(`📅 Movies from ${filterDescription}`)
                    .setColor(0x00D4AA)
                    .setDescription(`Found **${filteredMovies.length}** movies`)
                    .setFooter({ text: `Page ${page}/${totalPages} • Showing ${startIndex + 1}-${Math.min(endIndex, filteredMovies.length)} of ${filteredMovies.length}` })
                    .setTimestamp();

                // Add year distribution info
                const yearDistribution = {};
                filteredMovies.forEach(movie => {
                    if (movie.tmdbDetails?.release_date) {
                        const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                        yearDistribution[movieYear] = (yearDistribution[movieYear] || 0) + 1;
                    }
                });

                const topYears = Object.entries(yearDistribution)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([year, count]) => `${year}: ${count}`)
                    .join(', ');

                if (topYears) {
                    embed.addFields({
                        name: '📊 Top Years',
                        value: topYears,
                        inline: false
                    });
                }

                // Add movie list
                const movieList = pageMovies.map((movie, index) => {
                    const movieYear = movie.tmdbDetails?.release_date ? 
                        new Date(movie.tmdbDetails.release_date).getFullYear() : 'N/A';
                    const movieRating = movie.tmdbDetails?.vote_average ? 
                        `${movie.tmdbDetails.vote_average.toFixed(1)}/10` : 'N/A';
                    const genres = movie.tmdbDetails?.genres ? 
                        movie.tmdbDetails.genres.map(g => g.name).slice(0, 2).join(', ') : 'N/A';

                    return `**${startIndex + index + 1}.** **${movie.name}** \`${movieYear}\` • ⭐ ${movieRating} • 🎭 ${genres} • \`#${movie.id}\``;
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

                return embed;
            }

            function createPaginationButtons() {
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

            // Create action buttons
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('get_details')
                        .setLabel('📖 Get Details')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('random_from_results')
                        .setLabel('🎲 Random from Results')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('sort_by_rating')
                        .setLabel('⭐ Sort by Rating')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('sort_by_name')
                        .setLabel('📝 Sort by Name')
                        .setStyle(ButtonStyle.Secondary)
                );

            const components = [];
            if (totalPages > 1) {
                components.push(createPaginationButtons());
            }
            components.push(actionRow);

            const response = await interaction.editReply({
                embeds: [createPageEmbed(currentPage)],
                components
            });

            // Create collector for button interactions
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev_page' && currentPage > 1) {
                    currentPage--;
                    const newEmbed = createPageEmbed(currentPage);
                    const newPaginationButtons = createPaginationButtons();
                    const newComponents = [newPaginationButtons, actionRow];
                    await i.update({ embeds: [newEmbed], components: newComponents });
                } else if (i.customId === 'next_page' && currentPage < totalPages) {
                    currentPage++;
                    const newEmbed = createPageEmbed(currentPage);
                    const newPaginationButtons = createPaginationButtons();
                    const newComponents = [newPaginationButtons, actionRow];
                    await i.update({ embeds: [newEmbed], components: newComponents });
                } else if (i.customId === 'get_details') {
                    if (filteredMovies.length > 0) {
                        const firstMovie = filteredMovies[0];
                        await i.reply({ 
                            content: `Use \`/getmovie ${firstMovie.name}\` to get detailed information about **${firstMovie.name}**!`, 
                            ephemeral: true 
                        });
                    }
                } else if (i.customId === 'random_from_results') {
                    if (filteredMovies.length > 0) {
                        const randomMovie = filteredMovies[Math.floor(Math.random() * filteredMovies.length)];
                        await i.reply({ 
                            content: `🎲 Random pick from your results: **${randomMovie.name}**\nUse \`/getmovie ${randomMovie.name}\` for details!`, 
                            ephemeral: true 
                        });
                    }
                } else if (i.customId === 'sort_by_rating') {
                    // Sort by rating (highest first)
                    filteredMovies.sort((a, b) => {
                        const ratingA = a.tmdbDetails?.vote_average || 0;
                        const ratingB = b.tmdbDetails?.vote_average || 0;
                        return ratingB - ratingA;
                    });
                    currentPage = 1; // Reset to first page
                    const newEmbed = createPageEmbed(currentPage);
                    const newPaginationButtons = createPaginationButtons();
                    const newComponents = [newPaginationButtons, actionRow];
                    await i.update({ embeds: [newEmbed], components: newComponents });
                } else if (i.customId === 'sort_by_name') {
                    // Sort by name (alphabetical)
                    filteredMovies.sort((a, b) => a.name.localeCompare(b.name));
                    currentPage = 1; // Reset to first page
                    const newEmbed = createPageEmbed(currentPage);
                    const newPaginationButtons = createPaginationButtons();
                    const newComponents = [newPaginationButtons, actionRow];
                    await i.update({ embeds: [newEmbed], components: newComponents });
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
            console.error('Error in filterbyyear command:', error);
            await interaction.editReply({
                content: '❌ There was an error while filtering movies by year!',
                ephemeral: true
            });
        }
    },
};