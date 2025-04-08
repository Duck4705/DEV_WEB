const mysql = require('mysql');
const bcrypt = require('bcryptjs');

// Database connection
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

// Register function
exports.register = async (req, res) => {
    console.log(req.body);
    const { name, email, password, passwordConfirm } = req.body;

    // Check if the email already exists
    db.query('SELECT EMAIL FROM users WHERE EMAIL = ?', [email], async (error, result) => {
        if (error) {
            console.log(error);
            return res.render('register', {
                message: 'An error occurred. Please try again.'
            });
        }

        if (result.length > 0) {
            return res.render('register', {
                message: 'That email is already in use'
            });
        }

        if (password !== passwordConfirm) {
            return res.render('register', {
                message: 'Passwords do not match'
            });
        }

        try {
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 8);
            console.log('Hashed Password:', hashedPassword);

            // Insert the user into the database
            db.query(
                'INSERT INTO users SET ?',
                { name: name, email: email, password: hashedPassword },
                (error, result) => {
                    if (error) {
                        console.log(error);
                        return res.render('register', {
                            message: 'An error occurred. Please try again.'
                        });
                    }

                    console.log(result);
                    return res.render('register', {
                        message: 'User registered successfully'
                    });
                }
            );
        } catch (err) {
            console.log(err);
            return res.render('register', {
                message: 'An error occurred while hashing the password.'
            });
        }
    });
};