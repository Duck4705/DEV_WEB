const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const session = require('express-session');
<<<<<<< HEAD
const http = require('http');
const WebSocket = require('ws');
const websocketController = require('./controllers/websocket');
const db = require('./db'); // Import db từ file cấu hình
=======
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const hbs = require('hbs');
>>>>>>> feature/adminrole1

dotenv.config({
    path: './.env'
});

const app = express();
<<<<<<< HEAD
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.set('wss', wss);
app.set('db', db);

=======

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

module.exports = db;
>>>>>>> feature/adminrole1

const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set('view engine', 'hbs');

<<<<<<< HEAD
=======
// Register Handlebars helper for equality check
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

>>>>>>> feature/adminrole1
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

<<<<<<< HEAD
=======
// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    const googleId = profile.id;
    const email = profile.emails[0].value;
    const displayName = profile.displayName;
    db.query(
        'SELECT * FROM Users WHERE Email = ?',
        [email],
        (err, results) => {
            if (err) {
                console.error('Lỗi khi kiểm tra user:', err);
                return done(err);
            }
            if (results.length > 0) {
                const user = results[0];
                return done(null, user);
            } else {
                const newUser = {
                    ID_U: googleId,
                    Email: email,
                    HoTen: displayName,
                    TenTaiKhoan: email.split('@')[0] + '_google',
                    MatKhau: 'google_oauth',
                    VaiTro: 'user'
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

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());

>>>>>>> feature/adminrole1
app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));
<<<<<<< HEAD
app.use('/api', require('./routes/websocket'));

websocketController.initWebSocketHandlers(wss);

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
=======

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

// CHANGES FOR ADMIN ROLE 1
// Added hbs import and registered 'eq' Handlebars helper for role comparisons
>>>>>>> feature/adminrole1
