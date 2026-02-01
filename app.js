require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var connectDB = require('./config/database');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var conversationsRouter = require('./routes/conversations');

var app = express();

// Database connection
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://datn-fe-silk.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép Postman / server-to-server
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(logger('dev'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/conversations', conversationsRouter);

module.exports = app;
