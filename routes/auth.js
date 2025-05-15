const express = require('express');
const authController = require('../controllers/auth');
const googleController = require('../controllers/googleAuthController'); // Thêm dòng này
const passport = require('passport');
const router = express.Router();

router.post('/register', authController.register); 
router.post('/login', authController.login);
router.post('/', authController.login);
router.post('/forgot_pass', authController.forgot_pass);
router.get('/verify_code', authController.verify_code);
router.post('/reset_pass', authController.reset_pass);
router.post('/login_with_otp', authController.loginWithOtp);
router.post('/verify_otp', authController.verifyOtp);

// Google OAuth login route
router.get('/google', googleController.googleLogin);

// Google OAuth callback route
router.get('/google/callback', googleController.googleCallback);

// Route đăng xuất Google
router.get('/logout-google', googleController.googleLogout);

module.exports = router;