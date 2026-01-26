const mongoose = require('mongoose');

/* ===== Main schema: BA Document ===== */
const baDocumentSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: String,
      required: true,
    },

    project: {
      name: { type: String, default: null },
      description: { type: String, default: null },
      targetUsers: { type: [String], default: [] },
    },

    design: {
      mainColor: { type: String, default: null },
      style: { type: String, default: null },
      tone: { type: String, default: null },
    },

    pages: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },

    status: {
      currentStep: { type: String, default: 'pages' },
      missing: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BaDocument', baDocumentSchema, 'badocument');
