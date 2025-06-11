const express = require('express');
const profileController = require('../controllers/profile');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Cấu hình multer để lưu trữ ảnh đại diện và poster phim
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/img/img_user'));
    },
    filename: (req, file, cb) => {
        const userId = req.session.user.ID_U;
        cb(null, `${userId}.png`);
    }
});
const avatarUpload = multer({ storage: avatarStorage });

// For movie poster uploads, set up multer properly
const posterStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/img/img_poster');
        // Ensure directory exists
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Generate filename based on timestamp to avoid conflicts
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const posterUpload = multer({ 
    storage: multer.memoryStorage(),  // Use memory storage for processing with sharp
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware để kiểm tra quyền truy cập cho admin_role_1, muốn chuyển sang admin_role_1 thì dưới bảng user thuộc tính vai trò sẽ là admin_role_1
const restrictToAdminRole1 = (req, res, next) => {
    if (!req.session.user || req.session.user.VaiTro !== 'admin_role_1') {
        return res.redirect('/profile');
    }
    next();
};

// Các route dành cho người dùng truy cập vào trang profile có vai trò là KhachHang
router.get('/', profileController.refreshSession, profileController.getProfile);
router.post('/edit', profileController.editProfile);
router.post('/upload-avatar', avatarUpload.single('avatar'), profileController.uploadAvatar);
router.get('/avatar/:id', profileController.getAvatar);
router.get('/poster/:id', profileController.getPoster);
router.post('/upload-poster', profileController.uploadPoster);
router.get('/history', profileController.getHistory);
router.get('/api/load-more-history', profileController.loadMoreHistory);
router.post('/create-transaction-table', profileController.createTransactionTable);

// Các route dành cho người dùng truy cập vào trang profile có vai trò là admin_role_1
router.get('/admin/theaters', restrictToAdminRole1, profileController.getTheaters);
router.post('/admin/theaters/add', restrictToAdminRole1, profileController.addTheater);
router.post('/admin/theaters/delete', restrictToAdminRole1, profileController.deleteTheater);
router.post('/admin/theaters/hide', restrictToAdminRole1, profileController.hideTheater);

router.get('/admin/movies', restrictToAdminRole1, profileController.getMovies);
router.post('/admin/movies/add', restrictToAdminRole1, posterUpload.single('poster'), profileController.addMovie);
router.post('/admin/movies/edit/:id', restrictToAdminRole1, profileController.editMovie);
router.post('/admin/movies/delete', restrictToAdminRole1, profileController.deleteMovie);
router.post('/admin/movies/hide', restrictToAdminRole1, profileController.hideMovie);

router.get('/admin/showtimes', restrictToAdminRole1, profileController.getShowtimes);
router.post('/admin/showtimes/add', restrictToAdminRole1, profileController.addShowtime);
router.post('/admin/showtimes/delete', restrictToAdminRole1, profileController.deleteShowtime);
router.post('/admin/showtimes/hide', restrictToAdminRole1, profileController.hideShowtime);

router.get('/admin/rooms', restrictToAdminRole1, profileController.getRooms);
router.post('/admin/rooms/add', restrictToAdminRole1, profileController.addRoom);
router.post('/admin/rooms/delete', restrictToAdminRole1, profileController.deleteRoom);
router.post('/admin/rooms/hide', restrictToAdminRole1, profileController.hideRoom);

module.exports = router;
