const express = require('express');
const router = express.Router();
const refreshSession = require('../controllers/profile').refreshSession;
const db = require('../app');


router.get('/', refreshSession, (req, res) => {
    const user = req.session.user;

    // Lấy danh sách phim từ cơ sở dữ liệu
    db.query('SELECT * FROM phim', (err, phim) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Render trang index với danh sách phim và thông tin người dùng (nếu có)
        if (user) {
            user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
            return res.render('index', { user, phim});
        }

        res.render('index', { phim }); // Không gửi thông tin người dùng nếu không có session
    });
});
router.get('/register', (req, res) => {
    res.render("register");
});

router.get('/login', (req, res) => {
    res.render("login");
});

router.get('/forgot_pass', (req, res) => {
    res.render("forgot_pass");
});

router.get('/reset_pass', (req, res) => {
    res.render("reset_pass");
});
router.get('/movie_details', (req, res) => {
    res.render("movie_details");
});
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.clearCookie('connect.sid'); // Xóa cookie session
        res.redirect('/');
    });
});

module.exports = router;