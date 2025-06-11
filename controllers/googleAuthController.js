const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

// Configure Google Strategy (moved from config/passport.js)
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    const googleId = profile.id;
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
    const displayName = profile.displayName || '';
    
    db.query('SELECT * FROM Users WHERE Email = ?', [email], (err, results) => {
        if (err) {
            console.error('Lỗi khi kiểm tra user:', err);
            return done(err);
        }
        
        if (results.length > 0) {
            const user = results[0];
            return done(null, user);
        } else {
            // Generate new user ID
            db.query('SELECT COUNT(*) AS userCount FROM Users', (err, countResult) => {
                if (err) {
                    console.error('Database error:', err);
                    return done(err);
                }
                
                const userCount = countResult[0].userCount;
                const ID_U = 'U' + (userCount + 1);
                
                // Create username from email
                const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
                
                const newUser = {
                    ID_U: ID_U,
                    Email: email,
                    HoTen: displayName,
                    TenTaiKhoan: username,
                    NgayTaoTaiKhoan: new Date(),
                    VaiTro: 'KhachHang',
                    GoogleID: googleId,
		    MatKhau: null,
                    TongSoTien: 0
                };
                
                db.query(
                    'INSERT INTO Users (ID_U, Email, HoTen, TenTaiKhoan, NgayTaoTaiKhoan, VaiTro, GoogleID, MatKhau, TongSoTien) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [newUser.ID_U, newUser.Email, newUser.HoTen, newUser.TenTaiKhoan, newUser.NgayTaoTaiKhoan, newUser.VaiTro, newUser.GoogleID, newUser.MatKhau, newUser.TongSoTien],
                    (err) => {
                        if (err) {
                            console.error('Lỗi khi tạo user mới:', err);
                            return done(err);
                        }
                        return done(null, newUser);
                    }
                );
            });
        }
    });
}));

// Serialization/deserialization (moved from config/passport.js)
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google OAuth login
exports.googleLogin = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
};

// Google OAuth callback
exports.googleCallback = (req, res, next) => {
    passport.authenticate('google', {
        failureRedirect: '/login'
    })(req, res, function () {
        req.session.user = req.user;
        res.redirect('/');
    });
};

// Đăng xuất Google
exports.googleLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Lỗi khi xóa session:', err);
        }
        res.redirect('https://accounts.google.com/Logout');
    });
};

// Helper function to initialize passport
exports.initializePassport = (app) => {
    app.use(passport.initialize());
    app.use(passport.session());
};
