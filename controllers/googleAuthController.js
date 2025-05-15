const passport = require('passport');

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
