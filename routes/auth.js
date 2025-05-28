// Thêm thư viện ở dòng này
const express = require('express');
const authController = require('../controllers/auth');
const googleController = require('../controllers/googleAuthController');
const router = express.Router();

// Các route đăng nhập, đăng ký và xác thực
router.post('/register', authController.register); 
router.post('/login', authController.login);
router.post('/', authController.login);
router.post('/forgot_pass', authController.forgot_pass);
router.get('/verify_code', authController.verify_code);
router.post('/reset_pass', authController.reset_pass);
router.post('/login_with_otp', authController.loginWithOtp);
router.post('/verify_otp', authController.verifyOtp);

// Các route xác thực với Google, callback và đăng xuất
router.get('/google', googleController.googleLogin);
router.get('/google/callback', googleController.googleCallback);
router.get('/logout-google', googleController.googleLogout);

module.exports = router;