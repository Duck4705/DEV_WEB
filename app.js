const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
require('./config/passport'); // Thêm dòng này để load cấu hình passport
const hbs = require('hbs');
const http = require('http');
const WebSocket = require('ws');
const websocketController = require('./controllers/websocket');
const db = require('./db'); // Import db từ file cấu hình
const authRoutes = require('./routes/auth'); // Đảm bảo đã require đúng router

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

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', require('./routes/pages'));
app.use('/auth', authRoutes); // Đảm bảo đã mount router này
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));
app.use('/api', require('./routes/websocket'));

// Initialize WebSocket handlers
websocketController.initWebSocketHandlers(wss);

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});