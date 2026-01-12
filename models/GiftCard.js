const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
  cardNumber: {
    type: String,
    required: true,
    unique: true,
  },

  // ===== KÖHNƏ FORMAT (Backward Compatibility) =====
  // Tək masajlı köhnə gift cardlar üçün saxlanılır
  massageType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MassageType',
    required: function () {
      // Yalnız massages array boşdursa tələb olunur
      return !this.massages || this.massages.length === 0;
    }
  },
  duration: {
    type: Number,
    required: function () {
      return !this.massages || this.massages.length === 0;
    }
  },
  originalPrice: {
    type: Number,
    required: function () {
      return !this.massages || this.massages.length === 0;
    }
  },

  // ===== YENİ FORMAT (Multi-Massage Support) =====
  // Çoxlu masajlı yeni gift cardlar üçün
  massages: [{
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
    }
  }],

  // ===== ÜMUMI SAHƏLƏR =====
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'terminal'],
    default: 'cash'
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

  // Köhnə format üçün saxlanılır
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

giftCardSchema.index({ cardNumber: 1 });
giftCardSchema.index({ branch: 1, isUsed: 1 });
giftCardSchema.index({ branch: 1, purchaseDate: 1 });

// ===== VIRTUAL FIELDS =====

// Ümumi masaj sayı
giftCardSchema.virtual('totalMassages').get(function () {
  if (this.massages && this.massages.length > 0) {
    return this.massages.length;
  }
  return 1; // Köhnə format - 1 masaj
});

// İstifadə edilmiş masaj sayı
giftCardSchema.virtual('usedMassages').get(function () {
  if (this.massages && this.massages.length > 0) {
    return this.massages.filter(m => m.isUsed).length;
  }
  return this.isUsed ? 1 : 0; // Köhnə format
});

// Qalan masaj sayı
giftCardSchema.virtual('remainingMassages').get(function () {
  if (this.massages && this.massages.length > 0) {
    return this.massages.filter(m => !m.isUsed).length;
  }
  return this.isUsed ? 0 : 1; // Köhnə format
});

// Ümumi dəyər
giftCardSchema.virtual('totalValue').get(function () {
  if (this.massages && this.massages.length > 0) {
    return this.massages.reduce((sum, m) => sum + m.price, 0);
  }
  return this.originalPrice || 0; // Köhnə format
});

// Virtual fields JSON-da göstərmək üçün
giftCardSchema.set('toJSON', { virtuals: true });
giftCardSchema.set('toObject', { virtuals: true });

// ===== HELPER METHODS =====

// Köhnə formatda olub-olmadığını yoxlayır
giftCardSchema.methods.isSingleMassageCard = function () {
  return !this.massages || this.massages.length === 0;
};

// Köhnə formatı yeni formata çevirir
giftCardSchema.methods.convertToMultiMassage = function () {
  if (this.isSingleMassageCard() && this.massageType) {
    this.massages = [{
      massageType: this.massageType,
      duration: this.duration,
      price: this.originalPrice,
      isUsed: this.isUsed,
      usedDate: this.usedDate,
      usedBy: this.usedBy,
      usedInAppointment: this.usedInAppointment
    }];
  }
  return this;
};

// İstifadə olunmamış masajları qaytarır
giftCardSchema.methods.getAvailableMassages = function () {
  if (this.isSingleMassageCard()) {
    // Köhnə format - əgər istifadə olunmayıbsa, özünü qaytarır
    if (!this.isUsed) {
      return [{
        massageType: this.massageType,
        duration: this.duration,
        price: this.originalPrice
      }];
    }
    return [];
  }

  // Yeni format - istifadə olunmamış masajları filter edir
  return this.massages.filter(m => !m.isUsed);
};

// Bütün masajlar istifadə edilibmi yoxlayır
giftCardSchema.methods.isFullyUsed = function () {
  if (this.isSingleMassageCard()) {
    return this.isUsed;
  }
  return this.massages.every(m => m.isUsed);
};

// ===== STATIC METHODS =====

giftCardSchema.statics.generateCardNumber = async function () {
  let cardNumber;
  let exists = true;

  while (exists) {
    cardNumber = 'GC' + Math.random().toString(36).substr(2, 10).toUpperCase();
    const existingCard = await this.findOne({ cardNumber });
    exists = !!existingCard;
  }

  return cardNumber;
};

module.exports = mongoose.model('GiftCard', giftCardSchema);