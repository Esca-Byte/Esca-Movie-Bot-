const { EmbedBuilder } = require('discord.js');

/**
 * Creates a Discord embed for displaying movie/webseries information.
 * @param {Object} movie - The movie object from your database.
 * @param {boolean} isNew - Whether this embed is for a newly added movie (influences color).
 * @returns {EmbedBuilder} The configured Discord embed.
 */
function createMovieEmbed(movie, isNew = false) {
    const title = movie.name || 'Unknown Title';
    const description = movie.tmdbDetails?.overview || 'No description available.';
    const color = isNew ? 0x00FF00 : 0x0099FF;
    
    // Handle poster/thumbnail - prioritize custom poster URL if available, then TMDB poster
    let thumbnailUrl = null;
    if (movie.customPosterUrl) {
        thumbnailUrl = movie.customPosterUrl;
    } else if (movie.tmdbDetails?.poster_path) {
        thumbnailUrl = `https://image.tmdb.org/t/p/w500${movie.tmdbDetails.poster_path}`;
    }
    
    const releaseDate = movie.tmdbDetails?.release_date || 'N/A';
    const voteAverage = movie.tmdbDetails?.vote_average;
    const genres = movie.tmdbDetails?.genres?.map(g => g.name).join(', ') || 'N/A';
    
    // Format language display - handle both old single language and new multiple languages
    let languageDisplay = 'N/A';
    if (movie.languages && Array.isArray(movie.languages) && movie.languages.length > 0) {
        // New format - multiple languages
        languageDisplay = movie.languages.map(lang => 
            lang.charAt(0).toUpperCase() + lang.slice(1)
        ).join(', ');
    } else if (movie.language) {
        // Old format - single language (for backward compatibility)
        languageDisplay = movie.language.charAt(0).toUpperCase() + movie.language.slice(1);
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    // --- Handle Multiple Watch Links ---
    if (movie.watchLinks && Object.keys(movie.watchLinks).length > 0) {
        let watchLinksField = '';
        for (const quality in movie.watchLinks) {
            const link = movie.watchLinks[quality];
            watchLinksField += `• **${quality.toUpperCase()}**: [Click Here](${link})\n`;
        }
        embed.addFields({ name: 'Watch Links', value: watchLinksField.trim(), inline: false });
    } else {
        // Fallback for old single watchLink or if no links are provided
        if (movie.watchLink) { // 'movie.watchLink' might exist from old entries
            embed.addFields({ name: 'Watch Link', value: `[Click Here](${movie.watchLink})`, inline: false });
        } else {
            embed.addFields({ name: 'Watch Links', value: 'No watch links available.', inline: false });
        }
    }
    // --- End Handle Multiple Watch Links ---

    // Add language field first, then other details
    embed.addFields(
        { name: movie.languages && movie.languages.length > 1 ? 'Languages' : 'Language', value: languageDisplay, inline: true },
        { name: 'Release Date', value: releaseDate, inline: true },
        { name: 'Rating', value: voteAverage ? `${voteAverage.toFixed(1)}/10` : 'N/A', inline: true }
    );

    if (genres !== 'N/A') {
        embed.addFields({ name: 'Genres', value: genres, inline: true });
    }

    if (movie.screenshotLinks && movie.screenshotLinks.length > 0) {
        embed.setImage(movie.screenshotLinks[0]);
    }

    // Update footer to indicate data source
    const footerText = movie.tmdbDetails?.tmdb_id ? 'Powered by Esca' : 'Custom Entry';
    embed.setFooter({ text: footerText });

    return embed;
}

/**
 * Creates a Discord embed for movie request notifications.
 * @param {Object} request - The request object.
 * @returns {EmbedBuilder} The configured Discord embed.
 */
function createRequestEmbed(request) {
    return new EmbedBuilder()
        .setTitle(`📢 New Movie Request: ${request.movieName}`)
        .setDescription(`**Requested By:** <@${request.requestedBy}>\n**Requested At:** <t:${Math.floor(new Date(request.requestedAt).getTime() / 1000)}:F>`)
        .setColor(0xFFA500)
        .setFooter({ text: `Request ID: ${request.id}` })
        .setTimestamp(new Date(request.requestedAt));
}


module.exports = {
    createMovieEmbed,
    createRequestEmbed
};