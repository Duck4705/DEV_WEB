// Thêm thư viện ở dươi dòng này
const express = require('express');
const router = express.Router();
const movieDetailsController = require('../controllers/movie_details'); 

// Route chi tiết phim
router.get('/showing', movieDetailsController.getMovieShowing);
router.get('/:ID_P', movieDetailsController.getMovieDetails);
router.get('/get_seat/:ID_SC', movieDetailsController.getSeatDetails);

module.exports = router;