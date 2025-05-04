const express = require('express');
const authController = require('../controllers/auth');
<<<<<<< HEAD
const router = express.Router();

router.post('/register',authController.register); 
=======
const passport = require('passport');
const router = express.Router();

router.post('/register', authController.register); 
>>>>>>> feature/adminrole1
router.post('/login', authController.login);
router.post('/', authController.login);
router.post('/forgot_pass', authController.forgot_pass);
router.get('/verify_code', authController.verify_code);
router.post('/reset_pass', authController.reset_pass);
router.post('/login_with_otp', authController.loginWithOtp);
router.post('/verify_otp', authController.verifyOtp);
<<<<<<< HEAD
=======

// Google OAuth login route
router.get('/google', (req, res, next) => {
    // Nếu đã đăng nhập, chuyển hướng về trang chủ
    if (req.session.user) {
        return res.redirect('/');
    }
    // Gọi Google OAuth với prompt=select_account
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account' // Buộc hiển thị giao diện chọn tài khoản
    })(req, res, next);
});

// Google OAuth callback route
router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/login'
}), (req, res) => {
    // Lưu thông tin user vào session
    req.session.user = req.user;
    // Redirect to the home page
    res.redirect('/');
});

// Route đăng xuất Google
router.get('/logout-google', (req, res) => {
    // Xóa session ứng dụng
    req.session.destroy((err) => {
        if (err) {
            console.error('Lỗi khi xóa session:', err);
        }
        // Chuyển hướng đến URL đăng xuất Google
        res.redirect('https://accounts.google.com/Logout');
    });
});

>>>>>>> feature/adminrole1
module.exports = router;