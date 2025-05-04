const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const hbs = require('hbs');
const http = require('http');
const WebSocket = require('ws');
const websocketController = require('./controllers/websocket');
const db = require('./db'); // Import db từ file cấu hình

dotenv.config({
    path: './.env'
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.set('wss', wss);
app.set('db', db);

const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set('view engine', 'hbs');

// Register Handlebars helper for equality check
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Đặt thành true trong môi trường sản xuất với HTTPS
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

// Routes
app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));
app.use('/api', require('./routes/websocket'));

// Initialize WebSocket handlers
websocketController.initWebSocketHandlers(wss);

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});