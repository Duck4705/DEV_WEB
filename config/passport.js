const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

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
