// models/GiftCard.js
const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
  cardNumber: {
    type: String,
    required: true,
    unique: true,
  },
  massageType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MassageType',
    required: true
  },
  duration: {
    type: Number,
    required: true // dəqiqə ilə
  },
  originalPrice: {
    type: Number,
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedDate: {
    type: Date
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  usedInAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
giftCardSchema.index({ cardNumber: 1 });
giftCardSchema.index({ branch: 1, isUsed: 1 });

// Generate unique card number
giftCardSchema.statics.generateCardNumber = async function() {
  let cardNumber;
  let exists = true;
  
  while (exists) {
    // Generate 12-digit card number
    cardNumber = 'GC' + Math.random().toString(36).substr(2, 10).toUpperCase();
    const existingCard = await this.findOne({ cardNumber });
    exists = !!existingCard;
  }
  
  return cardNumber;
};

module.exports = mongoose.model('GiftCard', giftCardSchema);