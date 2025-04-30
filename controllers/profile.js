const path = require('path');
const fs = require('fs');
const db = require('../db'); // Import database connection

// Middleware to refresh session
exports.refreshSession = (req, res, next) => {
    const user = req.session.user;

    if (!user) {
        return next(); // Nếu không có session, bỏ qua middleware
    }

    db.query('SELECT * FROM users WHERE TenTaiKhoan = ?', [user.TenTaiKhoan], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length > 0) {
            const updatedUser = results[0];
            req.session.user = {
                ID_U: updatedUser.ID_U,
                TenTaiKhoan: updatedUser.TenTaiKhoan,
                HoTen: updatedUser.HoTen,
                NgaySinh: updatedUser.NgaySinh,
                SDT: updatedUser.SDT,
                Email: updatedUser.Email,
                TongSoTien: updatedUser.TongSoTien.toLocaleString('vi-VN'),
            };
        }

        next();
    });
};

// Render profile page
exports.getProfile = (req, res) => {
    const user = req.session.user;

    if (!user) {
        return res.redirect('/login');
    }

    if (user.NgaySinh) {
        const ngaySinh = new Date(user.NgaySinh);
        const localDate = new Date(ngaySinh.getTime() - ngaySinh.getTimezoneOffset() * 60000);
        user.NgaySinh = localDate.toISOString().split('T')[0];
    }

    user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
    res.render('profile', { user });
};

// Handle profile edit
exports.editProfile = (req, res) => {
    const { HoTen, NgaySinh, SDT, Email } = req.body;
    const user = req.session.user;

    if (!user) {
        return res.redirect('/login');
    }

    db.query(
        'UPDATE users SET HoTen = ?, NgaySinh = ?, SDT = ?, Email = ? WHERE TenTaiKhoan = ?',
        [HoTen, NgaySinh, SDT, Email, user.TenTaiKhoan],
        (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }

            user.HoTen = HoTen;
            user.NgaySinh = NgaySinh;
            user.SDT = SDT;
            user.Email = Email;

            res.redirect('/profile');
        }
    );
};

// Handle avatar upload
exports.uploadAvatar = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Không có file được tải lên.' });
    }

    res.json({ success: true, fileName: req.file.filename });
};

// Serve user avatar
exports.getAvatar = (req, res) => {
    const userId = req.params.id;
    const filePath = path.join(__dirname, '../public/img/img_user', `${userId}.png`);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.sendFile(path.join(__dirname, '../public/img/img_user/cat-user.png'));
        }
        res.sendFile(filePath);
    });
};

exports.getHistory = (req, res) => {

    const user = req.session.user;

    if (!user) {
        return res.redirect('/login');
    }

    if (user.NgaySinh) {
        const ngaySinh = new Date(user.NgaySinh);
        const localDate = new Date(ngaySinh.getTime() - ngaySinh.getTimezoneOffset() * 60000);
        user.NgaySinh = localDate.toISOString().split('T')[0];
    }

    user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
    res.render('profile_history', {user});
};