const express = require('express');
const router = express.Router();
const refreshSession = require('../controllers/profile').refreshSession;
const db = require('../db');

<<<<<<< HEAD

router.get('/', refreshSession, (req, res) => {
    const user = req.session.user;

    // Lấy danh sách phim từ cơ sở dữ liệu
    db.query('SELECT * FROM phim', (err, phim) => {
=======
// Middleware để làm mới phiên khi có cập nhật trong cơ sở dữ liệu
router.get('/', refreshSession, (req, res) => {
    const user = req.session.user;
    const limit = 4; // Số phim hiển thị ban đầu

    // Lấy danh sách phim từ cơ sở dữ liệu với giới hạn hiển thị ban đầu
    db.query('SELECT * FROM phim LIMIT ?', [limit], (err, phim) => {
>>>>>>> refs/remotes/origin/develop
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

<<<<<<< HEAD
        // Render trang index với danh sách phim và thông tin người dùng (nếu có)
        if (user) {
            user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
            return res.render('index', { user, phim});
        }

        res.render('index', { phim }); // Không gửi thông tin người dùng nếu không có session
    });
});
=======
        // Đếm tổng số phim để xác định xem có phim để tải thêm không
        db.query('SELECT COUNT(*) as total FROM phim', (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }

            const total = result[0].total;
            const hasMoreMovies = total > limit;

            // Render trang index với danh sách phim và thông tin người dùng (nếu có)
            if (user) {
                user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
                return res.render('index', { 
                    user, 
                    phim, 
                    hasMoreMovies, 
                    initialLimit: limit 
                });
            }

            res.render('index', { phim, hasMoreMovies, initialLimit: limit });
        });
    });
});

// Thêm logging để kiểm tra dữ liệu trả về
router.get('/api/load-more-movies', (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 4;

    db.query('SELECT * FROM phim LIMIT ? OFFSET ?', [limit, offset], (err, movies) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        db.query('SELECT COUNT(*) as total FROM phim', (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }            const total = result[0].total;
            const hasMore = (offset + movies.length) < total;
              
            // Logging để debug
            console.log('Offset:', offset);
            console.log('Limit:', limit);
            console.log('Movies fetched:', movies.length);
            console.log('Total movies:', total);
            console.log('Current position (offset + movies.length):', offset + movies.length);
            console.log('Has more movies:', hasMore);
            console.log('Response data:', JSON.stringify(movies));
            
            res.json({
                movies: movies,
                hasMore: hasMore,
                hasMore: hasMore, // Thêm một lần nữa để chắc chắn
                total: total
            });
        });
    });
});

// các route chuyển đến trang đăng ký, đăng nhập, quên mật khẩu, đặt lại mật khẩu
>>>>>>> refs/remotes/origin/develop
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
<<<<<<< HEAD
router.get('/movie_details', (req, res) => {
    res.render("movie_details");
});
=======

// Route chuyển đến trang movie_details
router.get('/movie_details', (req, res) => {
    res.render("movie_details");
});

// Route đăng xuất, xóa session
>>>>>>> refs/remotes/origin/develop
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