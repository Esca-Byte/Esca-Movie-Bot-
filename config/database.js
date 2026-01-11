
module.exports = {
    // Database configuration
    database: {
        // Always use JSON files
        type: 'json',
        paths: {
            movies: './data/movies.json',
            requests: './data/requests.json',
            settings: './data/settings.json',
            statistics: './data/statistics.json'
        }
    }
};
