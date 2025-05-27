const express = require('express');
const profileController = require('../controllers/profile');
const multer = require('multer');
const path = require('path');
<<<<<<< HEAD

const router = express.Router();

// Configure multer for avatar uploads
=======
const router = express.Router();

// Cấu hình multer để lưu trữ ảnh đại diện, anh sẽ được lưu trong thư mục public/img/img_user
>>>>>>> refs/remotes/origin/develop
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/img/img_user'));
    },
    filename: (req, file, cb) => {
        const userId = req.session.user.ID_U;
<<<<<<< HEAD
        cb(null, `${userId}.png`);
    }
});

const upload = multer({ storage });

// Middleware to restrict access to admin_role_1
=======
        cb(null, `${userId}.webp`);
    }
});
const upload = multer({ storage });

// Middleware để kiểm tra quyền truy cập cho admin_role_1, muốn chuyển sang admin_role_1 thì dưới bảng user thuộc tính vai trò sẽ là admin_role_1
>>>>>>> refs/remotes/origin/develop
const restrictToAdminRole1 = (req, res, next) => {
    if (!req.session.user || req.session.user.VaiTro !== 'admin_role_1') {
        return res.redirect('/profile');
    }
    next();
};

<<<<<<< HEAD
=======
// Các route dành cho người dùng truy cập vào trang profile có vai trò là KhachHang
>>>>>>> refs/remotes/origin/develop
router.get('/', profileController.refreshSession, profileController.getProfile);
router.post('/edit', profileController.editProfile);
router.post('/upload-avatar', upload.single('avatar'), profileController.uploadAvatar);
router.get('/avatar/:id', profileController.getAvatar);
<<<<<<< HEAD
router.get('/history', profileController.getHistory);

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
=======
router.get('/poster/:id', profileController.getPoster);
router.post('/upload-poster', profileController.uploadPoster);
router.get('/history', profileController.getHistory);

// Các route dành cho người dùng truy cập vào trang profile có vai trò là admin_role_1
router.get('/admin/theaters', restrictToAdminRole1, profileController.getTheaters);
router.post('/admin/theaters/add', restrictToAdminRole1, profileController.addTheater);
router.post('/admin/theaters/delete', restrictToAdminRole1, profileController.deleteTheater);
router.get('/admin/movies', restrictToAdminRole1, profileController.getMovies);
router.post('/admin/movies/add', restrictToAdminRole1, profileController.addMovie);
router.post('/admin/movies/edit/:id', restrictToAdminRole1, profileController.editMovie);
router.post('/admin/movies/delete', restrictToAdminRole1, profileController.deleteMovie);
router.get('/admin/showtimes', restrictToAdminRole1, profileController.getShowtimes);
router.post('/admin/showtimes/add', restrictToAdminRole1, profileController.addShowtime);
router.post('/admin/showtimes/delete', restrictToAdminRole1, profileController.deleteShowtime);
router.get('/admin/rooms', restrictToAdminRole1, profileController.getRooms);
router.post('/admin/rooms/add', restrictToAdminRole1, profileController.addRoom);
router.post('/admin/rooms/delete', restrictToAdminRole1, profileController.deleteRoom);

module.exports = router;
>>>>>>> refs/remotes/origin/develop
