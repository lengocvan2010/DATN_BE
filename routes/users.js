var express = require('express');
var router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Account = require('../models/Account');

const JWT_SECRET = process.env.JWT_SECRET || 'DATN_SECRET_KEY';

/**
 * POST /users/register
 * body: { fullName, phone, email, password, confirmPassword }
 */
router.post('/register', async function (req, res) {
  try {
    const { fullName, phone, email, password } = req.body;

    // 1. validate
    if (!fullName || !email || !password ) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc'
      });
    }

    // 2. check email tồn tại
    const existed = await Account.findOne({ email });
    if (existed) {
      return res.status(409).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    // 3. hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. tạo account
    const account = new Account({
      email,
      password: hashedPassword,
      username: fullName,
      phone,
      role: 'USER',
      status: 1,
      createdAt: new Date()
    });

    await account.save();

    return res.json({
      success: true,
      message: 'Đăng ký thành công'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
});

/**
 * POST /users/login
 * body: { email, password }
 */
router.post('/login', async function (req, res) {
  try {
    const { email, password } = req.body;

    // 1. validate
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email và password là bắt buộc'
      });
    }

    // 2. tìm account
    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc password không đúng'
      });
    }

    // 3. check status
    if (account.status !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khoá'
      });
    }

    // 4. so password
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc password không đúng'
      });
    }

    // 5. tạo token
    const token = jwt.sign(
      { id: account._id, role: account.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 6. update last login
    account.lastLoginAt = new Date();
    await account.save();

    // 7. set cookie
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Login thành công',
      data: {
        id: account._id,
        email: account.email,
        username: account.username,
        role: account.role
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
});

module.exports = router;
