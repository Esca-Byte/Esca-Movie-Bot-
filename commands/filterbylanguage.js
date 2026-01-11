const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../utils/dbManager');
const statisticsManager = require('../utils/statisticsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filterbylanguage')
        .setDescription('🌍 Filter movies by language with popular presets')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Select language to filter by')
                .setRequired(true)
                .addChoices(
                    { name: '🇺🇸 English', value: 'english' },
                    { name: '🇮🇳 Hindi', value: 'hindi' },
                    { name: '🇯🇵 Japanese', value: 'japanese' },
                    { name: '🇰🇷 Korean', value: 'korean' },
                    { name: '🇪🇸 Spanish', value: 'spanish' },
                    { name: '🇫🇷 French', value: 'french' },
                    { name: '🇩🇪 German', value: 'german' },
                    { name: '🇮🇹 Italian', value: 'italian' },
                    { name: '🇨🇳 Chinese', value: 'chinese' },
                    { name: '🇷🇺 Russian', value: 'russian' },
                    { name: '🇧🇷 Portuguese', value: 'portuguese' },
                    { name: '🇸🇪 Swedish', value: 'swedish' },
                    { name: '🇹🇭 Thai', value: 'thai' },
                    { name: '🇹🇷 Turkish', value: 'turkish' },
                    { name: '🌏 Other', value: 'other' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const language = interaction.options.getString('language').toLowerCase();
            
            // Get all movies from dbManager
            const allMovies = dbManager.getMovies();
            
            // Filter movies by language
            const filteredMovies = allMovies.filter(movie => {
                // Check in multiple places where language info might be stored
                const movieLanguage = 
                    (movie.language || '').toLowerCase() || 
                    (movie.tmdbDetails?.original_language || '').toLowerCase() ||
                    '';
                
                // For 'other', return movies that don't match common languages
                if (language === 'other') {
                    const commonLanguages = ['english', 'hindi', 'japanese', 'korean', 'spanish', 
                                           'french', 'german', 'italian', 'chinese', 'russian',
                                           'portuguese', 'swedish', 'thai', 'turkish'];
                    return !commonLanguages.some(lang => movieLanguage.includes(lang));
                }
                
                // For specific languages, check if the movie language includes the selected language
                return movieLanguage.includes(language);
            });
            
            // Track command usage
            statisticsManager.incrementCommandUsage('filterbylanguage', interaction.user.id);
            
            if (filteredMovies.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle(`🌍 No ${capitalizeFirstLetter(language)} Movies Found`)
                    .setColor(0xFFAA00)
                    .setDescription(`We couldn't find any movies in ${capitalizeFirstLetter(language)} in our database.`)
                    .addFields({
                        name: '💡 Suggestions',
                        value: 'Try another language or use `/requestmovie` to request movies in this language.',
                        inline: false
                    })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [noResultsEmbed] });
            }
            
            // Sort movies by popularity or rating if available
            filteredMovies.sort((a, b) => {
                const ratingA = a.tmdbDetails?.vote_average || 0;
                const ratingB = b.tmdbDetails?.vote_average || 0;
                return ratingB - ratingA;
            });
            
            // Create pagination
            const moviesPerPage = 10;
            const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
            const currentPage = 1;
            
            // Create embed for current page
            const embed = createLanguageResultsEmbed(filteredMovies, language, currentPage, totalPages, moviesPerPage);
            
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
                    const newEmbed = createLanguageResultsEmbed(filteredMovies, language, currentPageState, totalPages, moviesPerPage);
                    
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
                    const newEmbed = createLanguageResultsEmbed(filteredMovies, language, currentPageState, totalPages, moviesPerPage);
                    
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
                        content: `🎲 **Random ${capitalizeFirstLetter(language)} Movie:** ${randomMovie.name}\n\nUse \`/getmovie name:${randomMovie.name}\` to see details and watch link!`,
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
            console.error('Error in filterbylanguage command:', error);
            await interaction.editReply({
                content: '❌ There was an error while filtering movies by language!',
                ephemeral: true
            });
        }
    },
};

// Helper function to create embed for language results
function createLanguageResultsEmbed(movies, language, currentPage, totalPages, moviesPerPage) {
    const startIdx = (currentPage - 1) * moviesPerPage;
    const endIdx = Math.min(startIdx + moviesPerPage, movies.length);
    const currentMovies = movies.slice(startIdx, endIdx);
    
    const languageEmoji = getLanguageEmoji(language);
    const embed = new EmbedBuilder()
        .setTitle(`${languageEmoji} ${capitalizeFirstLetter(language)} Movies & Shows (${movies.length})`)
        .setColor(0x00D4AA)
        .setDescription(`Showing results ${startIdx + 1}-${endIdx} of ${movies.length} ${capitalizeFirstLetter(language)} titles.`)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • Use /getmovie for details` })
        .setTimestamp();
    
    // Add movie list to embed
    let movieList = '';
    currentMovies.forEach((movie, index) => {
        const year = movie.tmdbDetails?.release_date ? 
            new Date(movie.tmdbDetails.release_date).getFullYear() : 
            (movie.year || '????');
        
        const rating = movie.tmdbDetails?.vote_average ? 
            `⭐${movie.tmdbDetails.vote_average.toFixed(1)}` : '';
        
        movieList += `${startIdx + index + 1}. **${movie.name}** (${year}) ${rating}\n`;
    });
    
    embed.addFields({ name: 'Available Titles', value: movieList || 'No movies found' });
    
    return embed;
}

// Helper function to get emoji for language
function getLanguageEmoji(language) {
    const emojiMap = {
        'english': '🇺🇸',
        'hindi': '🇮🇳',
        'japanese': '🇯🇵',
        'korean': '🇰🇷',
        'spanish': '🇪🇸',
        'french': '🇫🇷',
        'german': '🇩🇪',
        'italian': '🇮🇹',
        'chinese': '🇨🇳',
        'russian': '🇷🇺',
        'portuguese': '🇧🇷',
        'swedish': '🇸🇪',
        'thai': '🇹🇭',
        'turkish': '🇹🇷',
        'other': '🌏'
    };
    return emojiMap[language] || '🌐';
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
