const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    fullName: {
      type: String,
      default: ''
    },

    phone: {
      type: String,
      default: ''
    },

    role: {
      type: String,
      enum: ['ADMIN', 'USER'],
      default: 'USER'
    },

    status: {
      type: Number,
      default: 1 // 1: active, 0: inactive, -1: banned
    },

    lastLoginAt: {
      type: Date
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// auto update updatedAt
accountSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Account', accountSchema, 'account');
