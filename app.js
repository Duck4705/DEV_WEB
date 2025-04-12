const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const session = require('express-session');

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
    secret: 'your_secret_key', // Thay bằng chuỗi bí mật của bạn
    resave: false, // Không lưu lại session nếu không thay đổi
    saveUninitialized: false, // Không lưu session trống
    cookie: {
        httpOnly: true,
        secure: false, // Đặt thành true nếu sử dụng HTTPS
        maxAge: 1000 * 60 * 60 * 24 // Thời gian sống của session (1 ngày)
    }
}));

app.use((req, res, next) => {
    const sessionId = req.headers['x-session-id']; // Lấy session ID từ header
    if (sessionId) {
        req.sessionID = sessionId; // Gán session ID tùy chỉnh
    }
    next();
});

//Define routes
app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});