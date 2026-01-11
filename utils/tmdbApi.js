const axios = require('axios'); // Correct import for axios
require('dotenv').config(); // Load environment variables

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Create axios instance with timeout and retry configuration
const tmdbAxios = axios.create({
    timeout: 30000, // 30 second timeout
    headers: {
        'User-Agent': 'Discord-Movie-Bot/1.0',
        'Accept': 'application/json'
    }
});

// Don't exit if TMDB API key is missing - just log a warning
if (!TMDB_API_KEY) {
    console.warn("TMDB_API_KEY is not set in your .env file. TMDB integration will be disabled.");
}

/**
 * Searches TMDB for movies or TV shows and fetches their details.
 * Prioritizes the first result from a 'multi' search.
 * @param {string} query - The search query (movie/TV show name) or TMDB ID.
 * @param {string} mediaType - Optional media type ('movie' or 'tv') to limit search.
 * @returns {Object|null} The detailed TMDB object for the best match, or null if not found/error.
 */
async function searchAndGetDetails(query, mediaType = null) {
    // If no API key is configured, return null immediately
    if (!TMDB_API_KEY) {
        console.log(`[TMDB] API key not configured, skipping search for "${query}"`);
        return null;
    }

    try {
        // Check if query is a TMDB ID (numeric string)
        const isNumericId = /^\d+$/.test(query.trim());
        
        if (isNumericId) {
            // Direct ID lookup - try both movie and TV endpoints
            console.log(`[TMDB] Direct ID lookup for ID: ${query}`);
            
            // Determine which endpoint to use based on mediaType parameter
            if (mediaType === 'movie') {
                try {
                    const detailsResponse = await retryRequest(async () => {
                        return await tmdbAxios.get(`${TMDB_BASE_URL}/movie/${query}`, {
                            params: { api_key: TMDB_API_KEY }
                        });
                    }, 3, query);
                    return { ...detailsResponse.data, media_type: 'movie' };
                } catch (error) {
                    console.warn(`[TMDB] Movie ID ${query} not found, trying TV endpoint...`);
                }
            } else if (mediaType === 'tv') {
                try {
                    const detailsResponse = await retryRequest(async () => {
                        return await tmdbAxios.get(`${TMDB_BASE_URL}/tv/${query}`, {
                            params: { api_key: TMDB_API_KEY }
                        });
                    }, 3, query);
                    return { ...detailsResponse.data, media_type: 'tv' };
                } catch (error) {
                    console.warn(`[TMDB] TV ID ${query} not found, trying movie endpoint...`);
                }
            } else {
                // No media type specified, try both endpoints
                try {
                    // Try movie first
                    const movieResponse = await retryRequest(async () => {
                        return await tmdbAxios.get(`${TMDB_BASE_URL}/movie/${query}`, {
                            params: { api_key: TMDB_API_KEY }
                        });
                    }, 3, query);
                    return { ...movieResponse.data, media_type: 'movie' };
                } catch (movieError) {
                    try {
                        // Try TV if movie fails
                        const tvResponse = await retryRequest(async () => {
                            return await tmdbAxios.get(`${TMDB_BASE_URL}/tv/${query}`, {
                                params: { api_key: TMDB_API_KEY }
                            });
                        }, 3, query);
                        return { ...tvResponse.data, media_type: 'tv' };
                    } catch (tvError) {
                        console.warn(`[TMDB] ID ${query} not found in either movie or TV databases`);
                        return null;
                    }
                }
            }
        }

        // Regular text search
        let searchEndpoint = '/search/multi';
        let searchParams = {
            api_key: TMDB_API_KEY,
            query: query,
            include_adult: false
        };

        // If media type is specified, use specific search endpoint
        if (mediaType === 'movie') {
            searchEndpoint = '/search/movie';
        } else if (mediaType === 'tv') {
            searchEndpoint = '/search/tv';
        }

        // Step 1: Search using the appropriate endpoint
        const searchResponse = await retryRequest(async () => {
            return await tmdbAxios.get(`${TMDB_BASE_URL}${searchEndpoint}`, {
                params: searchParams
            });
        }, 3, query);

        const results = searchResponse.data.results;
        if (results.length === 0) {
            return null; // No results found
        }

        // Find the best match, usually the first one or one with higher popularity
        const bestMatch = results.find(item =>
            item.title?.toLowerCase() === query.toLowerCase() ||
            item.name?.toLowerCase() === query.toLowerCase()
        ) || results[0]; // Fallback to the first result if no exact match

        // Step 2: Fetch full details based on media_type (movie or tv)
        let detailsResponse;
        if (bestMatch.media_type === 'movie') {
            detailsResponse = await retryRequest(async () => {
                return await tmdbAxios.get(`${TMDB_BASE_URL}/movie/${bestMatch.id}`, {
                    params: { api_key: TMDB_API_KEY }
                });
            }, 3, query);
        } else if (bestMatch.media_type === 'tv') {
            detailsResponse = await retryRequest(async () => {
                return await tmdbAxios.get(`${TMDB_BASE_URL}/tv/${bestMatch.id}`, {
                    params: { api_key: TMDB_API_KEY }
                });
            }, 3, query);
        } else {
            console.warn(`[TMDB] Unsupported media type: ${bestMatch.media_type}`);
            return null;
        }

        // Return combined details, ensuring media_type is included
        return { ...detailsResponse.data, media_type: bestMatch.media_type };

    } catch (error) {
        console.error(`[TMDB API Error] while searching for "${query}":`,
            error.response ? error.response.data : error.message);
        
        // Enhanced error logging for debugging
        if (error.code === 'ETIMEDOUT') {
            console.error(`[TMDB] Connection timeout for "${query}" - Check network connectivity`);
        } else if (error.code === 'ECONNREFUSED') {
            console.error(`[TMDB] Connection refused for "${query}" - TMDB API might be down`);
        } else if (error.code === 'ENOTFOUND') {
            console.error(`[TMDB] DNS resolution failed for "${query}" - Check DNS settings`);
        }
        
        return null;
    }
}

/**
 * Retry function with exponential backoff for network requests
 * @param {Function} requestFunction - The async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {string} query - Query string for logging purposes
 * @returns {Promise} The result of the successful request
 */
async function retryRequest(requestFunction, maxRetries = 3, query = 'unknown') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[TMDB] Attempt ${attempt}/${maxRetries} for "${query}"`);
            const result = await requestFunction();
            
            if (attempt > 1) {
                console.log(`[TMDB] Success on attempt ${attempt} for "${query}"`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            console.warn(`[TMDB] Attempt ${attempt}/${maxRetries} failed for "${query}":`, 
                error.code || error.message);
            
            // Don't retry on certain errors
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                console.log(`[TMDB] Not retrying ${error.response.status} error for "${query}"`);
                throw error;
            }
            
            // Wait before retrying (exponential backoff)
            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`[TMDB] Waiting ${waitTime}ms before retry ${attempt + 1} for "${query}"`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // All retries failed
    console.error(`[TMDB] All ${maxRetries} attempts failed for "${query}"`);
    throw lastError;
}

module.exports = {
    searchAndGetDetails
};