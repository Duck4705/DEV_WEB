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

router.get('/', profileController.refreshSession, profileController.getProfile);
router.post('/edit', profileController.editProfile);
router.post('/upload-avatar', upload.single('avatar'), profileController.uploadAvatar);
router.get('/avatar/:id', profileController.getAvatar);
router.get('/history', profileController.getHistory);
module.exports = router;