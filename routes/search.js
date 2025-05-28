const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search');

// SEO-friendly search route
router.get('/:query', searchController.searchMovies);

// Legacy support for form submissions
router.get('/', searchController.searchMovies);
router.post('/', searchController.searchMovies);

// Auto-suggest API route
router.get('/api/suggest', searchController.autoSuggestMovies);

module.exports = router;