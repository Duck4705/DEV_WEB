const db = require('../db'); // Kết nối cơ sở dữ liệu

exports.getMovieDetails = (req, res) => {
    const user = req.session.user; // Lấy thông tin người dùng từ session
    const ID_P = req.params.ID_P; // Lấy ID phim từ URL

    const movieQuery = 'SELECT * FROM Phim WHERE ID_P = ?';
    const showtimeQuery = `
        SELECT sc.ID_SC, sc.NgayGioChieu, pc.TenPhong, rp.TenRap
        FROM SuatChieu sc
        JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC
        JOIN RapPhim rp ON pc.ID_R = rp.ID_R
        WHERE sc.ID_P = ?
        ORDER BY sc.NgayGioChieu ASC
    `;

    db.query(movieQuery, [ID_P], (err, movieResults) => {
        if (err) {
            console.error('Database error (movie):', err);
            return res.status(500).send('Internal Server Error');
        }

        if (movieResults.length === 0) {
            return res.status(404).send('Phim không tồn tại');
        }

        const phim = movieResults[0]; // Lấy thông tin phim đầu tiên

        db.query(showtimeQuery, [ID_P], (err, showtimeResults) => {
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
    });
};