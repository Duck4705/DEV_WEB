const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

exports.register = (req, res) => {
    console.log(req.body);

    // const name = req.body.name;
    // const email = req.body.email;
    // const password = req.body.password;
    // const passwordConfirm = req.body.passwordConfirm;

    const {HoTen, NgaySinh, SDT, Email, TenTaiKhoan, MatKhau, MatKhau2} = req.body;

    db.query('SELECT * FROM users WHERE Email = ? OR TenTaiKhoan = ?', [Email, TenTaiKhoan], async (err, result) => {
        if (err) {
            console.log(err);
        }
        if(result.length > 0) {
            return res.render('register', {
                message: 'Gmail hoặc tên đăng nhập đã được sử dụng!'
            });
        } else if (MatKhau !== MatKhau2) {
            return res.render('register', {
                message: 'Mật khẩu xác thực không khớp!'
            });
        }

        let hashedPassword = await bcrypt.hash(MatKhau, 8);
        console.log(hashedPassword);
        // Tạo ID_U tự động tăng dần
        // Lấy số lượng người dùng hiện tại trong cơ sở dữ liệu
        db.query('SELECT COUNT(*) AS userCount FROM users', (err, countResult) => {
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }
        
            const userCount = countResult[0].userCount; // Lấy số lượng người dùng
            const ID_U = 'U' + (userCount + 1); // Tạo ID_U là U + số thứ tự
        
            db.query('INSERT INTO users SET ?', {
                ID_U: ID_U,
                HoTen: HoTen,
                NgaySinh: NgaySinh,
                SDT: SDT,
                Email: Email,
                NgayTaoTaiKhoan: db.raw('NOW()'),
                VaiTro: "KhachHang",
                TenTaiKhoan: TenTaiKhoan,
                MatKhau: hashedPassword,
                TongSoTien: 0
            }, (err, result) => {
                if (err) {
                    console.log(err);
                } else {
                    return res.redirect('/'); // Chuyển hướng đến URL /index
                }
            });
        });
    });

    
    
}

exports.login = async (req, res) => {
    console.log(req.body);

    const { TenTaiKhoan, MatKhau } = req.body;

    // Kiểm tra xem tài khoản có tồn tại trong cơ sở dữ liệu không
    db.query('SELECT * FROM users WHERE TenTaiKhoan = ?', [TenTaiKhoan], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Nếu không tìm thấy tài khoản
        if (results.length === 0) {
            return res.render('login', {
                message: 'Tài khoản không tồn tại!'
            });
        }

        // Kiểm tra mật khẩu
        const user = results[0];
        const isMatch = await bcrypt.compare(MatKhau, user.MatKhau);

        if (!isMatch) {
            return res.render('login', {
                message: 'Mật khẩu không đúng!'
            });
        }

        // Nếu tài khoản và mật khẩu đúng
        return res.redirect('/'); // Chuyển hướng đến trang chính
    });
};