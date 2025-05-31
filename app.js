// Thêm thư viện dươi dòng này
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const hbs = require('hbs');
const http = require('http');
const WebSocket = require('ws');

// Thêm các local modules dưới dòng này
const websocketController = require('./controllers/websocket');
const googleAuthController = require('./controllers/googleAuthController'); // Updated import
const db = require('./db');
const authRoutes = require('./routes/auth');

// Dưới đây là file biến môi trường, tất cả các dữ liệu bi mật và nhạy cảm buộc phải lưu trong file này
dotenv.config({
    path: './.env'
});

// Thiêt lập HTTP server và WebSocket
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Thiết lập cấu hình trong express
app.set('wss', wss);
app.set('db', db);
app.set('view engine', 'hbs');

// Thiết lập file view và middleware
const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Đăng ký hàm trợ giúp kiểm tra bằng nhau cho Handlebars
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

// Cấu hình phiên làm việc
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

// Initialize passport using the function from googleAuthController
googleAuthController.initializePassport(app);

// Các route phải được thêm dưới này
app.use('/', require('./routes/pages'));
app.use('/auth', authRoutes); 
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));
app.use('/api', require('./routes/websocket'));
app.use('/payment', require('./routes/payment'));

//Thiết lập WebSocket
websocketController.initWebSocketHandlers(wss);

// Start server. Lưu ý khi làm việc thì có thể đổi port khác 3000 nhưng push lên phải để port 3000
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3007');
});