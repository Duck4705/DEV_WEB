const db = require('../db'); // Kết nối cơ sở dữ liệu

// Function để tạo slug từ tên phim
function createSlug(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .normalize('NFD') // Normalize Unicode
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/đ/g, 'd') // Replace đ with d
        .replace(/Đ/g, 'D') // Replace Đ with D
        .replace(/:|\/|\?|#|\[|\]|@|!|\$|&|\(|\)|\*|\+|,|;|=|%|\.|"|'|>|<|\\|\{|\}|\||^|~|`/g, ' ') // Replace special chars with spaces
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .trim() // Remove leading/trailing spaces
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Function để tìm phim bằng slug hoặc ID
function findMovieBySlugOrId(identifier, callback) {
    // Trước tiên thử tìm phim bằng ID (backward compatibility)
    const idQuery = 'SELECT * FROM Phim WHERE ID_P = ?';
    db.query(idQuery, [identifier], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        
        if (results.length > 0) {
            return callback(null, results[0]);
        }
        
        // Nếu không tìm thấy bằng ID, lấy tất cả phim và so sánh slug
        db.query('SELECT * FROM Phim', (err, allMovies) => {
            if (err) {
                return callback(err, null);
            }
            
            // Tìm phim có slug khớp với identifier
            for (const movie of allMovies) {
                const movieSlug = createSlug(movie.TenPhim);
                if (movieSlug === identifier) {
                    return callback(null, movie);
                }
            }
            
            // Không tìm thấy phim nào
            callback(null, null);
        });
    });
}

exports.getMovieDetails = (req, res) => {
    const user = req.session.user; // Lấy thông tin người dùng từ session
    const identifier = req.params.slug; // Lấy slug hoặc ID phim từ URL

    // Tìm phim bằng slug hoặc ID
    findMovieBySlugOrId(identifier, (err, phim) => {
        if (err) {
            console.error('Database error (movie):', err);
            return res.status(500).send('Internal Server Error');
        }

        if (!phim) {
            return res.status(404).send('Phim không tồn tại');
        }

        const showtimeQuery = `
            SELECT sc.ID_SC, sc.NgayGioChieu, pc.TenPhong, rp.TenRap
            FROM SuatChieu sc
            JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC
            JOIN RapPhim rp ON pc.ID_R = rp.ID_R
            WHERE sc.ID_P = ?
            ORDER BY sc.NgayGioChieu ASC
        `;

        db.query(showtimeQuery, [phim.ID_P], (err, showtimeResults) => {
            if (err) {
                console.error('Database error (showtime):', err);
                return res.status(500).send('Internal Server Error');
            }

            // Nhóm giờ chiếu theo rạp và phòng
            const groupedShowtimes = showtimeResults.reduce((acc, curr) => {
                const key = `${curr.TenRap}-${curr.TenPhong}`;
                const formattedTime = new Date(curr.NgayGioChieu).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                if (!acc[key]) {
                    acc[key] = {
                        TenRap: curr.TenRap,
                        TenPhong: curr.TenPhong,
                        screenings: [] // Thay đổi từ GioChieu sang mảng screenings chứa cả giờ và ID
                    };
                }

                // Thêm cả ID_SC và thời gian vào mảng
                acc[key].screenings.push({
                    time: formattedTime,
                    ID_SC: curr.ID_SC
                });
                
                return acc;
            }, {});

            // Chuyển đổi object thành array để dễ render trong Handlebars
            const showtimes = Object.values(groupedShowtimes);

            // Tạo slug cho phim hiện tại
            phim.slug = createSlug(phim.TenPhim);

            // Truyền thông tin phim, suất chiếu và ID_SC vào view
            res.render('movie_details', { user, phim, showtimes });
        });
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

        // Thêm slug cho từng phim
        phim.forEach(movie => {
            movie.slug = createSlug(movie.TenPhim);
        });

        // Render trang index với danh sách phim và thông tin người dùng (nếu có)
        if (user) {
            user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
            return res.render('showing', { user, phim});
        }

        res.render('showing', { phim }); // Không gửi thông tin người dùng nếu không có session
    });
};


exports.getSeatDetails = (req, res) => {
    const user = req.session.user; // Lấy thông tin người dùng từ session
    const ID_SC = req.params.ID_SC; // Lấy ID suất chiếu từ URL

    const screeningQuery = `
        SELECT sc.ID_SC, sc.NgayGioChieu, pc.TenPhong, rp.TenRap, p.TenPhim, sc.GiaVe
        FROM SuatChieu sc
        JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC
        JOIN RapPhim rp ON pc.ID_R = rp.ID_R
        JOIN Phim p ON sc.ID_P = p.ID_P
        WHERE sc.ID_SC = ?
    `;

    db.query(screeningQuery, [ID_SC], (err, screeningResults) => {
        if (err) {
            console.error('Database error (screening):', err);
            return res.status(500).send('Internal Server Error');
        }

        if (screeningResults.length === 0) {
            return res.status(404).send('Suất chiếu không tồn tại');
        }

        const screeningDetails = screeningResults[0];


        if (screeningDetails.TenPhong == "Thống Nhất") {
            // Render view với dữ liệu suất chiếu, không cần khởi tạo ghế ở đây
            // vì ghế sẽ được khởi tạo trong WebSocket khi client kết nối
            res.render('get_seat_thongnhat', { 
                user, 
                screeningDetails,
                ID_SC: screeningDetails.ID_SC,
                phim: screeningDetails.TenPhim,
                rapPhim: screeningDetails.TenRap,
                phongChieu: screeningDetails.TenPhong,
                giaVeDon: screeningDetails.GiaVe,
                giaVeDoi: screeningDetails.GiaVe * 2,
                ngayChieu: new Date(screeningDetails.NgayGioChieu).toLocaleString('vi-VN')
                // Removed giaVe field as it doesn't exist in the database
            });
        }
        else if (screeningDetails.TenPhong == "Giải Phóng") {
            // Render view với dữ liệu suất chiếu, không cần khởi tạo ghế ở đây
            // vì ghế sẽ được khởi tạo trong WebSocket khi client kết nối
            res.render('get_seat_giaiphong', { 
                user, 
                screeningDetails,
                ID_SC: screeningDetails.ID_SC,
                phim: screeningDetails.TenPhim,
                rapPhim: screeningDetails.TenRap,
                phongChieu: screeningDetails.TenPhong,
                giaVeDon: screeningDetails.GiaVe,
                giaVeDoi: screeningDetails.GiaVe * 2,
                ngayChieu: new Date(screeningDetails.NgayGioChieu).toLocaleString('vi-VN')
                // Removed giaVe field as it doesn't exist in the database
            });
        }
    });
};

// Tìm kiếm phim theo tên
exports.searchMovies = (req, res) => {
    const q = req.query.q;
    
    // Simple search first
    const sql = `
        SELECT ID_P, TenPhim, LinkTrailer 
        FROM Phim 
        WHERE TenPhim LIKE ?
        LIMIT 3
    `;
    
    db.query(sql, [`%${q}%`], (err, results) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
          if (results.length === 0) {
            // Try without diacritics if no results
            const simpleSql = `
                SELECT ID_P, TenPhim, LinkTrailer 
                FROM Phim 
                WHERE LOWER(REPLACE(TenPhim, ' ', '')) LIKE LOWER(?)
                LIMIT 5
            `;
            const simpleQuery = `%${q.replace(/ /g, '')}%`;
            
            db.query(simpleSql, [simpleQuery], (err, simpleResults) => {            // Thêm slug cho từng kết quả phim
                if (simpleResults && simpleResults.length > 0) {
                    simpleResults.forEach(movie => {
                        movie.slug = createSlug(movie.TenPhim);
                        // Debug log để kiểm tra slug
                        console.log(`Search result: "${movie.TenPhim}" -> Slug: "${movie.slug}"`);
                    });
                }
                res.json(simpleResults || []);
            });
        } else {
            // Thêm slug cho từng kết quả phim
            results.forEach(movie => {
                movie.slug = createSlug(movie.TenPhim);
            });
            res.json(results);
        }
    });
};