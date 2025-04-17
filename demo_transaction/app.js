const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({path: './.env'});
//Khởi tạo express app
const app = express();

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST, //use IP if you have server 
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'hbs');

db.connect((err) => {
    if (err) throw err;
    console.log("MySQL Connected...");
});

//Define Routes
app.use('/', require('./routes/page'));
app.use('/payment', require('./routes/payment'));
app.use(express.json());

app.listen(3017,()=>{
    console.log("Server is running on port 3017")
})
