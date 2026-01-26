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
app.use(cors());
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/conversations', conversationsRouter);
app.use('/conversations/first-with-messages', conversationsRouter);
app.use('/conversations/newmessage', conversationsRouter);


module.exports = app;
