const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');



const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

exports.register = (req, res) => {
   

    // const name = req.body.name;
    // const email = req.body.email;
    // const password = req.body.password;
    // const passwordConfirm = req.body.passwordConfirm;

    const {HoTen, NgaySinh, SDT, Email, TenTaiKhoan, MatKhau, MatKhau2} = req.body;
    console.log("Họ tên:",HoTen);
    console.log("Ngày sinh:", NgaySinh);
    console.log("Số điện thoại:", SDT);
    console.log("Email:", Email);
    console.log("Tên tài khoản:", TenTaiKhoan);
    console.log("Mật khẩu:", MatKhau[0]);
    console.log("Mật khẩu xác thực:", MatKhau2[0]);
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
                    const user = result[0];
                     // Lưu thông tin người dùng vào session
                     req.session.user = {
                        ID_U: ID_U,
                        TenTaiKhoan: TenTaiKhoan,
                        HoTen: HoTen,
                        NgaySinh: NgaySinh,
                        SDT: SDT,
                        Email: Email,
                        TongSoTien: 0, // Giá trị mặc định
                    };
                    return res.redirect('/'); // Chuyển hướng đến URL /index
                }
            });
        });
    });

    
    
}



exports.login = async (req, res) => {
    

    const { TenTaiKhoan, MatKhau } = req.body;
    console.log("Tài khoản:",TenTaiKhoan);
    console.log("Mật khẩu:", MatKhau[0]);
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

        // Lưu thông tin người dùng vào session
        req.session.user = {
            ID_U: user.ID_U,
            TenTaiKhoan: user.TenTaiKhoan,
            HoTen: user.HoTen,
            NgaySinh: user.NgaySinh,
            SDT: user.SDT,
            Email: user.Email,
            TongSoTien: user.TongSoTien,

        };
        
        // Tạo mã OTP
        const otp = exports.generateOtp();
        req.session.otp = otp; // Lưu OTP vào session
        req.session.otpExpires = Date.now() + 5 * 60 * 1000; // OTP hết hạn sau 5 phút

        // Gửi OTP qua email
        exports.sendOtp(user.Email, otp)
            .then(() => {
                res.render('otp', { message: 'Mã OTP đã được gửi đến email của bạn!' });
            })
            .catch((err) => {
                console.error('Error sending OTP:', err);
                res.status(500).send('Không thể gửi mã OTP. Vui lòng thử lại sau.');
            });
    });
};

exports.forgot_pass = (req, res) => { 
    console.log(req.body);

    const { Email } = req.body;

    if (!Email) {
        return res.render('forgot_pass', {
            message: 'Vui lòng nhập email!'
        });
    }

    db.query('SELECT * FROM users WHERE Email = ?', [Email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Nếu không tìm thấy tài khoản
        if (results.length === 0) {
            return res.render('forgot_pass', {
                message: 'Email không tồn tại!'
            });
        }

        // Tạo token với email của người dùng
        const token = jwt.sign({ email: Email }, process.env.JWT_SECRET, { expiresIn: '15m' }); // Token hết hạn sau 15 phút

        // Thêm token vào link trong email
        const resetLink = `http://localhost:3000/auth/verify_code?token=${token}`;
        var transporter = nodemailer.createTransport({
            
            host: process.env.GMAIL_HOST,
            port: process.env.GMAIL_PORT,
            secure: false,
            auth: {
              user:  process.env.GMAIL_USER,
              pass: process.env.GMAIL_APP_PASSWORD
            }
        });
          
        var mailOptions = {
            from: process.env.GMAIL_USER,
            to: Email,
            subject: 'Sending Email using Node.js',
            text: `Nhấn vào link sau để đặt lại mật khẩu: ${resetLink}`,
        };
        
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

        // Nếu tài khoản tồn tại, gửi email đặt lại mật khẩu (chưa thực hiện trong đoạn mã này)
        return res.render('share/successed_mail', {
            message: 'Đã gửi email đặt lại mật khẩu cho email!'
        });
    });
};
exports.verifyOtp = (req, res) => {
    const { otp } = req.body;

    if (!req.session.otp || !req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP không hợp lệ hoặc đã hết hạn!' });
    }

    if (Date.now() > req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP đã hết hạn!' });
    }

    if (otp !== req.session.otp) {
        return res.render('otp', { message: 'Mã OTP không đúng!' });
    }

    // Xác thực thành công
    req.session.otp = null; // Xóa OTP khỏi session
    req.session.otpExpires = null;
    res.redirect('/'); // Chuyển hướng đến trang chính
};

exports.verify_code = (req, res) => {
    const token = req.query.token;

    // Kiểm tra token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.render('error', {
                message: 'Link không hợp lệ hoặc đã hết hạn!'
            });
        }

        // Nếu token hợp lệ, hiển thị form đổi mật khẩu
        res.render('reset_pass', { Email: decoded.email });
    });
};

exports.reset_pass = async (req, res) => {
    const { Email, MatKhau, MatKhau2 } = req.body;

    if (!Email) {
        return res.render('reset_pass', {
            message: 'Email không hợp lệ!'
        });
    }

    // Kiểm tra xem mật khẩu mới và xác nhận mật khẩu có khớp không
    if (MatKhau !== MatKhau2) {
        return res.render('reset_pass', {
            message: 'Mật khẩu xác thực không khớp!'
        });
    }

    // Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(MatKhau, 8);

    // Cập nhật mật khẩu trong cơ sở dữ liệu
    db.query('SELECT * FROM users WHERE Email = ?', [Email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        db.query('UPDATE users SET MatKhau = ? WHERE Email = ?', [hashedPassword, Email], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Nếu cập nhật thành công
            return res.render('login', {
                message: 'Đặt lại mật khẩu thành công!'
            });
        });
    });
};

exports.generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Tạo mã OTP 6 chữ số
};

exports.sendOtp = (email, otp) => {
    const transporter = nodemailer.createTransport({
        host: process.env.GMAIL_HOST,
        port: process.env.GMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Mã OTP xác thực của bạn',
        text: `Mã OTP của bạn là: ${otp}. Mã này có hiệu lực trong 5 phút.`
    };

    return transporter.sendMail(mailOptions);
};

exports.loginWithOtp = (req, res) => {
    const { TenTaiKhoan, MatKhau } = req.body;

    db.query('SELECT * FROM users WHERE TenTaiKhoan = ?', [TenTaiKhoan], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.render('login', { message: 'Tài khoản không tồn tại!' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(MatKhau, user.MatKhau);

        if (!isMatch) {
            return res.render('login', { message: 'Mật khẩu không đúng!' });
        }

        // Tạo mã OTP
        const otp = exports.generateOtp();
        req.session.otp = otp; // Lưu OTP vào session
        req.session.otpExpires = Date.now() + 5 * 60 * 1000; // OTP hết hạn sau 5 phút
        req.session.user = user; // Lưu thông tin người dùng vào session

        // Gửi OTP qua email
        exports.sendOtp(user.Email, otp)
            .then(() => {
                res.render('otp', { message: 'Mã OTP đã được gửi đến email của bạn!' });
            })
            .catch((err) => {
                console.error('Error sending OTP:', err);
                res.status(500).send('Không thể gửi mã OTP. Vui lòng thử lại sau.');
            });
    });
};

exports.verifyOtp = (req, res) => {
    const { otp } = req.body;

    if (!req.session.otp || !req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP không hợp lệ hoặc đã hết hạn!' });
    }

    if (Date.now() > req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP đã hết hạn!' });
    }

    if (otp !== req.session.otp) {
        return res.render('otp', { message: 'Mã OTP không đúng!' });
    }

    // Xác thực thành công
    req.session.otp = null; // Xóa OTP khỏi session
    req.session.otpExpires = null;
    res.redirect('/'); //
};