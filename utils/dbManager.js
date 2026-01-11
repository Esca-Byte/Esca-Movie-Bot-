const fs = require('fs');
const path = require('path');

// Define paths for data files
const MOVIES_DB_PATH = path.join(__dirname, '../data/movies.json');
const REQUESTS_DB_PATH = path.join(__dirname, '../data/requests.json');
const SETTINGS_DB_PATH = path.join(__dirname, '../data/settings.json');
const STATISTICS_DB_PATH = path.join(__dirname, '../data/statistics.json');
const UNSHORTENED_DB_PATH = path.join(__dirname, '../data/unshortened_links.json');

// Ensure data files exist
function ensureFilesExist() {
    const files = [
        { path: MOVIES_DB_PATH, defaultContent: '[]' },
        { path: REQUESTS_DB_PATH, defaultContent: '[]' },
        { path: SETTINGS_DB_PATH, defaultContent: '{"guildSettings":{}}' },
        { path: STATISTICS_DB_PATH, defaultContent: JSON.stringify({
            botStats: {
                totalCommands: 0,
                totalMovies: 0,
                totalRequests: 0,
                uptime: {
                    startTime: new Date().toISOString(),
                    lastRestart: new Date().toISOString()
                },
                commandUsage: {},
                dailyStats: {}
            },
            userActivity: {
                userStats: {},
                mostActiveUsers: [],
                topRequesters: []
            },
            movieStats: {
                mostRequested: [],
                mostViewed: [],
                popularGenres: [],
                popularLanguages: []
            },
            serverStats: {
                totalServers: 0,
                activeServers: 0,
                serverActivity: {}
            }
        }, null, 4) },
        { path: UNSHORTENED_DB_PATH, defaultContent: '[]' }
    ];

    files.forEach(file => {
        if (!fs.existsSync(file.path)) {
            fs.writeFileSync(file.path, file.defaultContent);
            console.log(`Created default ${path.basename(file.path)}`);
        }
    });
}

// Initialize data files
ensureFilesExist();

// Movie operations
function getMovies() {
    try {
        const data = fs.readFileSync(MOVIES_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading movies database:', error);
        return [];
    }
}

// Unshortened links operations (private store for admin)
function getUnshortenedLinks() {
    try {
        const data = fs.readFileSync(UNSHORTENED_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading unshortened links database:', error);
        return [];
    }
}

function addUnshortenedLink(entry) {
    const list = getUnshortenedLinks();
    // Keep simple shape: { name, link, addedAt }
    const record = {
        name: entry.name,
        link: entry.link,
        addedAt: new Date().toISOString()
    };
    list.push(record);
    fs.writeFileSync(UNSHORTENED_DB_PATH, JSON.stringify(list, null, 4));
    return record;
}

function getMovie(nameOrId) {
    const movies = getMovies();
    
    // First try to find by exact name match (case insensitive)
    const movieByName = movies.find(movie => 
        movie.name.toLowerCase() === nameOrId.toLowerCase()
    );
    
    if (movieByName) {
        return movieByName;
    }
    
    // Then try to find by alias match (case insensitive)
    const movieByAlias = movies.find(movie => 
        movie.aliases && Array.isArray(movie.aliases) && 
        movie.aliases.some(alias => alias.toLowerCase() === nameOrId.toLowerCase())
    );
    
    if (movieByAlias) {
        return movieByAlias;
    }
    
    // Finally try to find by ID (handle both string and numeric IDs)
    const movieById = movies.find(movie => {
        return movie.id === nameOrId || 
               movie.id === parseInt(nameOrId) || 
               movie.id.toString() === nameOrId.toString();
    });
    
    return movieById || null;
}

function addMovie(movie) {
    const movies = getMovies();
    
    // Generate a new ID if not provided
    if (!movie.id) {
        const maxId = movies.reduce((max, m) => Math.max(max, m.id || 0), 0);
        movie.id = maxId + 1;
    }
    
    // Add timestamp if not provided
    if (!movie.addedAt) {
        movie.addedAt = new Date().toISOString();
    }
    
    movies.push(movie);
    fs.writeFileSync(MOVIES_DB_PATH, JSON.stringify(movies, null, 4));
    return movie;
}

function updateMovie(id, updatedFields) {
    const movies = getMovies();
    
    // Convert id to string for consistent comparison since all IDs in database are strings
    const idString = String(id);
    
    const index = movies.findIndex(movie => {
        const movieIdString = String(movie.id);
        return movieIdString === idString;
    });
    
    if (index === -1) return false;
    
    // Update the movie with new fields
    movies[index] = { ...movies[index], ...updatedFields };
    
    // Add updated timestamp
    movies[index].updatedAt = new Date().toISOString();
    
    fs.writeFileSync(MOVIES_DB_PATH, JSON.stringify(movies, null, 4));
    return true;
}

function deleteMovie(id) {
    console.log(`[DEBUG] deleteMovie called with ID: ${id} (type: ${typeof id})`);
    
    const movies = getMovies();
    console.log(`[DEBUG] Total movies before deletion: ${movies.length}`);
    
    const originalLength = movies.length;
    
    // Convert id to string for consistent comparison since all IDs in database are strings
    const idString = String(id);
    
    const filteredMovies = movies.filter(movie => {
        const movieIdString = String(movie.id);
        const shouldKeep = movieIdString !== idString;
        if (!shouldKeep) {
            console.log(`[DEBUG] Found movie to delete: ${movie.name} (ID: ${movie.id})`);
        }
        return shouldKeep;
    });
    
    console.log(`[DEBUG] Movies after filtering: ${filteredMovies.length}`);
    
    if (filteredMovies.length === originalLength) {
        console.log(`[DEBUG] No movie was deleted - ID ${id} not found`);
        return false;
    }
    
    try {
        fs.writeFileSync(MOVIES_DB_PATH, JSON.stringify(filteredMovies, null, 4));
        console.log(`[DEBUG] Successfully wrote ${filteredMovies.length} movies to database`);
        return true;
    } catch (error) {
        console.error(`[DEBUG] Error writing to database:`, error);
        return false;
    }
}

// Request operations
function getRequests() {
    try {
        const data = fs.readFileSync(REQUESTS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading requests database:', error);
        return [];
    }
}

function addRequest(request) {
    const requests = getRequests();
    
    // Generate a new ID if not provided
    if (!request.id) {
        const maxId = requests.reduce((max, r) => Math.max(max, r.id || 0), 0);
        request.id = maxId + 1;
    }
    
    // Add timestamp if not provided
    if (!request.requestedAt) {
        request.requestedAt = new Date().toISOString();
    }
    
    // Set default status if not provided
    if (!request.status) {
        request.status = 'pending';
    }
    
    requests.push(request);
    fs.writeFileSync(REQUESTS_DB_PATH, JSON.stringify(requests, null, 4));
    return request;
}

function updateRequestStatus(requestId, status, additionalFields = {}) {
    const requests = getRequests();
    const index = requests.findIndex(req => req.id === requestId);
    
    if (index === -1) return false;
    
    // Update status and additional fields
    requests[index] = { 
        ...requests[index], 
        status, 
        ...additionalFields,
        updatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(REQUESTS_DB_PATH, JSON.stringify(requests, null, 4));
    return true;
}

function removeRequest(requestId) {
    const requests = getRequests();
    const filteredRequests = requests.filter(req => req.id !== requestId);
    
    if (filteredRequests.length === requests.length) return false;
    
    fs.writeFileSync(REQUESTS_DB_PATH, JSON.stringify(filteredRequests, null, 4));
    return true;
}

// Settings operations
function getSettings() {
    try {
        const data = fs.readFileSync(SETTINGS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading settings database:', error);
        return { guildSettings: {} };
    }
}

function updateSettings(newSettings) {
    fs.writeFileSync(SETTINGS_DB_PATH, JSON.stringify(newSettings, null, 4));
    return true;
}

// Statistics operations
function getStatistics() {
    try {
        const data = fs.readFileSync(STATISTICS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading statistics database:', error);
        return {
            botStats: { totalCommands: 0, totalMovies: 0, totalRequests: 0 },
            userActivity: { userStats: {} },
            movieStats: {},
            serverStats: { totalServers: 0 }
        };
    }
}

function updateStatistics(newStats) {
    fs.writeFileSync(STATISTICS_DB_PATH, JSON.stringify(newStats, null, 4));
    return true;
}

// Guild-specific settings operations
function setMovieChannel(guildId, channelId) {
    const settings = getSettings();
    
    // Ensure guildSettings exists
    if (!settings.guildSettings) {
        settings.guildSettings = {};
    }
    
    // Ensure this guild's settings exist
    if (!settings.guildSettings[guildId]) {
        settings.guildSettings[guildId] = {};
    }
    
    // Set the movie channel ID
    settings.guildSettings[guildId].movieChannelId = channelId;
    
    // Save the updated settings
    updateSettings(settings);
    return true;
}

function getGuildSettings(guildId) {
    const settings = getSettings();
    return settings.guildSettings && settings.guildSettings[guildId] ? settings.guildSettings[guildId] : null;
}

// Search movies function using the same logic as getmovie command
function searchMovies(searchTerm) {
    if (!searchTerm) return [];
    
    const movies = getMovies();
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // Find candidates that match the search term
    const candidates = movies.filter(m => {
        const nameMatch = m.name && m.name.toLowerCase().includes(normalizedSearch);
        const aliasMatch = m.aliases && Array.isArray(m.aliases) && m.aliases.some(a => a.toLowerCase().includes(normalizedSearch));
        const tmdbTitle = m.tmdbDetails && m.tmdbDetails.title ? m.tmdbDetails.title.toLowerCase() : '';
        const tmdbMatch = tmdbTitle && tmdbTitle.includes(normalizedSearch) && tmdbTitle !== (m.name || '').toLowerCase();
        return nameMatch || aliasMatch || tmdbMatch;
    });
    
    // Sort candidates by relevance (same logic as getmovie)
    candidates.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        
        // Exact matches first
        const aExact = aName === normalizedSearch;
        const bExact = bName === normalizedSearch;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Starts with search term
        const aStarts = aName.startsWith(normalizedSearch);
        const bStarts = bName.startsWith(normalizedSearch);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Position of search term in name
        const aIdx = aName.indexOf(normalizedSearch);
        const bIdx = bName.indexOf(normalizedSearch);
        if (aIdx !== bIdx) return aIdx - bIdx;
        
        // Shorter names first
        return aName.length - bName.length;
    });
    
    return candidates;
}

module.exports = {
    getMovies,
    getMovie,
    addMovie,
    updateMovie,
    deleteMovie,
    getUnshortenedLinks,
    addUnshortenedLink,
    getRequests,
    addRequest,
    updateRequestStatus,
    removeRequest,
    getSettings,
    updateSettings,
    getStatistics,
    updateStatistics,
    setMovieChannel,
    getGuildSettings,
    searchMovies
};