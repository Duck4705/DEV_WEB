const mysql = require('mysql2');
const dotenv = require('dotenv');

// Tải các biến môi trường từ file .env để truy xuất data
dotenv.config({
    path: './.env'
});

// Cấu hình database MySQL để cho phép truy cập vào cơ sở dữ liệu
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    port: 3000
});

// Kết nối đến cơ sở dữ liệu
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MYSQL database!');
});

module.exports = db;