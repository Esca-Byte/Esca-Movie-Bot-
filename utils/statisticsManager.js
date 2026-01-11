const fs = require('fs');
const path = require('path');

const STATS_DB_PATH = path.join(__dirname, '../data/statistics.json');

/**
 * Reads statistics from JSON file
 */
function readStats() {
    try {
        if (!fs.existsSync(STATS_DB_PATH)) {
            const defaultStats = {
                botStats: {
                    totalCommands: 0,
                    totalMovies: 0,
                    totalRequests: 0,
                    uptime: {
                        startTime: null,
                        lastRestart: null
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
            };
            fs.writeFileSync(STATS_DB_PATH, JSON.stringify(defaultStats, null, 4));
            return defaultStats;
        }
        const data = fs.readFileSync(STATS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading statistics:', error);
        return {
            botStats: { totalCommands: 0, totalMovies: 0, totalRequests: 0, uptime: {}, commandUsage: {}, dailyStats: {} },
            userActivity: { userStats: {}, mostActiveUsers: [], topRequesters: [] },
            movieStats: { mostRequested: [], mostViewed: [], popularGenres: [], popularLanguages: [] },
            serverStats: { totalServers: 0, activeServers: 0, serverActivity: {} }
        };
    }
}

/**
 * Writes statistics to JSON file
 */
function writeStats(stats) {
    try {
        fs.writeFileSync(STATS_DB_PATH, JSON.stringify(stats, null, 4));
    } catch (error) {
        console.error('Error writing statistics:', error);
    }
}

/**
 * Increment command usage
 */
function incrementCommandUsage(commandName, userId) {
    const stats = readStats();
    
    // Update total commands
    stats.botStats.totalCommands++;
    
    // Update command usage
    if (!stats.botStats.commandUsage[commandName]) {
        stats.botStats.commandUsage[commandName] = 0;
    }
    stats.botStats.commandUsage[commandName]++;
    
    // Update user activity
    if (!stats.userActivity.userStats[userId]) {
        stats.userActivity.userStats[userId] = {
            totalCommands: 0,
            commandsUsed: {},
            lastActivity: null
        };
    }
    
    stats.userActivity.userStats[userId].totalCommands++;
    if (!stats.userActivity.userStats[userId].commandsUsed[commandName]) {
        stats.userActivity.userStats[userId].commandsUsed[commandName] = 0;
    }
    stats.userActivity.userStats[userId].commandsUsed[commandName]++;
    stats.userActivity.userStats[userId].lastActivity = new Date().toISOString();
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!stats.botStats.dailyStats[today]) {
        stats.botStats.dailyStats[today] = {
            commands: 0,
            requests: 0,
            moviesAdded: 0
        };
    }
    stats.botStats.dailyStats[today].commands++;
    
    writeStats(stats);
}

/**
 * Track movie request
 */
function trackMovieRequest(movieName, userId) {
    const stats = readStats();
    
    // Update total requests
    stats.botStats.totalRequests++;
    
    // Update user request count
    if (!stats.userActivity.userStats[userId]) {
        stats.userActivity.userStats[userId] = {
            totalCommands: 0,
            commandsUsed: {},
            requests: 0,
            lastActivity: null
        };
    }
    if (!stats.userActivity.userStats[userId].requests) {
        stats.userActivity.userStats[userId].requests = 0;
    }
    stats.userActivity.userStats[userId].requests++;
    stats.userActivity.userStats[userId].lastActivity = new Date().toISOString();
    
    // Update most requested movies
    const existingRequest = stats.movieStats.mostRequested.find(item => item.movieName.toLowerCase() === movieName.toLowerCase());
    if (existingRequest) {
        existingRequest.count++;
    } else {
        stats.movieStats.mostRequested.push({
            movieName: movieName,
            count: 1
        });
    }
    
    // Sort most requested
    stats.movieStats.mostRequested.sort((a, b) => b.count - a.count);
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!stats.botStats.dailyStats[today]) {
        stats.botStats.dailyStats[today] = {
            commands: 0,
            requests: 0,
            moviesAdded: 0
        };
    }
    stats.botStats.dailyStats[today].requests++;
    
    writeStats(stats);
}

/**
 * Track movie view (when getmovie is used)
 */
function trackMovieView(movieName) {
    const stats = readStats();
    
    const existingView = stats.movieStats.mostViewed.find(item => item.movieName.toLowerCase() === movieName.toLowerCase());
    if (existingView) {
        existingView.count++;
    } else {
        stats.movieStats.mostViewed.push({
            movieName: movieName,
            count: 1
        });
    }
    
    // Sort most viewed
    stats.movieStats.mostViewed.sort((a, b) => b.count - a.count);
    
    writeStats(stats);
}

/**
 * Update movie count
 */
function updateMovieCount(count) {
    const stats = readStats();
    stats.botStats.totalMovies = count;
    writeStats(stats);
}

/**
 * Set bot start time
 */
function setBotStartTime() {
    const stats = readStats();
    const now = new Date().toISOString();
    
    if (!stats.botStats.uptime.startTime) {
        stats.botStats.uptime.startTime = now;
    }
    stats.botStats.uptime.lastRestart = now;
    
    writeStats(stats);
}

/**
 * Get bot statistics
 */
function getBotStats() {
    const stats = readStats();
    return stats.botStats;
}

/**
 * Get user statistics
 */
function getUserStats(userId) {
    const stats = readStats();
    return stats.userActivity.userStats[userId] || null;
}

/**
 * Get most active users
 */
function getMostActiveUsers(limit = 10) {
    const stats = readStats();
    const users = Object.entries(stats.userActivity.userStats)
        .map(([userId, userData]) => ({
            userId,
            totalCommands: userData.totalCommands || 0,
            requests: userData.requests || 0,
            lastActivity: userData.lastActivity
        }))
        .sort((a, b) => b.totalCommands - a.totalCommands)
        .slice(0, limit);
    
    return users;
}

/**
 * Get top requesters
 */
function getTopRequesters(limit = 10) {
    const stats = readStats();
    const requesters = Object.entries(stats.userActivity.userStats)
        .filter(([userId, userData]) => userData.requests > 0)
        .map(([userId, userData]) => ({
            userId,
            requests: userData.requests,
            totalCommands: userData.totalCommands || 0,
            lastActivity: userData.lastActivity
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, limit);
    
    return requesters;
}

/**
 * Get most requested movies
 */
function getMostRequestedMovies(limit = 10) {
    const stats = readStats();
    return stats.movieStats.mostRequested.slice(0, limit);
}

/**
 * Get most viewed movies
 */
function getMostViewedMovies(limit = 10) {
    const stats = readStats();
    return stats.movieStats.mostViewed.slice(0, limit);
}

/**
 * Get command usage statistics
 */
function getCommandUsage() {
    const stats = readStats();
    return stats.botStats.commandUsage;
}

/**
 * Get daily statistics
 */
function getDailyStats(days = 7) {
    const stats = readStats();
    const dailyStats = stats.botStats.dailyStats;
    const sortedDays = Object.keys(dailyStats).sort().reverse().slice(0, days);
    
    return sortedDays.map(day => ({
        date: day,
        ...dailyStats[day]
    }));
}

/**
 * Calculate bot uptime
 */
function getBotUptime() {
    const stats = readStats();
    const startTime = stats.botStats.uptime.startTime;
    
    if (!startTime) {
        return null;
    }
    
    const start = new Date(startTime);
    const now = new Date();
    const uptime = now - start;
    
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds, totalMs: uptime };
}

module.exports = {
    incrementCommandUsage,
    trackMovieRequest,
    trackMovieView,
    updateMovieCount,
    setBotStartTime,
    getBotStats,
    getUserStats,
    getMostActiveUsers,
    getTopRequesters,
    getMostRequestedMovies,
    getMostViewedMovies,
    getCommandUsage,
    getDailyStats,
    getBotUptime
}; 