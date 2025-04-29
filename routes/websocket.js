const express = require('express');
const websocketController = require('../controllers/websocket');
const router = express.Router();


router.get('/api/refresh',  websocketController.refresh);

// API endpoint để lấy giá vé từ bảng SuatChieu
router.get('/api/ticket-price', websocketController.getTicketPrice); // Đã sửa dấu chấm thành dấu phẩy

// API endpoint để lấy thông tin loại ghế
router.get('/api/seat-types', websocketController.getSeatTypes);

module.exports = router;