const express = require('express');
const profileController = require('../controllers/profile');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/img/img_user'));
    },
    filename: (req, file, cb) => {
        const userId = req.session.user.ID_U;
        cb(null, `${userId}.png`);
    }
});

const upload = multer({ storage });

<<<<<<< HEAD
=======
// Middleware to restrict access to admin_role_1
const restrictToAdminRole1 = (req, res, next) => {
    if (!req.session.user || req.session.user.VaiTro !== 'admin_role_1') {
        return res.redirect('/profile');
    }
    next();
};

>>>>>>> feature/adminrole1
router.get('/', profileController.refreshSession, profileController.getProfile);
router.post('/edit', profileController.editProfile);
router.post('/upload-avatar', upload.single('avatar'), profileController.uploadAvatar);
router.get('/avatar/:id', profileController.getAvatar);
router.get('/history', profileController.getHistory);
<<<<<<< HEAD
module.exports = router;
=======

// Admin routes
router.get('/admin/theaters', restrictToAdminRole1, profileController.getTheaters);
router.post('/admin/theaters/add', restrictToAdminRole1, profileController.addTheater);
router.get('/admin/movies', restrictToAdminRole1, profileController.getMovies);
router.post('/admin/movies/add', restrictToAdminRole1, profileController.addMovie);
router.post('/admin/movies/edit/:id', restrictToAdminRole1, profileController.editMovie);
router.get('/admin/showtimes', restrictToAdminRole1, profileController.getShowtimes);
router.post('/admin/showtimes/add', restrictToAdminRole1, profileController.addShowtime);
router.post('/admin/showtimes/delete/:id', restrictToAdminRole1, profileController.deleteShowtime);
router.get('/admin/rooms', restrictToAdminRole1, profileController.getRooms);
router.post('/admin/rooms/add', restrictToAdminRole1, profileController.addRoom);
router.get('/admin/seats', restrictToAdminRole1, profileController.getSeats);
router.post('/admin/seats/add', restrictToAdminRole1, profileController.addSeat);

module.exports = router;

// CHANGES FOR ADMIN ROLE 1
// Added restrictToAdminRole1 middleware to restrict routes to admin_role_1 users
// Added routes for managing theaters, movies, showtimes, rooms, and seats
>>>>>>> feature/adminrole1
