const db = require('../app'); // Kết nối cơ sở dữ liệu

// Lấy thông tin chi tiết phim
exports.getMovieDetails = (req, res) => {
    const user = req.session.user; // Lấy thông tin người dùng từ session
    const ID_P = req.params.ID_P; // Lấy ID phim từ URL

    // Truy vấn cơ sở dữ liệu để lấy thông tin phim
    db.query('SELECT * FROM phim WHERE ID_P = ?', [ID_P], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(404).send('Phim không tồn tại');
        }

        const phim = results[0]; // Lấy thông tin phim đầu tiên

        // Nếu người dùng đã đăng nhập, định dạng số tiền
        if (user) {
            user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN'); // Định dạng số tiền
        }

        // Truyền thông tin phim và người dùng (nếu có) vào view
        res.render('movie_details', { user, phim });
    });
};

exports.getMovieShowing = (req, res) => {       
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
            return res.render('showing', { user, phim});
        }

        res.render('showing', { phim }); // Không gửi thông tin người dùng nếu không có session
    });
}
