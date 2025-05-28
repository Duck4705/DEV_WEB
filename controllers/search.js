const db = require('../db');

// Helper function to clean and format search terms for URLs
const formatForUrl = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')                     // Normalize to decomposed form
        .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics
        .replace(/[^\w\s-]/g, '')            // Remove special characters
        .replace(/\s+/g, '-')                // Replace spaces with hyphens
        .replace(/-+/g, '-');                // Remove consecutive hyphens
};

// Helper function to normalize search text for comparison
const normalizeSearchText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')                    // Normalize to decomposed form
        .replace(/[\u0300-\u036f]/g, '')    // Remove diacritics
        .replace(/[^\w\s]/g, ' ')           // Replace special chars with space
        .replace(/\s+/g, ' ')               // Normalize spaces
        .trim();
};

// Search movies and render results
const searchMovies = async (req, res) => {
    try {
        // Get query from either URL parameter or query string
        let query = req.params.query || req.query.query || req.body.query || '';
        
        // If query is URL-formatted (contains hyphens), convert back to spaces
        if (query && query.includes('-')) {
            query = query.replace(/-/g, ' ');
        }
        
        // If no query, just render the showing template with no results
        if (!query.trim()) {
            return res.render('showing', {
                phim: [],
                searchQuery: ''
            });
        }

        // Normalize the search query
        const normalizedQuery = normalizeSearchText(query);
        const searchTerms = normalizedQuery.split(' ').filter(term => term.length > 0);

        try {
            // Search for movies using a more flexible matching approach
            const searchSql = `
                SELECT * FROM phim 
                WHERE LOWER(CONVERT(TenPhim USING utf8)) COLLATE utf8_unicode_ci LIKE ? 
                OR LOWER(CONVERT(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(TenPhim, 'á', 'a'),
                                    'à', 'a'),
                                'ả', 'a'),
                            'ã', 'a'),
                        'ạ', 'a')
                    USING utf8)) LIKE ?
            `;
            
            // Create search patterns for each term
            const searchPatterns = searchTerms.map(term => `%${term}%`);
            
            // Execute search for each term
            let allResults = [];
            for (const pattern of searchPatterns) {
                const [results] = await db.execute(searchSql, [pattern, pattern]);
                allResults = [...allResults, ...results];
            }

            // Remove duplicates based on ID_P
            const uniqueResults = Array.from(new Map(allResults.map(movie => [movie.ID_P, movie])).values());

            // Sort results by relevance (exact matches first)
            const sortedResults = uniqueResults.sort((a, b) => {
                const aTitle = normalizeSearchText(a.TenPhim);
                const bTitle = normalizeSearchText(b.TenPhim);
                const aExact = aTitle === normalizedQuery ? 0 : 1;
                const bExact = bTitle === normalizedQuery ? 0 : 1;
                return aExact - bExact;
            });

            // If we find exactly one match, redirect to that movie's details
            if (sortedResults.length === 1) {
                return res.redirect(`/movie_details/${sortedResults[0].ID_P}`);
            }

            // If multiple or no matches, show the results page
            res.render('showing', {
                phim: sortedResults,
                searchQuery: query,
                toast: sortedResults.length === 0 ? {
                    type: 'info',
                    message: 'Không tìm thấy phim phù hợp!'
                } : null
            });
        } catch (dbError) {
            console.error('Database error:', dbError);
            throw dbError;
        }
    } catch (error) {
        console.error('Search error:', error);
        res.render('showing', {
            phim: [],
            searchQuery: query || '',
            toast: {
                type: 'error',
                message: 'Có lỗi xảy ra khi tìm kiếm!'
            }
        });
    }
};

// Auto-suggest API endpoint
const autoSuggestMovies = async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) {
            return res.json([]);
        }

        // Normalize the search query
        const normalizedQuery = normalizeSearchText(query);
        const searchTerms = normalizedQuery.split(' ').filter(term => term.length > 0);

        // Build the search SQL with flexible matching
        const searchSql = `
            SELECT DISTINCT ID_P, TenPhim 
            FROM phim 
            WHERE LOWER(CONVERT(TenPhim USING utf8)) COLLATE utf8_unicode_ci LIKE ? 
            OR LOWER(CONVERT(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(TenPhim, 'á', 'a'),
                                'à', 'a'),
                            'ả', 'a'),
                        'ã', 'a'),
                    'ạ', 'a')
                USING utf8)) LIKE ?
            LIMIT 5
        `;

        let allResults = [];
        for (const term of searchTerms) {
            const pattern = `%${term}%`;
            const [results] = await db.execute(searchSql, [pattern, pattern]);
            allResults = [...allResults, ...results];
        }

        // Remove duplicates and limit to 5 results
        const uniqueResults = Array.from(new Map(allResults.map(movie => [movie.ID_P, movie])).values())
            .slice(0, 5);
        
        // Format response with movie IDs, names, and SEO-friendly URLs
        const suggestions = uniqueResults.map(movie => ({
            id: movie.ID_P,
            title: movie.TenPhim,
            poster: `/img/img_poster/${movie.ID_P}.webp`,
            url: `/search/${formatForUrl(movie.TenPhim)}`
        }));

        res.json(suggestions);
    } catch (error) {
        console.error('Auto-suggest error:', error);
        res.status(500).json([]);
    }
};

module.exports = {
    searchMovies,
    autoSuggestMovies,
    formatForUrl
}; 