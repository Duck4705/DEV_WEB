const express = require('express');
const websocketController = require('../controllers/websocket');
const router = express.Router();

// Các route cho WebSocket, bao gồm các route để lấy ghế ngồi, giá vé và làm mới
router.get('/api/refresh',  websocketController.refresh);
router.get('/api/ticket-price', websocketController.getTicketPrice); 
router.get('/api/seat-types', websocketController.getSeatTypes);

module.exports = router;