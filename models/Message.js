const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation_id: {
        type: String,
        default: ''
    },
    content: {
        type: String,
        default: ''
    },
    type: {
        type: Number,
        default: 1
    },
    uiDraft: {
      type: Array,
      default: []
    },
    uiImages: {
      type: Array,
      default: []
    },
    role: {
        type: String,
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

messageSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Message', messageSchema, 'message');

