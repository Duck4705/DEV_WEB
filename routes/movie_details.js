const express = require('express');
const router = express.Router();
const movieDetailsController = require('../controllers/movie_details'); // Import controller

// Route chi tiết phim
router.get('/showing', movieDetailsController.getMovieShowing);
router.get('/:ID_P', movieDetailsController.getMovieDetails);

module.exports = router;