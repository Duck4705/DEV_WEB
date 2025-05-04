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
                VaiTro: updatedUser.VaiTro,
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

// Render transaction history
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
    res.render('profile_history', { user });
};

// Admin: Manage Theaters
exports.getTheaters = (req, res) => {
    db.query('SELECT * FROM RapPhim', (err, theaters) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('admin_theaters', { user: req.session.user, theaters });
    });
};

exports.addTheater = (req, res) => {
    const { TenRap, DiaDiem } = req.body;
    const ID_R = `R${Date.now()}`;
    db.query('SELECT * FROM RapPhim WHERE TenRap = ? AND DiaDiem = ?', [TenRap, DiaDiem], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_theaters', { user: req.session.user, theaters: results, error: 'Rạp đã tồn tại.' });
        }
        db.query('INSERT INTO RapPhim (ID_R, TenRap, DiaDiem) VALUES (?, ?, ?)', [ID_R, TenRap, DiaDiem], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/profile/admin/theaters');
        });
    });
};

// Admin: Manage Movies
exports.getMovies = (req, res) => {
    db.query('SELECT * FROM Phim', (err, movies) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('admin_movies', { user: req.session.user, movies });
    });
};

exports.addMovie = (req, res) => {
    const { TenPhim, TheLoai, LinkTrailer, LinkPoster, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi } = req.body;
    const ID_P = `P${Date.now()}`;
    db.query('SELECT * FROM Phim WHERE TenPhim = ?', [TenPhim], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_movies', { user: req.session.user, movies: results, error: 'Phim đã tồn tại.' });
        }
        db.query(
            'INSERT INTO Phim (ID_P, TenPhim, TheLoai, LinkTrailer, LinkPoster, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [ID_P, TenPhim, TheLoai, LinkTrailer, LinkPoster, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi],
            (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.redirect('/profile/admin/movies');
            }
        );
    });
};

exports.editMovie = (req, res) => {
    const { TenPhim, TheLoai, LinkTrailer, LinkPoster, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi } = req.body;
    const { id } = req.params;
    db.query(
        'UPDATE Phim SET TenPhim = ?, TheLoai = ?, LinkTrailer = ?, LinkPoster = ?, MoTaPhim = ?, QuocGia = ?, ThoiLuong = ?, NgonNgu = ?, NoiDung = ?, DoTuoi = ? WHERE ID_P = ?',
        [TenPhim, TheLoai, LinkTrailer, LinkPoster, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi, id],
        (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/profile/admin/movies');
        }
    );
};

// Admin: Manage Showtimes
exports.getShowtimes = (req, res) => {
    db.query('SELECT sc.*, p.TenPhim, pc.TenPhong, r.TenRap FROM SuatChieu sc JOIN Phim p ON sc.ID_P = p.ID_P JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC JOIN RapPhim r ON pc.ID_R = r.ID_R', (err, showtimes) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        db.query('SELECT * FROM Phim', (err, movies) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            db.query('SELECT * FROM PhongChieu', (err, rooms) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.render('admin_showtimes', { user: req.session.user, showtimes, movies, rooms });
            });
        });
    });
};

exports.addShowtime = (req, res) => {
    const { ID_P, ID_PC, NgayGioChieu, GiaVe } = req.body;
    const ID_SC = `SC${Date.now()}`;
    db.query('SELECT * FROM SuatChieu WHERE ID_PC = ? AND NgayGioChieu = ?', [ID_PC, NgayGioChieu], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_showtimes', { user: req.session.user, error: 'Suất chiếu đã tồn tại cho phòng và thời gian này.' });
        }
        db.query('INSERT INTO SuatChieu (ID_SC, ID_P, ID_PC, NgayGioChieu, GiaVe) VALUES (?, ?, ?, ?, ?)', [ID_SC, ID_P, ID_PC, NgayGioChieu, GiaVe], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/profile/admin/showtimes');
        });
    });
};

exports.deleteShowtime = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM SuatChieu WHERE ID_SC = ?', [id], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/profile/admin/showtimes');
    });
};

// Admin: Manage Rooms
exports.getRooms = (req, res) => {
    db.query('SELECT pc.*, r.TenRap FROM PhongChieu pc JOIN RapPhim r ON pc.ID_R = r.ID_R', (err, rooms) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        db.query('SELECT * FROM RapPhim', (err, theaters) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.render('admin_rooms', { user: req.session.user, rooms, theaters });
        });
    });
};

exports.addRoom = (req, res) => {
    const { ID_R, TenPhong, LoaiPhong } = req.body;
    const ID_PC = `PC${Date.now()}`;
    db.query('SELECT * FROM PhongChieu WHERE TenPhong = ? AND ID_R = ?', [TenPhong, ID_R], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_rooms', { user: req.session.user, error: 'Phòng chiếu đã tồn tại cho rạp này.' });
        }
        db.query('INSERT INTO PhongChieu (ID_PC, ID_R, TenPhong, LoaiPhong) VALUES (?, ?, ?, ?)', [ID_PC, ID_R, TenPhong, LoaiPhong], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/profile/admin/rooms');
        });
    });
};

// Admin: Manage Seats
exports.getSeats = (req, res) => {
    db.query('SELECT g.*, pc.TenPhong, r.TenRap FROM Ghe g JOIN PhongChieu pc ON g.ID_PC = pc.ID_PC JOIN RapPhim r ON pc.ID_R = r.ID_R', (err, seats) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        db.query('SELECT * FROM PhongChieu', (err, rooms) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.render('admin_seats', { user: req.session.user, seats, rooms });
        });
    });
};

exports.addSeat = (req, res) => {
    const { ID_PC, LoaiGhe, SoGhe } = req.body;
    const ID_G = `G${Date.now()}`;
    db.query('SELECT * FROM Ghe WHERE SoGhe = ? AND ID_PC = ?', [SoGhe, ID_PC], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_seats', { user: req.session.user, error: 'Ghế đã tồn tại trong phòng này.' });
        }
        db.query('INSERT INTO Ghe (ID_G, ID_PC, LoaiGhe, SoGhe) VALUES (?, ?, ?, ?)', [ID_G, ID_PC, LoaiGhe, SoGhe], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/profile/admin/seats');
        });
    });
};

// CHANGES FOR ADMIN ROLE 1
// Added VaiTro to session user object in refreshSession
// Added controllers for managing theaters (getTheaters, addTheater)
// Added controllers for managing movies (getMovies, addMovie, editMovie)
// Added controllers for managing showtimes (getShowtimes, addShowtime, deleteShowtime)
// Added controllers for managing rooms (getRooms, addRoom)
// Added controllers for managing seats (getSeats, addSeat)
// Implemented duplicate checks for theaters, movies, showtimes, rooms, and seats
