// models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Məbləğ tələb olunur'],
    min: [0, 'Məbləğ mənfi ola bilməz']
  },
  description: {
    type: String,
    required: [true, 'İzahat tələb olunur'],
    trim: true,
    maxLength: [500, 'İzahat çox uzundur']
  },
  category: {
    type: String,
    required: [true, 'Kateqoriya tələb olunur'],
    enum: [
      'Maaş və Əmək haqqı',
      'Məhsul və Avadanlıq',
      'Kommunal xərclər',
      'Təmizlik məhsulları',
      'Təmir və bərpa',
      'Reklam və marketinq',
      'Digər xərclər'
    ]
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// İndexlər performans üçün
expenseSchema.index({ branch: 1, date: -1 });
expenseSchema.index({ branch: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);