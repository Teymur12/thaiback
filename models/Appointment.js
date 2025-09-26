// models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  masseur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Masseur',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  massageType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MassageType',
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
 paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'terminal'],
    required: function() { 
      return this.status === 'completed' && this.paymentType !== 'gift_card'; 
    }
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
   giftCard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GiftCard'
  },
  paymentType: {
    type: String,
    enum: ['cash', 'card', 'terminal', 'gift_card'],
    required: function() { return this.status === 'completed'; }
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Appointment', appointmentSchema);
