var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ 
    message: 'Welcome to Backend API',
    version: '1.0.0'
  });
});

module.exports = router;
