const express = require('express');
const path = require('path'); // Import the path module
const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html')); // Serve index.html
});

router.get('/DieuKhoanChung', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/DieuKhoanChung.html'));
});

module.exports = router;