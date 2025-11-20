// models/Masseur.js
const mongoose = require('mongoose');

const masseurSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  specialties: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  // Yeni əlavə - Qeyri-iş günləri
  blockedDates: [{
    date: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      default: 'İstirahət günü'
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Helper method - Müəyyən tarixdə masajist bloklanıbmı?
masseurSchema.methods.isBlockedOnDate = function(date) {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  return this.blockedDates.some(blocked => {
    const blockedDate = new Date(blocked.date);
    blockedDate.setHours(0, 0, 0, 0);
    return blockedDate.getTime() === checkDate.getTime();
  });
};

module.exports = mongoose.model('Masseur', masseurSchema);