const path = require('path');
const fs = require('fs');
const db = require('../db');

// Middleware to refresh session
exports.refreshSession = (req, res, next) => {
    const user = req.session.user;
    if (!user) {
        return next();
    }
    db.query('SELECT * FROM Users WHERE TenTaiKhoan = ?', [user.TenTaiKhoan], (err, results) => {
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
                TongSoTien: updatedUser?.TongSoTien != null ? updatedUser.TongSoTien.toLocaleString('vi-VN') : '0',
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
        'UPDATE Users SET HoTen = ?, NgaySinh = ?, SDT = ?, Email = ? WHERE TenTaiKhoan = ?',
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

// Handle poster upload
exports.uploadPoster = (req, res) => {
    const multer = require('multer');
    const posterDir = path.join(__dirname, '../public/img/img_poster');
    
    // Create directory if it doesn't exist
    fs.mkdir(posterDir, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            console.error('Create directory error:', mkdirErr);
            return res.status(500).json({ success: false, message: 'Error creating directory' });
        }
        
        // Count existing files to generate next ID
        fs.readdir(posterDir, (err, files) => {
            if (err) {
                console.error('Read directory error:', err);
                return res.status(500).json({ success: false, message: 'Error reading directory' });
            }
            
            const nextId = files.length + 1;
            const fileName = `P${nextId}.webp`; // Use webp for posters
            
            // Configure storage
            const storage = multer.diskStorage({
                destination: (req, file, cb) => {
                    cb(null, posterDir);
                },
                filename: (req, file, cb) => {
                    cb(null, fileName);
                }
            });
            
            // Initialize upload
            const upload = multer({ storage: storage }).single('poster');
	            
            // Process the upload
            upload(req, res, function(err) {
                if (err) {
                    console.error('Upload error:', err);
                    return res.status(400).json({ success: false, message: 'Upload failed' });
                }
                
                if (!req.file) {
                    return res.status(400).json({ success: false, message: 'No file uploaded' });
                }
                
                return res.json({ success: true, fileName: fileName });
            });
        });
    });
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

// Add getPoster function for WebP format
exports.getPoster = (req, res) => {
    const posterId = req.params.id;
    const filePath = path.join(__dirname, '../public/img/img_poster', `${posterId}.webp`);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // Try to send a default poster in webp format
            const defaultPath = path.join(__dirname, '../public/img/img_poster/default-poster.webp');
            fs.access(defaultPath, fs.constants.F_OK, (errDefault) => {
                if (errDefault) {
                    // If default webp doesn't exist, try png as fallback
                    return res.sendFile(path.join(__dirname, '../public/img/img_poster/default-poster.png'));
                }
                return res.sendFile(defaultPath);
            });
        } else {
            res.sendFile(filePath);
        }
    });
};

// Render transaction history
exports.getHistory = (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.redirect('/login');
    }

    // Format user data
    if (user.NgaySinh) {
        const ngaySinh = new Date(user.NgaySinh);
        const localDate = new Date(ngaySinh.getTime() - ngaySinh.getTimezoneOffset() * 60000);
        user.NgaySinh = localDate.toISOString().split('T')[0];
    }
    user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
    
    db.query("SHOW TABLES LIKE 'LichSuGiaoDich'", (err, tables) => {
        if (err) {
            console.error('Database error when checking table:', err);
            return res.render('profile_history', { 
                user, 
                tableError: 'Lỗi khi kiểm tra bảng dữ liệu: ' + err.message 
            });
        }
        
        // If table doesn't exist, create it (for admin only)
        if (tables.length === 0 && user.VaiTro === 'admin_role_1') {
            const createTableQuery = `
                CREATE TABLE LichSuGiaoDich (
                    ID_GD varchar(50) PRIMARY KEY,
                    ID_U varchar(50) NOT NULL,
                    NgayGD datetime DEFAULT CURRENT_TIMESTAMP,
                    TheLoaiGD varchar(50),
                    PhuongThucGD varchar(50),
                    FOREIGN KEY (ID_U) REFERENCES Users(ID_U) 
                )
            `;
            db.query(createTableQuery, (err) => {
                if (err) {
                    console.error('Database error when creating table:', err);
                    return res.render('profile_history', { 
                        user, 
                        tableError: 'Không thể tạo bảng dữ liệu: ' + err.message 
                    });
                }
                // Thêm dữ liệu mẫu cho nhiều user
                db.query('SELECT ID_U FROM Users LIMIT 3', (err, users) => {
                    if (err || !users.length) {
                        return res.render('profile_history', { 
                            user, 
                            transactions: [],
                            hasMore: false,
                            tableCreated: true
                        });
                    }
                    const now = new Date();
                    const sampleData = [
                        ['GD' + Date.now() + '1', users[0].ID_U, now, 'Nạp tiền', 'Chuyển khoản'],
                        ['GD' + Date.now() + '2', users[0].ID_U, now, 'Mua vé', 'Thẻ tín dụng'],
                        ['GD' + Date.now() + '3', users[1]?.ID_U || users[0].ID_U, now, 'Hoàn tiền', 'Ví điện tử'],
                        ['GD' + Date.now() + '4', users[2]?.ID_U || users[0].ID_U, now, 'Mua vé', 'VNPay']
                    ];
                    const insertSql = 'INSERT INTO LichSuGiaoDich (ID_GD, ID_U, NgayGD, TheLoaiGD, PhuongThucGD) VALUES ?';
                    db.query(insertSql, [sampleData], () => {
                        return res.render('profile_history', { 
                            user, 
                            transactions: [],
                            hasMore: false,
                            tableCreated: true
                        });
                    });
                });
            });
            return;
        }
        
        // Determine query based on user role
        let query, params;
        const limit = 10; // Initial limit of records to show
        
        if (user.VaiTro === 'admin_role_1') {
            // Admin sees all transactions from last 7 days
            query = `
                SELECT ID_GD, ID_U, NgayGD, TheLoaiGD, PhuongThucGD
                FROM LichSuGiaoDich
                WHERE NgayGD >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                ORDER BY NgayGD DESC
                LIMIT ?
            `;
            params = [limit];
        } else {
            // Regular user sees only their own transactions
            query = `
                SELECT ID_GD, NgayGD, TheLoaiGD, PhuongThucGD
                FROM LichSuGiaoDich
                WHERE ID_U = ?
                ORDER BY NgayGD DESC
                LIMIT ?
            `;
            params = [user.ID_U, limit];
        }
        
        // Execute the query
        db.query(query, params, (err, transactions) => {
            if (err) {
                console.error('Database error when fetching transactions:', err);
                return res.render('profile_history', { 
                    user, 
                    queryError: 'Lỗi khi truy vấn dữ liệu: ' + err.message 
                });
            }
            
            // Format dates for display
            if (transactions && transactions.length > 0) {
                transactions.forEach(transaction => {
                    const date = new Date(transaction.NgayGD);
                    transaction.formattedDate = date.toLocaleDateString('vi-VN', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                });
            }
            
            // Nếu là admin và không có dữ liệu, tự động thêm dữ liệu mẫu
            if (user.VaiTro === 'admin_role_1' && (!transactions || transactions.length === 0)) {
                db.query('SELECT ID_U FROM Users LIMIT 3', (err, users) => {
                    if (err || !users.length) {
                        return res.render('profile_history', { 
                            user, 
                            transactions: [],
                            hasMore: false,
                            tableCreated: false
                        });
                    }
                    const now = new Date();
                    const sampleData = [
                        ['GD' + Date.now() + '5', users[0].ID_U, now, 'Nạp tiền', 'Chuyển khoản'],
                        ['GD' + Date.now() + '6', users[0].ID_U, now, 'Mua vé', 'Thẻ tín dụng'],
                        ['GD' + Date.now() + '7', users[1]?.ID_U || users[0].ID_U, now, 'Hoàn tiền', 'Ví điện tử'],
                        ['GD' + Date.now() + '8', users[2]?.ID_U || users[0].ID_U, now, 'Mua vé', 'VNPay']
                    ];
                    const insertSql = 'INSERT INTO LichSuGiaoDich (ID_GD, ID_U, NgayGD, TheLoaiGD, PhuongThucGD) VALUES ?';
                    db.query(insertSql, [sampleData], () => {
                        // Sau khi thêm, truy vấn lại
                        db.query(query, params, (err2, transactions2) => {
                            if (err2) {
                                return res.render('profile_history', { 
                                    user, 
                                    transactions: [],
                                    hasMore: false,
                                    tableCreated: false
                                });
                            }
                            // Count total records for pagination
                            let countQuery, countParams;
                            countQuery = `
                                SELECT COUNT(*) as total FROM LichSuGiaoDich
                                WHERE NgayGD >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                            `;
                            countParams = [];
                            db.query(countQuery, countParams, (err, countResult) => {
                                const totalRecords = countResult && countResult[0] ? countResult[0].total : 0;
                                const hasMore = totalRecords > limit;
                                res.render('profile_history', { 
                                    user, 
                                    transactions: transactions2,
                                    hasMore,
                                    totalRecords,
                                    initialLimit: limit
                                });
                            });
                        });
                    });
                });
                return;
            }
            
            // Count total records for pagination
            let countQuery, countParams;
            if (user.VaiTro === 'admin_role_1') {
                countQuery = `
                    SELECT COUNT(*) as total FROM LichSuGiaoDich
                    WHERE NgayGD >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                `;
                countParams = [];
            } else {
                countQuery = `
                    SELECT COUNT(*) as total FROM LichSuGiaoDich
                    WHERE ID_U = ?
                `;
                countParams = [user.ID_U];
            }
            db.query(countQuery, countParams, (err, countResult) => {
                const totalRecords = countResult && countResult[0] ? countResult[0].total : 0;
                const hasMore = totalRecords > limit;
                res.render('profile_history', { 
                    user, 
                    transactions,
                    hasMore,
                    totalRecords,
                    initialLimit: limit
                });
            });
        });
    });
};

// Add a new endpoint for loading more transaction history
exports.loadMoreHistory = (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;
    
    // Determine query based on user role
    let query, params, countQuery, countParams;
    
    if (user.VaiTro === 'admin_role_1') {
        // Admin sees all transactions from last 7 days
        query = `
            SELECT ID_GD, ID_U, NgayGD, TheLoaiGD, PhuongThucGD
            FROM LichSuGiaoDich
            WHERE NgayGD >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY NgayGD DESC
            LIMIT ?, ?
        `;
        params = [offset, limit];
        
        countQuery = `
            SELECT COUNT(*) as total FROM LichSuGiaoDich
            WHERE NgayGD >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `;
        countParams = [];
    } else {
        // Regular user sees only their own transactions
        query = `
            SELECT ID_GD, NgayGD, TheLoaiGD, PhuongThucGD
            FROM LichSuGiaoDich
            WHERE ID_U = ?
            ORDER BY NgayGD DESC
            LIMIT ?, ?
        `;
        params = [user.ID_U, offset, limit];
        
        countQuery = `
            SELECT COUNT(*) as total FROM LichSuGiaoDich
            WHERE ID_U = ?
        `;
        countParams = [user.ID_U];
    }
    
    // Execute the query
    db.query(query, params, (err, transactions) => {
        if (err) {
            console.error('Database error when fetching more transactions:', err);
            return res.status(500).json({ success: false, message: 'Database error when fetching transactions' });
        }
        
        // Format dates for display
        if (transactions && transactions.length > 0) {
            transactions.forEach(transaction => {
                const date = new Date(transaction.NgayGD);
                transaction.formattedDate = date.toLocaleDateString('vi-VN', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            });
        }
        
        // Get total count for pagination info
        db.query(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('Database error when counting more records:', err);
                return res.status(500).json({ success: false, message: 'Database error when counting records' });
            }
            
            const totalRecords = countResult[0].total;
            const hasMore = offset + transactions.length < totalRecords;
            
            res.json({ 
                success: true, 
                transactions, 
                hasMore,
                total: totalRecords
            });
        });
    });
};

// Admin: Create LichSuGiaoDich table if it doesn't exist
exports.createTransactionTable = (req, res) => {
    const user = req.session.user;
    if (!user || user.VaiTro !== 'admin_role_1') {
        return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS LichSuGiaoDich (
            ID_GD varchar(50) PRIMARY KEY,
            ID_U varchar(50) NOT NULL,
            NgayGD datetime DEFAULT CURRENT_TIMESTAMP,
            TheLoaiGD varchar(50),
            PhuongThucGD varchar(50),
            FOREIGN KEY (ID_U) REFERENCES Users(ID_U) 
        )
    `;
    
    db.query(createTableQuery, (err) => {
        if (err) {
            console.error('Error creating LichSuGiaoDich table:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        
        // Add sample data for testing
        const generateUniqueId = () => {
            return 'GD' + Date.now() + Math.floor(Math.random() * 1000);
        };
        
        const sampleData = [
            [generateUniqueId(), user.ID_U, new Date(), 'Nạp tiền', 'Chuyển khoản'],
            [generateUniqueId(), user.ID_U, new Date(), 'Mua vé', 'Thẻ tín dụng'],
            [generateUniqueId(), user.ID_U, new Date(), 'Hoàn tiền', 'Ví điện tử']
        ];
        
        const insertSampleData = sampleData.map(data => {
            return new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO LichSuGiaoDich (ID_GD, ID_U, NgayGD, TheLoaiGD, PhuongThucGD) VALUES (?, ?, ?, ?, ?)',
                    data,
                    (err) => {
                        if (err) {
                            console.error('Error inserting sample data:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        });
        
        Promise.all(insertSampleData)
            .then(() => {
                res.json({ success: true, message: 'Đã tạo bảng dữ liệu và thêm dữ liệu mẫu thành công' });
            })
            .catch(err => {
                res.json({ 
                    success: true, 
                    message: 'Đã tạo bảng dữ liệu nhưng không thể thêm dữ liệu mẫu: ' + err.message 
                });
            });
    });
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
    db.query('SELECT * FROM RapPhim WHERE TenRap = ? AND DiaDiem = ?', [TenRap, DiaDiem], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_theaters', { user: req.session.user, theaters: results, error: 'Rạp đã tồn tại.' });
        }
        db.query('SELECT COUNT(*) AS count FROM RapPhim', (err, countResult) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            const ID_R = `R${countResult[0].count + 1}`;
            db.query('INSERT INTO RapPhim (ID_R, TenRap, DiaDiem) VALUES (?, ?, ?)', [ID_R, TenRap, DiaDiem], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.redirect('/profile/admin/theaters');
            });
        });
    });
};

// Delete Theater
exports.deleteTheater = (req, res) => {
    const { ID_R } = req.body;
    
    // First check if there are any PhongChieu (rooms) associated with this theater
    db.query('SELECT COUNT(*) as roomCount FROM PhongChieu WHERE ID_R = ?', [ID_R], (err, results) => {
        if (err) {
            console.error('Database error when checking for rooms:', err);
            return res.render('admin_theaters', { 
                user: req.session.user, 
                error: 'Đã xảy ra lỗi khi kiểm tra dữ liệu phòng chiếu.'
            });
        }

        const roomCount = results[0].roomCount;
        
        if (roomCount > 0) {
            // There are rooms associated with this theater, cannot delete
            return res.render('admin_theaters', { 
                user: req.session.user, 
                error: `Không thể xóa rạp ${ID_R} vì còn ${roomCount} phòng chiếu liên kết. Vui lòng xóa các phòng chiếu trước.`
            });
        }
        
        // No rooms associated, proceed with deletion
        db.query('DELETE FROM RapPhim WHERE ID_R = ?', [ID_R], (err, result) => {
            if (err) {
                console.error('Database error when deleting theater:', err);
                return res.render('admin_theaters', { 
                    user: req.session.user, 
                    error: 'Đã xảy ra lỗi khi xóa rạp chiếu.' 
                });
            }
            
            if (result.affectedRows === 0) {
                // No theater was deleted, likely because ID doesn't exist
                return res.render('admin_theaters', { 
                    user: req.session.user, 
                    error: `Không tìm thấy rạp với ID: ${ID_R}` 
                });
            }
            
            // Fetch updated theater list after successful deletion
            db.query('SELECT * FROM RapPhim', (err, theaters) => {
                if (err) {
                    console.error('Database error when fetching theaters:', err);
                    return res.redirect('/profile/admin/theaters');
                }
                
                return res.render('admin_theaters', { 
                    user: req.session.user, 
                    theaters,
                    success: `Đã xóa rạp ${ID_R} thành công.`
                });
            });
        });
    });
};

// Hide Theater (doesn't actually delete from DB, just hides in UI)
exports.hideTheater = (req, res) => {
    const { id } = req.body;
    
    // Since we're only hiding in the UI, we just return success
    // In a real application, you might want to set a 'hidden' flag in the database
    res.json({ success: true, message: `Theater ${id} hidden successfully` });
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
    db.query('SELECT * FROM Phim WHERE TenPhim = ?', [TenPhim], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_movies', { user: req.session.user, movies: results, error: 'Phim đã tồn tại.' });
        }
        db.query('SELECT COUNT(*) AS count FROM Phim', (err, countResult) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            const ID_P = `P${countResult[0].count + 1}`;
            db.query(
                'INSERT INTO Phim (ID_P, TenPhim, TheLoai, LinkTrailer, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [ID_P, TenPhim, TheLoai, LinkTrailer, MoTaPhim, QuocGia, ThoiLuong, NgonNgu, NoiDung, DoTuoi],
                (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    res.redirect('/profile/admin/movies');
                }
            );
        });
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

// Delete Movie
exports.deleteMovie = (req, res) => {
    const { ID_P } = req.body;
    db.query('DELETE FROM Phim WHERE ID_P = ?', [ID_P], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/profile/admin/movies');
    });
};

// Hide Movie (doesn't actually delete from DB, just hides in UI)
exports.hideMovie = (req, res) => {
    const { id } = req.body;
    
    if (!id) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing movie ID' 
        });
    }
    
    // For debugging purposes, log the request
    console.log('Received hide request for movie:', id);
    
    // Since we're only hiding in the UI, we just return success
    // In a real application, you might want to set a 'hidden' flag in the database
    res.json({ 
        success: true, 
        message: `Movie ${id} hidden successfully` 
    });
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
                res.render('admin_showtimes', { 
                    user: req.session.user, 
                    showtimes, 
                    movies, 
                    rooms
                });
            });
        });
    });
};

exports.addShowtime = (req, res) => {
    const { ID_P, ID_PC, NgayGioChieu, GiaVe } = req.body;
    db.query('SELECT * FROM SuatChieu WHERE ID_PC = ? AND NgayGioChieu = ?', [ID_PC, NgayGioChieu], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_showtimes', { user: req.session.user, error: 'Suất chiếu đã tồn tại cho phòng và thời gian này.' });
        }
        db.query('SELECT COUNT(*) AS count FROM SuatChieu', (err, countResult) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            const ID_SC = `SC${countResult[0].count + 1}`;
            db.query('INSERT INTO SuatChieu (ID_SC, ID_P, ID_PC, NgayGioChieu, GiaVe) VALUES (?, ?, ?, ?, ?)', [ID_SC, ID_P, ID_PC, NgayGioChieu, GiaVe], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.redirect('/profile/admin/showtimes');
            });
        });
    });
};

exports.deleteShowtime = (req, res) => {
    const ID_SC = req.body.ID_SC || req.params.id; // Accept ID from both form submission and URL parameter
    db.query('DELETE FROM SuatChieu WHERE ID_SC = ?', [ID_SC], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/profile/admin/showtimes');
    });
};

// Hide Showtime
exports.hideShowtime = (req, res) => {
    const { id } = req.body;
    
    // Since we're only hiding in the UI, we just return success
    res.json({ success: true, message: `Showtime ${id} hidden successfully` });
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
    db.query('SELECT * FROM PhongChieu WHERE TenPhong = ? AND ID_R = ?', [TenPhong, ID_R], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            return res.render('admin_rooms', { user: req.session.user, error: 'Phòng chiếu đã tồn tại cho rạp này.' });
        }
        db.query('SELECT COUNT(*) AS count FROM PhongChieu', (err, countResult) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }
            const ID_PC = `PC${countResult[0].count + 1}`;
            db.query('INSERT INTO PhongChieu (ID_PC, ID_R, TenPhong, LoaiPhong) VALUES (?, ?, ?, ?)', [ID_PC, ID_R, TenPhong, LoaiPhong], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.redirect('/profile/admin/rooms');
            });
        });
    });
};

// Delete Room
exports.deleteRoom = (req, res) => {
    const { ID_PC } = req.body;
    db.query('DELETE FROM PhongChieu WHERE ID_PC = ?', [ID_PC], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/profile/admin/rooms');
    });
};

// Hide Room
exports.hideRoom = (req, res) => {
    const { id } = req.body;
    
    // Since we're only hiding in the UI, we just return success
    res.json({ success: true, message: `Room ${id} hidden successfully` });
};
