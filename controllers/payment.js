const db = require('../db');
const moment = require('moment');
const crypto = require('crypto');
const qs = require('qs');
const websocketController = require('./websocket');

// Helper function
function sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(obj[key]).replace(/%20/g, "+");
        sorted[encodedKey] = encodedValue;
    });
    return sorted;
}

// Helper function to fetch booking details
async function fetchBookingAndRender(bookingId, res, view, extra = {}) {
    try {
        // First check temporary bookings
        const tempBooking = websocketController.temporaryBookings.get(bookingId);
        
        if (tempBooking) {
            // Calculate remaining time in seconds
            const remainingTime = Math.max(0, Math.floor((tempBooking.expiresAt - Date.now()) / 1000));
            
            // If time expired, cancel booking and show error
            if (remainingTime <= 0) {
                await websocketController.cancelBooking(bookingId);
                return res.render('error', { 
                    message: 'Thời gian đặt vé đã hết. Vui lòng chọn ghế lại.',
                    returnUrl: '/'
                });
            }
            
            // Get screening details
            const screeningDetails = await new Promise((resolve, reject) => {
                db.query(`
                    SELECT sc.NgayGioChieu, rp.TenRap, pc.TenPhong,
                           GROUP_CONCAT(CONCAT(g.SoGhe, ' (', g.LoaiGhe, ')') SEPARATOR ', ') as seatDetails
                    FROM SuatChieu sc 
                    JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC
                    JOIN RapPhim rp ON pc.ID_R = rp.ID_R
                    JOIN Ghe g ON g.ID_PC = pc.ID_PC
                    WHERE sc.ID_SC = ? AND g.ID_G IN (?)
                    GROUP BY sc.ID_SC
                `, [tempBooking.screeningId, tempBooking.seatInfos.map(seat => seat.seatId_G)], (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0]);
                });
            });

            const seatList = screeningDetails.seatDetails || tempBooking.seatInfos.map(seat => seat.seatId_G).join(', ');
            const dateObj = new Date(screeningDetails.NgayGioChieu);
            const suatchieu = dateObj.toLocaleString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit',
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh' // Always use Vietnam timezone for display
            });

            return res.render(view, {
                bookingId,
                totalPrice: tempBooking.totalPrice,
                seatList: seatList,
                suatchieu,
                rap: screeningDetails.TenRap,
                phongChieu: screeningDetails.TenPhong,
                remainingTime: remainingTime, // Add remaining time
                ...extra
            });
        }

        // If not found in temporary bookings, check database
        const results = await new Promise((resolve, reject) => {
            db.query(`
                SELECT dv.TongTien, 
                       GROUP_CONCAT(CONCAT(g.SoGhe, ' (', g.LoaiGhe, ')')SEPARATOR ', ') as seats,
                       sc.NgayGioChieu, rp.TenRap, pc.TenPhong
                FROM DatVe dv
                JOIN ChiTietDatVe ct ON dv.ID_DV = ct.ID_DV
                JOIN SuatChieu sc ON dv.ID_SC = sc.ID_SC
                JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC
                JOIN RapPhim rp ON pc.ID_R = rp.ID_R
                JOIN Ghe g ON ct.ID_G = g.ID_G
                WHERE dv.ID_DV = ?
                GROUP BY dv.ID_DV`, [bookingId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
        });

        if (!results || results.length === 0) {
            throw new Error('Không tìm thấy thông tin đặt vé');
        }

        const rawDate = results[0].NgayGioChieu;
        const dateObj = new Date(rawDate);
        const suatchieu = dateObj.toLocaleString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit',
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh' // Always use Vietnam timezone for display
        });

        res.render(view, {
            bookingId,
            totalPrice: results[0].TongTien,
            seatList: results[0].seats,
            suatchieu,
            rap: results[0].TenRap,
            phongChieu: results[0].TenPhong,
            ...extra
        });
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).send('Đã xảy ra lỗi khi xử lý thông tin đặt vé');
    }
}

exports.getTransactionStep1 = async (req, res) => {
    const bookingId = req.query.bookingId;
    if (!bookingId) return res.redirect('/');
    await fetchBookingAndRender(bookingId, res, 'Transaction_Step1');
};

exports.getTransactionStep2 = async (req, res) => {
    const bookingId = req.query.bookingId;
    if (!bookingId) return res.redirect('/');
    await fetchBookingAndRender(bookingId, res, 'Transaction_Step2');
};

exports.postTransactionStep2 = async (req, res) => {
    const { bookingId, payment_method } = req.body;
    
    if (!bookingId || !payment_method) {
        return fetchBookingAndRender(bookingId, res, 'Transaction_Step2', {
            error: 'Vui lòng chọn phương thức thanh toán!'
        });
    }

    try {
        // Get booking info first
        const tempBooking = websocketController.temporaryBookings.get(bookingId);
        let amount = 0;
        
        if (tempBooking) {
            // Check if booking has expired
            const remainingTime = Math.max(0, Math.floor((tempBooking.expiresAt - Date.now()) / 1000));
            if (remainingTime <= 0) {
                await websocketController.cancelBooking(bookingId);
                return res.render('error', {
                    message: 'Thời gian đặt vé đã hết. Vui lòng chọn ghế lại.',
                    returnUrl: '/'
                });
            }
            
            amount = Math.round(tempBooking.totalPrice);
        } else {
            // Check if it exists in database
            const booking = await new Promise((resolve, reject) => {
                db.query('SELECT TongTien FROM DatVe WHERE ID_DV = ?', [bookingId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results && results.length > 0 ? results[0] : null);
                });
            });

            if (!booking) {
                return res.status(404).send('Không tìm thấy thông tin đặt vé');
            }
            amount = Math.round(booking.TongTien);
        }

        if (payment_method === 'vnpay') {
            // Set timezone to Vietnam Standard Time
            process.env.TZ = 'Asia/Ho_Chi_Minh';
            
            let date = new Date();
            let createDate = moment(date).format('YYYYMMDDHHmmss');
            
            let ipAddr = req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;

            let tmnCode = process.env.vnp_TmnCode;
            let secretKey = process.env.vnp_HashSecret;
            let vnpUrl = process.env.vnp_Url;
            let returnUrl = process.env.vnp_ReturnUrl;
            let orderId = moment(date).format('DDHHmmss');

            let locale = req.body.language || 'vn';
            let currCode = 'VND';

            let vnp_Params = {};
            vnp_Params['vnp_Version'] = '2.1.0';
            vnp_Params['vnp_Command'] = 'pay';
            vnp_Params['vnp_TmnCode'] = tmnCode;
            vnp_Params['vnp_Locale'] = locale;
            vnp_Params['vnp_CurrCode'] = currCode;
            vnp_Params['vnp_TxnRef'] = orderId;
            vnp_Params['vnp_OrderInfo'] = 'Thanh toan ve xem phim - Ma GD:' + orderId;
            vnp_Params['vnp_OrderType'] = 'other';
            vnp_Params['vnp_Amount'] = amount * 100;
            vnp_Params['vnp_ReturnUrl'] = `${returnUrl}?bookingId=${bookingId}`;
            vnp_Params['vnp_IpAddr'] = ipAddr;
            vnp_Params['vnp_CreateDate'] = createDate;

            vnp_Params = sortObject(vnp_Params);

            let querystring = require('qs');
            let signData = querystring.stringify(vnp_Params, { encode: false });
            let crypto = require("crypto");     
            let hmac = crypto.createHmac("sha512", secretKey);
            let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex"); 
            vnp_Params['vnp_SecureHash'] = signed;
            vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

            console.log("Redirecting to VNPay URL:", vnpUrl);
            return res.redirect(vnpUrl);
        }

        if (payment_method === 'cash') {
            if (tempBooking) {
                await websocketController.confirmBooking(bookingId);
            }
            return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=00`);
        }

        return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=00`);
    } catch (error) {
        console.error('Error in postTransactionStep2:', error);
        return fetchBookingAndRender(bookingId, res, 'Transaction_Step2', {
            error: 'Đã xảy ra lỗi khi xử lý thanh toán. Vui lòng thử lại.'
        });
    }
};

exports.vnpayReturn = async (req, res) => {
    try {
        console.log('Starting VNPay return processing with query:', req.query);
        
        var vnp_Params = {};
        const bookingId = req.query.bookingId;
        
        if (!bookingId) {
            console.error('No bookingId provided in return URL');
            return res.redirect('/payment/transaction_step3?code=99&message=Thiếu thông tin đặt vé');
        }

        // Only include vnp_ parameters for signature verification
        for (let key in req.query) {
            if (key.startsWith('vnp_')) {
                vnp_Params[key] = req.query[key];
            }
        }

        var secureHash = vnp_Params['vnp_SecureHash'];
        if (!secureHash) {
            console.error('No secure hash provided in return URL');
            return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=97&message=Thiếu chữ ký bảo mật`);
        }

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        vnp_Params = sortObject(vnp_Params);
        var signData = qs.stringify(vnp_Params, { encode: false });
        var hmac = crypto.createHmac("sha512", process.env.vnp_HashSecret);
        var signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");

        if (secureHash === signed) {
            const responseCode = vnp_Params['vnp_ResponseCode'];
            if (responseCode === '00') {
                try {
                    const tempBooking = websocketController.temporaryBookings.get(bookingId);
                    if (!tempBooking) {
                        return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=99&message=Không tìm thấy thông tin đặt vé tạm thời`);
                    }

                    const paidAmount = parseInt(vnp_Params['vnp_Amount']) / 100;
                    if (paidAmount !== tempBooking.totalPrice) {
                        await websocketController.cancelBooking(bookingId);
                        return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=99&message=Số tiền thanh toán không khớp`);
                    }

                    await websocketController.confirmBooking(bookingId);
                    
                    // Only store transaction history if user is logged in
                    if (req.session && req.session.user && req.session.user.ID_U) {
                        try {
                            await new Promise((resolve, reject) => {
                                db.query(
                                    'INSERT INTO LichSuGiaoDich (ID_U, NgayGD, TheLoaiGD, PhuongThucGD, ID_GD) VALUES (?, NOW(), ?, ?, ?)',
                                    [req.session.user.ID_U, 'Thanh toán vé', 'VNPay', vnp_Params['vnp_TransactionNo']],
                                    (err) => {
                                        if (err) {
                                            console.error('Error recording transaction:', err);
                                            reject(err);
                                        } else {
                                            resolve();
                                        }
                                    }
                                );
                            });
                        } catch (error) {
                            console.error('Failed to store transaction history:', error);
                            // Continue with the payment process even if storing history fails
                        }
                    }

                    return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=00`);
                } catch (error) {
                    console.error('Error processing payment:', error);
                    try {
                        await websocketController.cancelBooking(bookingId);
                    } catch (cancelError) {
                        console.error('Error canceling booking:', cancelError);
                    }
                    return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=99&message=Lỗi xác nhận đặt vé: ${error.message}`);
                }
            } else {
                try {
                    const tempBooking = websocketController.temporaryBookings.get(bookingId);
                    if (tempBooking) {
                        await websocketController.cancelBooking(bookingId);
                    }
                } catch (error) {
                    console.error('Error canceling booking:', error);
                }
                return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=${responseCode}`);
            }
        } else {
            try {
                const tempBooking = websocketController.temporaryBookings.get(bookingId);
                if (tempBooking) {
                    await websocketController.cancelBooking(bookingId);
                }
            } catch (error) {
                console.error('Error canceling booking:', error);
            }
            return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=97&message=Chữ ký không hợp lệ`);
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return res.redirect(`/payment/transaction_step3?bookingId=${bookingId}&code=99&message=Lỗi hệ thống: ${error.message}`);
    }
};

exports.getTransactionStep3 = async (req, res) => {
    const { bookingId, code, message } = req.query;
    
    try {
        if (!bookingId) {
            return res.redirect('/');
        }

        // Get booking details for display
        let bookingDetails;
        let tempBooking = websocketController.temporaryBookings.get(bookingId);

        if (code === '00') { // Payment successful
            if (tempBooking) {
                try {
                    // Confirm the booking in database
                    await websocketController.confirmBooking(bookingId);
                    console.log('Temporary booking confirmed:', bookingId);
                } catch (error) {
                    console.error('Error confirming booking:', error);
                    return res.render('Transaction_Step3', {
                        code: '99',
                        bookingId,
                        message: 'Đã xảy ra lỗi khi xác nhận đặt vé. Vui lòng liên hệ nhân viên để được hỗ trợ.'
                    });
                }
            }

            // Get confirmed booking details from database
            bookingDetails = await new Promise((resolve, reject) => {
                db.query(`
                    SELECT 
                        dv.ID_DV,
                        dv.TongTien,
                        GROUP_CONCAT(CONCAT(g.SoGhe, ' (', g.LoaiGhe, ')')) as seats,
                        sc.NgayGioChieu,
                        rp.TenRap,
                        pc.TenPhong,
                        p.TenPhim
                    FROM DatVe dv
                    JOIN ChiTietDatVe ct ON dv.ID_DV = ct.ID_DV
                    JOIN SuatChieu sc ON dv.ID_SC = sc.ID_SC
                    JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC
                    JOIN RapPhim rp ON pc.ID_R = rp.ID_R
                    JOIN Phim p ON sc.ID_P = p.ID_P
                    JOIN Ghe g ON ct.ID_G = g.ID_G
                    WHERE dv.ID_DV = ?
                    GROUP BY dv.ID_DV
                `, [bookingId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0]);
                });
            });

            if (!bookingDetails) {
                return res.render('Transaction_Step3', {
                    code: '99',
                    bookingId,
                    message: 'Không tìm thấy thông tin đặt vé'
                });
            }

            // Format date for display
            const dateObj = new Date(bookingDetails.NgayGioChieu);
            const suatchieu = dateObj.toLocaleString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit',
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh' // Always use Vietnam timezone for display
            });

            return res.render('Transaction_Step3', {
                code: '00',
                bookingId,
                bookingDetails: {
                    ...bookingDetails,
                    suatchieu,
                    totalPrice: bookingDetails.TongTien.toLocaleString('vi-VN'),
                    seats: bookingDetails.seats.split(',').join(', ')
                },
                message: message || 'Đặt vé thành công!'
            });
        } else { // Payment failed or cancelled
            if (tempBooking) {
                try {
                    // Cancel the booking
                    await websocketController.cancelBooking(bookingId);
                    console.log('Temporary booking cancelled:', bookingId);
                } catch (error) {
                    console.error('Error cancelling booking:', error);
                }
            }

            let errorMessage = 'Đã xảy ra lỗi trong quá trình thanh toán.';
            switch (code) {
                case '24':
                    errorMessage = 'Giao dịch không thành công do: Khách hàng hủy giao dịch';
                    break;
                case '51':
                    errorMessage = 'Giao dịch không thành công do: Số dư tài khoản không đủ';
                    break;
                case '65':
                    errorMessage = 'Giao dịch không thành công do: Tài khoản của quý khách đã vượt quá hạn mức giao dịch trong ngày.';
                    break;
                case '75':
                    errorMessage = 'Ngân hàng thanh toán đang bảo trì.';
                    break;
                case '99':
                    errorMessage = message || 'Các lỗi khác';
                    break;
            }

            return res.render('Transaction_Step3', {
                code,
                bookingId,
                message: errorMessage
            });
        }
    } catch (error) {
        console.error('Error in getTransactionStep3:', error);
        res.render('Transaction_Step3', {
            code: '99',
            bookingId,
            message: 'Đã xảy ra lỗi khi xử lý giao dịch. Vui lòng liên hệ nhân viên để được hỗ trợ.'
        });
    }
};

exports.getDieuKhoan = (req, res) => {
    res.render('DieuKhoanChung');
};
