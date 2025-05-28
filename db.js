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
    port: 3000, // Ensure this is a number
    charset: 'utf8mb4'
});

console.log('Connecting to MySQL on port:', process.env.DATABASE_PORT);

// Set connection configurations for UTF-8
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MYSQL database!');
    
    // Set session character set and collation
    const initQueries = [
        'SET NAMES utf8mb4',
        'SET CHARACTER SET utf8mb4',
        'SET collation_connection = utf8mb4_unicode_ci',
        'SET SESSION collation_connection = utf8mb4_unicode_ci'
    ];

    // Execute initialization queries in sequence
    for (const query of initQueries) {
        db.query(query, (err) => {
            if (err) {
                console.error(`Error executing query "${query}":`, err);
            }
        });
    }
});

// Create a promise-based connection to use with async/await
const promiseDb = db.promise();

module.exports = promiseDb;