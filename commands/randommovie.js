const dbManager = require('../utils/dbManager');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randommovie')
        .setDescription('🎲 Get random movie recommendations from the database')
        .addStringOption(option =>
            option.setName('genre')
                .setDescription('Filter by specific genre')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('year')
                .setDescription('Filter by minimum release year')
                .setRequired(false))
        .addNumberOption(option =>
            option.setName('rating')
                .setDescription('Filter by minimum TMDB rating (1-10)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Filter by available language')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Randomization mode')
                .addChoices(
                    { name: '🎲 Pure Random', value: 'random' },
                    { name: '⭐ High Rated', value: 'high_rated' },
                    { name: '💎 Hidden Gems', value: 'hidden_gems' },
                    { name: '🔥 Popular', value: 'popular' },
                    { name: '📅 Recent', value: 'recent' }
                )
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const genre = interaction.options.getString('genre');
            const year = interaction.options.getInteger('year');
            const rating = interaction.options.getNumber('rating');
            const language = interaction.options.getString('language');
            const mode = interaction.options.getString('mode') || 'random';

            // Always use JSON files from dbManager
            let movies = dbManager.getMovies();

            // Apply filters
            if (genre) {
                movies = movies.filter(movie => 
                    movie.tmdbDetails?.genres?.some(g => 
                        g.name.toLowerCase() === genre.toLowerCase()
                    )
                );
            }

            if (year) {
                movies = movies.filter(movie => {
                    if (!movie.tmdbDetails?.release_date) return false;
                    const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                    return movieYear >= year;
                });
            }

            if (rating) {
                movies = movies.filter(movie => 
                    movie.tmdbDetails?.vote_average >= rating
                );
            }

            if (language) {
                movies = movies.filter(movie => 
                    movie.languages?.some(lang => 
                        lang.toLowerCase() === language.toLowerCase()
                    )
                );
            }

            if (movies.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle('🎲 No Movies Found')
                    .setDescription('No movies match your current filters.')
                    .setColor(0xFF6B6B)
                    .addFields({
                        name: '💡 Try adjusting your filters:',
                        value: `• Remove genre filter\n• Lower the year requirement\n• Lower the rating requirement\n• Check available languages`,
                        inline: false
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [noResultsEmbed] });
            }

            // Apply smart filtering based on mode
            let filteredMovies = [...movies];
            switch (mode) {
                case 'high_rated':
                    filteredMovies = movies.filter(movie => movie.tmdbDetails?.vote_average >= 7.5);
                    break;
                case 'hidden_gems':
                    filteredMovies = movies.filter(movie => 
                        movie.tmdbDetails?.vote_average >= 7.0 && 
                        movie.tmdbDetails?.vote_average < 8.0 &&
                        movie.tmdbDetails?.vote_count < 1000
                    );
                    break;
                case 'popular':
                    filteredMovies = movies.filter(movie => 
                        movie.tmdbDetails?.vote_count > 1000
                    );
                    break;
                case 'recent':
                    const currentYear = new Date().getFullYear();
                    filteredMovies = movies.filter(movie => {
                        if (!movie.tmdbDetails?.release_date) return false;
                        const movieYear = new Date(movie.tmdbDetails.release_date).getFullYear();
                        return movieYear >= currentYear - 5;
                    });
                    break;
            }

            // If smart filter resulted in too few movies, fall back to original list
            if (filteredMovies.length < 3) {
                filteredMovies = movies;
            }

            // Get 3 random movies (or less if not enough available)
            const numMovies = Math.min(3, filteredMovies.length);
            const randomMovies = [];
            const usedIndices = new Set();

            for (let i = 0; i < numMovies; i++) {
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * filteredMovies.length);
                } while (usedIndices.has(randomIndex));
                
                usedIndices.add(randomIndex);
                randomMovies.push(filteredMovies[randomIndex]);
            }

            // Create main embed
            const embed = new EmbedBuilder()
                .setTitle(`🎲 Random Movie Recommendations`)
                .setDescription(`Here are ${numMovies} random movies for you!`)
                .setColor(0x00D4AA)
                .setTimestamp();

            // Add mode info
            const modeEmojis = {
                'random': '🎲',
                'high_rated': '⭐',
                'hidden_gems': '💎',
                'popular': '🔥',
                'recent': '📅'
            };

            const modeNames = {
                'random': 'Pure Random',
                'high_rated': 'High Rated',
                'hidden_gems': 'Hidden Gems',
                'popular': 'Popular',
                'recent': 'Recent'
            };

            embed.addFields({
                name: '🎯 Mode',
                value: `${modeEmojis[mode]} ${modeNames[mode]}`,
                inline: true
            });

            if (genre) {
                embed.addFields({
                    name: '🎭 Genre',
                    value: genre,
                    inline: true
                });
            }

            embed.addFields({
                name: '📊 Results',
                value: `${numMovies} movies from ${filteredMovies.length} available`,
                inline: true
            });

            // Add movie details
            randomMovies.forEach((movie, index) => {
                const movieYear = movie.tmdbDetails?.release_date ? 
                    new Date(movie.tmdbDetails.release_date).getFullYear() : 'N/A';
                const movieRating = movie.tmdbDetails?.vote_average ? 
                    `${movie.tmdbDetails.vote_average}/10` : 'N/A';
                const genres = movie.tmdbDetails?.genres ? 
                    movie.tmdbDetails.genres.map(g => g.name).slice(0, 2).join(', ') : 'N/A';

                embed.addFields({
                    name: `${index + 1}. ${movie.name} (${movieYear})`,
                    value: `⭐ ${movieRating} • 🎭 ${genres}\n📝 ${movie.tmdbDetails?.overview?.substring(0, 100)}${movie.tmdbDetails?.overview?.length > 100 ? '...' : ''}\n🔗 Use \`/getmovie ${movie.name}\` for details`,
                    inline: false
                });
            });

            // Add poster of first movie as thumbnail
            if (randomMovies[0]?.tmdbDetails?.poster_path) {
                embed.setThumbnail(`https://image.tmdb.org/t/p/w500${randomMovies[0].tmdbDetails.poster_path}`);
            }

            // Create action buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('get_details_1')
                        .setLabel('📖 Movie 1 Details')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('get_details_2')
                        .setLabel('📖 Movie 2 Details')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('get_details_3')
                        .setLabel('📖 Movie 3 Details')
                        .setStyle(ButtonStyle.Primary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('another_random')
                        .setLabel('🎲 New Recommendations')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('list_all')
                        .setLabel('📋 List All Movies')
                        .setStyle(ButtonStyle.Secondary)
                );

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row, row2]
            });

            // Create collector for button interactions
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 120000 // 2 minutes
            });

            collector.on('collect', async i => {
                if (i.customId.startsWith('get_details_')) {
                    const movieIndex = parseInt(i.customId.split('_')[2]) - 1;
                    if (movieIndex >= 0 && movieIndex < randomMovies.length) {
                        const movie = randomMovies[movieIndex];
                        await i.reply({ 
                            content: `Use \`/getmovie ${movie.name}\` to get detailed information about **${movie.name}**!`, 
                            ephemeral: true 
                        });
                    }
                } else if (i.customId === 'another_random') {
                    // Get new random movies with same filters
                    const newRandomMovies = [];
                    const newUsedIndices = new Set();

                    for (let i = 0; i < numMovies; i++) {
                        let randomIndex;
                        do {
                            randomIndex = Math.floor(Math.random() * filteredMovies.length);
                        } while (newUsedIndices.has(randomIndex));
                        
                        newUsedIndices.add(randomIndex);
                        newRandomMovies.push(filteredMovies[randomIndex]);
                    }

                    const newEmbed = new EmbedBuilder()
                        .setTitle(`🎲 New Random Movie Recommendations`)
                        .setDescription(`Here are ${numMovies} new random movies for you!`)
                        .setColor(0x00D4AA)
                        .setTimestamp();

                    newEmbed.addFields({
                        name: '🎯 Mode',
                        value: `${modeEmojis[mode]} ${modeNames[mode]}`,
                        inline: true
                    });

                    if (genre) {
                        newEmbed.addFields({
                            name: '🎭 Genre',
                            value: genre,
                            inline: true
                        });
                    }

                    newEmbed.addFields({
                        name: '📊 Results',
                        value: `${numMovies} movies from ${filteredMovies.length} available`,
                        inline: true
                    });

                    newRandomMovies.forEach((movie, index) => {
                        const movieYear = movie.tmdbDetails?.release_date ? 
                            new Date(movie.tmdbDetails.release_date).getFullYear() : 'N/A';
                        const movieRating = movie.tmdbDetails?.vote_average ? 
                            `${movie.tmdbDetails.vote_average}/10` : 'N/A';
                        const genres = movie.tmdbDetails?.genres ? 
                            movie.tmdbDetails.genres.map(g => g.name).slice(0, 2).join(', ') : 'N/A';

                        newEmbed.addFields({
                            name: `${index + 1}. ${movie.name} (${movieYear})`,
                            value: `⭐ ${movieRating} • 🎭 ${genres}\n📝 ${movie.tmdbDetails?.overview?.substring(0, 100)}${movie.tmdbDetails?.overview?.length > 100 ? '...' : ''}\n🔗 Use \`/getmovie ${movie.name}\` for details`,
                            inline: false
                        });
                    });

                    if (newRandomMovies[0]?.tmdbDetails?.poster_path) {
                        newEmbed.setThumbnail(`https://image.tmdb.org/t/p/w500${newRandomMovies[0].tmdbDetails.poster_path}`);
                    }

                    await i.update({ embeds: [newEmbed] });
                } else if (i.customId === 'list_all') {
                    await i.reply({ 
                        content: `Use \`/listmovies${genre ? ` genre:${genre}` : ''}\` to see all available movies!`, 
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', () => {
                // Disable buttons after timeout
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('get_details_1')
                            .setLabel('📖 Movie 1 Details')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('get_details_2')
                            .setLabel('📖 Movie 2 Details')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('get_details_3')
                            .setLabel('📖 Movie 3 Details')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );

                const disabledRow2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('another_random')
                            .setLabel('🎲 New Recommendations')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('list_all')
                            .setLabel('📋 List All Movies')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                
                interaction.editReply({ components: [disabledRow, disabledRow2] }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in randommovie command:', error);
            await interaction.editReply({
                content: '❌ There was an error while getting random movies!',
                ephemeral: true
            });
        }
    },
};