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

  // BEH sistemi üçün əlavə sahələr
  advancePayment: {
    amount: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'terminal'],
    },
    paidAt: {
      type: Date
    },
    // ✅ YENİ - Qəbzin şəkli (Cloudinary)
    receiptImage: {
      url: {
        type: String, // Cloudinary URL
        default: null
      },
      publicId: {
        type: String, // Silmə üçün lazım
        default: null
      },
      uploadedAt: {
        type: Date,
        default: null
      }
    }
  },

  // ✅ YENİ - Qalan ödəniş qarışıq üsullarla ola bilər
  remainingPayment: {
    cash: {
      type: Number,
      default: 0
    },
    card: {
      type: Number,
      default: 0
    },
    terminal: {
      type: Number,
      default: 0
    },
    paidAt: {
      type: Date
    }
  },

  // Köhnə payment method (geriyə uyğunluq üçün saxlanılır)
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'terminal', 'mixed'],
  },

  paymentType: {
    type: String,
    enum: ['cash', 'card', 'terminal', 'gift_card', 'mixed'],
    required: function () { return this.status === 'completed'; }
  },

  giftCard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GiftCard'
  },

  // ✅ YENİ - BAHŞIŞ (TIPS) SİSTEMİ
  tips: {
    amount: {
      type: Number,
      default: 0
    },
    paymentMethods: {
      cash: {
        type: Number,
        default: 0
      },
      card: {
        type: Number,
        default: 0
      },
      terminal: {
        type: Number,
        default: 0
      }
    },
    paidAt: {
      type: Date
    }
  },

  notes: {
    type: String
  },

  // ✅ YENİ - ENDİRİM SİSTEMİ
  discountApplied: {
    type: Boolean,
    default: false
  },

  discount: {
    percent: Number, // 10 və ya 25
    amount: Number, // Endirilən məbləğ
    originalPrice: Number, // Endirimsiz qiymət
    reason: String // Həftə sonu endirimi / Həftə içi endirimi
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ✅ YENİ - MÜŞTƏRİ RƏYİ VƏ MƏMNUNIYYƏT REYTİNQİ
  customerFeedback: {
    response: {
      type: String,
      default: null
    },
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    submittedAt: {
      type: Date,
      default: null
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }
}, {
  timestamps: true
});

// Virtual field - tam ödənilib ya yox
appointmentSchema.virtual('isFullyPaid').get(function () {
  if (this.status !== 'completed') return false;
  if (this.paymentType === 'gift_card') return true;

  const advanceAmount = this.advancePayment?.amount || 0;
  const remainingTotal = (this.remainingPayment?.cash || 0) +
    (this.remainingPayment?.card || 0) +
    (this.remainingPayment?.terminal || 0);

  const totalPaid = advanceAmount + remainingTotal;
  return totalPaid >= this.price;
});

// Virtual field - ümumi bahşiş məbləği
appointmentSchema.virtual('totalTips').get(function () {
  return (this.tips?.paymentMethods?.cash || 0) +
    (this.tips?.paymentMethods?.card || 0) +
    (this.tips?.paymentMethods?.terminal || 0);
});

// Virtual field - ümumi qazanc (xidmət + bahşiş)
appointmentSchema.virtual('totalRevenue').get(function () {
  return this.price + this.totalTips;
});

appointmentSchema.virtual('hasReceipt').get(function () {
  return this.advancePayment?.receiptImage?.url ? true : false;
});

module.exports = mongoose.model('Appointment', appointmentSchema);