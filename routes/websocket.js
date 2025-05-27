const express = require('express');
const websocketController = require('../controllers/websocket');
const router = express.Router();

<<<<<<< HEAD

router.get('/api/refresh',  websocketController.refresh);

// API endpoint để lấy giá vé từ bảng SuatChieu
router.get('/api/ticket-price', websocketController.getTicketPrice); // Đã sửa dấu chấm thành dấu phẩy

// API endpoint để lấy thông tin loại ghế
=======
// Các route cho WebSocket, bao gồm các route để lấy ghế ngồi, giá vé và làm mới
router.get('/api/refresh',  websocketController.refresh);
router.get('/api/ticket-price', websocketController.getTicketPrice); 
>>>>>>> refs/remotes/origin/develop
router.get('/api/seat-types', websocketController.getSeatTypes);

module.exports = router;