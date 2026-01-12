// models/MassageType.js
const mongoose = require('mongoose');

const massageTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  durations: [{
    minutes: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    }
  }],
  description: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MassageType', massageTypeSchema);