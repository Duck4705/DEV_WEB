const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

dotenv.config({
    path: './.env'
});

const app = express();

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MYSQL database!');
});

module.exports = db; // Xuất kết nối cơ sở dữ liệu

const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: false }));
// Parse JSON bodies (as sent by API clients)
app.use(express.json());

app.set('view engine', 'hbs');

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        req.sessionID = sessionId;
    }
    next();
});

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    // Xử lý thông tin người dùng từ Google
    const googleId = profile.id;
    const email = profile.emails[0].value;
    const displayName = profile.displayName;

    // Kiểm tra xem người dùng đã tồn tại trong DB chưa (dựa trên Email)
    db.query(
        'SELECT * FROM Users WHERE Email = ?',
        [email],
        (err, results) => {
            if (err) {
                console.error('Lỗi khi kiểm tra user:', err);
                return done(err);
            }

            if (results.length > 0) {
                // Người dùng đã tồn tại, trả về thông tin user
                const user = results[0];
                return done(null, user);
            } else {
                // Người dùng chưa tồn tại, tạo mới
                const newUser = {
                    ID_U: googleId,
                    Email: email,
                    HoTen: displayName, // Lưu displayName vào cột HoTen
                    TenTaiKhoan: email.split('@')[0] + '_google', // Tạo TenTaiKhoan mặc định
                    MatKhau: 'google_oauth', // Mật khẩu mặc định (không dùng)
                    VaiTro: 'user' // Vai trò mặc định
                };

                db.query(
                    'INSERT INTO Users (ID_U, Email, HoTen, TenTaiKhoan, MatKhau, VaiTro) VALUES (?, ?, ?, ?, ?, ?)',
                    [newUser.ID_U, newUser.Email, newUser.HoTen, newUser.TenTaiKhoan, newUser.MatKhau, newUser.VaiTro],
                    (err) => {
                        if (err) {
                            console.error('Lỗi khi tạo user mới:', err);
                            return done(err);
                        }
                        return done(null, newUser);
                    }
                );
            }
        }
    );
}));

// Serialize user to session
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
    done(null, user);
});

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Define routes
app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});