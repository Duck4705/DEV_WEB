const express = require('express');
const authController = require('../controllers/auth');
const router = express.Router();

router.post('/register',authController.register); 
router.post('/login', authController.login);
router.post('/', authController.login);
router.post('/forgot_pass', authController.forgot_pass);
router.get('/verify_code', authController.verify_code);
router.post('/reset_pass', authController.reset_pass);
router.post('/login_with_otp', authController.loginWithOtp);
router.post('/verify_otp', authController.verifyOtp);
module.exports = router;