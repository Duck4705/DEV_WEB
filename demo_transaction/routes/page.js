const express = require('express');
const path = require('path'); // Import the path module
const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html')); // Serve index.html
});

router.get('/transaction_Step1', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/Transaction_Step1.html'));
  });

  module.exports = router;