// Thêm thư viện ở dươi dòng này
const express = require('express');
const router = express.Router();
const movieDetailsController = require('../controllers/movie_details'); 

// Route chi tiết phim - Friendly URLs
router.get('/showing', movieDetailsController.getMovieShowing);
router.get('/search', movieDetailsController.searchMovies);
router.get('/seats/:ID_SC', movieDetailsController.getSeatDetails);    // Đặt trước để tránh xung đột với slug route
router.get('/:slug', movieDetailsController.getMovieDetails);          // Đổi từ ID_P sang slug

module.exports = router;