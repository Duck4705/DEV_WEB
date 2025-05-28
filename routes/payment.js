const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/payment');

router.get('/transaction_step1', transactionController.getTransactionStep1);
router.post('/transaction_step2', transactionController.postTransactionStep2);
router.get('/vnpay_return', transactionController.vnpayReturn);
router.get('/transaction_step3', transactionController.getTransactionStep3);
router.get('/dieu-khoan-chung', transactionController.getDieuKhoan);

module.exports = router;
