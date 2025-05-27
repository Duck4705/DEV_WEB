const mysql = require('mysql2');
const dotenv = require('dotenv');

<<<<<<< HEAD
=======
// Tải các biến môi trường từ file .env để truy xuất data
>>>>>>> refs/remotes/origin/develop
dotenv.config({
    path: './.env'
});

<<<<<<< HEAD
=======
// Cấu hình database MySQL để cho phép truy cập vào cơ sở dữ liệu
>>>>>>> refs/remotes/origin/develop
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

<<<<<<< HEAD
=======
// Kết nối đến cơ sở dữ liệu
>>>>>>> refs/remotes/origin/develop
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MYSQL database!');
});

module.exports = db;