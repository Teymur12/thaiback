// routes/admin.js
const express = require('express');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Masseur = require('../models/Masseur');
const MassageType = require('../models/MassageType');
const Appointment = require('../models/Appointment');
const Expense = require('../models/Expense');
const GiftCard = require('../models/GiftCard');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Branches - token param ilə
router.post('/branches/:token', auth, adminAuth, async (req, res) => {
  try {
    console.log(req.body);
    
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json(branch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/branches/:token', auth, adminAuth, async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json(branches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/branches/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(branch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/branches/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    await Branch.findByIdAndDelete(req.params.id);
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Masseurs - token param ilə
router.post('/masseurs/:token', auth, adminAuth, async (req, res) => {
  try {
    const masseur = new Masseur(req.body);
    await masseur.save();
    res.status(201).json(masseur);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/masseurs/:token', auth, adminAuth, async (req, res) => {
  try {
    const masseurs = await Masseur.find().populate('branch');
    res.json(masseurs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/masseurs/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedMasseur = await Masseur.findByIdAndDelete(id);
    
    if (!deletedMasseur) {
      return res.status(404).json({ message: 'Masaj terapisti bulunamadı' });
    }
    
    res.json({ 
      message: 'Masaj terapisti başarıyla silindi',
      deletedMasseur 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/masseurs/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const updatedMasseur = await Masseur.findByIdAndUpdate(
      id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!updatedMasseur) {
      return res.status(404).json({ message: 'Masaj terapisti bulunamadı' });
    }
    
    res.json(updatedMasseur);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Massage Types - token param ilə
router.post('/massage-types/:token', auth, adminAuth, async (req, res) => {
  try {
    const massageType = new MassageType(req.body);
    await massageType.save();
    res.status(201).json(massageType);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/massage-types/:token', auth, adminAuth, async (req, res) => {
  try {
    const massageTypes = await MassageType.find();
    res.json(massageTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/massage-types/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const updatedMassageType = await MassageType.findByIdAndUpdate(
      id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!updatedMassageType) {
      return res.status(404).json({ message: 'Masaj türü bulunamadı' });
    }
    
    res.json(updatedMassageType);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT - Belirli bir duration'ı güncelle
router.put('/massage-types/:id/:token/durations/:durationId', auth, adminAuth, async (req, res) => {
  try {
    const { id, durationId } = req.params;
    const { minutes, price } = req.body;
    
    const massageType = await MassageType.findById(id);
    if (!massageType) {
      return res.status(404).json({ message: 'Masaj türü bulunamadı' });
    }
    
    const duration = massageType.durations.id(durationId);
    if (!duration) {
      return res.status(404).json({ message: 'Duration bulunamadı' });
    }
    
    duration.minutes = minutes || duration.minutes;
    duration.price = price || duration.price;
    
    await massageType.save();
    res.json(massageType);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE - Belirli bir duration'ı sil
router.delete('/massage-types/:id/:token/durations/:durationId', auth, adminAuth, async (req, res) => {
  try {
    const { id, durationId } = req.params;
    
    const massageType = await MassageType.findById(id);
    if (!massageType) {
      return res.status(404).json({ message: 'Masaj türü bulunamadı' });
    }
    
    const duration = massageType.durations.id(durationId);
    if (!duration) {
      return res.status(404).json({ message: 'Duration bulunamadı' });
    }
    
    duration.remove();
    await massageType.save();
    
    res.json({ 
      message: 'Duration başarıyla silindi',
      massageType 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE - Masaj türü sil
router.delete('/massage-types/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedMassageType = await MassageType.findByIdAndDelete(id);
    
    if (!deletedMassageType) {
      return res.status(404).json({ message: 'Masaj türü bulunamadı' });
    }
    
    res.json({ 
      message: 'Masaj türü başarıyla silindi',
      deletedMassageType 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Receptionists - token param ilə
router.post('/receptionists/:token', auth, adminAuth, async (req, res) => {
  try {
    const receptionist = new User({
      ...req.body,
      role: 'receptionist'
    });
    await receptionist.save();
    res.status(201).json(receptionist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT - Resepsiyon personeli güncelle
router.put('/receptionists/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Role'ü receptionist olarak sabit tut
    updateData.role = 'receptionist';
    
    // Eğer password güncelleniyor ve boş değilse, hash'lenmesi için pre('save') middleware'ini tetikle
    if (updateData.password && updateData.password.trim() !== '') {
      const user = await User.findById(id);
      if (!user || user.role !== 'receptionist') {
        return res.status(404).json({ message: 'Resepsiyon personeli bulunamadı' });
      }
      
      // Password'ü güncelle ve save() ile hash'lensin
      Object.assign(user, updateData);
      await user.save();
      
      // Password'ü response'dan çıkar
      const userResponse = user.toObject();
      delete userResponse.password;
      
      res.json(userResponse);
    } else {
      // Password güncellenmiyor, normal update
      if (updateData.password === '') {
        delete updateData.password; // Boş password'ü silme
      }
      
      const updatedReceptionist = await User.findOneAndUpdate(
        { _id: id, role: 'receptionist' },
        updateData,
        { new: true, runValidators: true }
      ).populate('branch');
      
      if (!updatedReceptionist) {
        return res.status(404).json({ message: 'Resepsiyon personeli bulunamadı' });
      }
      
      // Password'ü response'dan çıkar
      const userResponse = updatedReceptionist.toObject();
      delete userResponse.password;
      
      res.json(userResponse);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE - Resepsiyon personeli sil
router.delete('/receptionists/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedReceptionist = await User.findOneAndDelete({ 
      _id: id, 
      role: 'receptionist' 
    });
    
    if (!deletedReceptionist) {
      return res.status(404).json({ message: 'Resepsiyon personeli bulunamadı' });
    }
    
    // Password'ü response'dan çıkar
    const userResponse = deletedReceptionist.toObject();
    delete userResponse.password;
    
    res.json({ 
      message: 'Resepsiyon personeli başarıyla silindi',
      deletedReceptionist: userResponse 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/receptionists/:token', auth, adminAuth, async (req, res) => {
  try {
    const receptionists = await User.find({ role: 'receptionist' }).populate('branch');
    res.json(receptionists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/masseurs/:masseurId/blocked-dates/:token', auth, adminAuth, async (req, res) => {
  try {
    const { masseurId } = req.params;
    
    const masseur = await Masseur.findById(masseurId)
      .populate('blockedDates.blockedBy', 'name role')
      .populate('branch', 'name');
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı' });
    }
    
    res.json({
      masseur: {
        _id: masseur._id,
        name: masseur.name,
        branch: masseur.branch
      },
      blockedDates: masseur.blockedDates.sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Daily Reports - token param ilə
router.get('/reports/daily/:date/:token', auth, adminAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Completed appointments (bugünkü tamamlanmış randevular)
    const appointments = await Appointment.find({
      startTime: { $gte: date, $lt: nextDay }, // Masaja gəldiyi gün
      status: 'completed'
    }).populate('branch masseur massageType customer');

    // Bugün BEH verilən randevular (gələcək tarixlərdə masaja gələcəklər)
    const advancePayments = await Appointment.find({
      'advancePayment.paidAt': { $gte: date, $lt: nextDay },
      'advancePayment.amount': { $gt: 0 }
    }).populate('branch masseur massageType customer');

    // Expenses
    const expenses = await Expense.find({
      date: { $gte: date, $lt: nextDay }
    }).populate('branch');

    // Gift card sales
    const giftCardSales = await GiftCard.find({
      purchaseDate: { $gte: date, $lt: nextDay }
    }).populate('branch massageType purchasedBy');

    const report = {
      date: req.params.date,
      branches: {}
    };

    // Helper function - filial strukturunu yaradır
    const initBranch = (branchId, branchName) => {
      if (!report.branches[branchId]) {
        report.branches[branchId] = {
          name: branchName,
          revenue: {
            cash: 0,
            card: 0,
            terminal: 0,
            total: 0
          },
          advancePayments: { // BEH gəlirləri
            cash: 0,
            card: 0,
            terminal: 0,
            total: 0,
            count: 0
          },
          giftCardSales: {
            cash: 0,
            card: 0,
            terminal: 0,
            total: 0,
            count: 0
          },
          expenses: {
            total: 0,
            items: []
          },
          appointments: 0
        };
      }
    };

    // 1. BEH (Advance Payments) - bugün verilən behləri əlavə et
    advancePayments.forEach(appointment => {
      const branchId = appointment.branch._id.toString();
      initBranch(branchId, appointment.branch.name);

      const advAmount = appointment.advancePayment.amount;
      const advMethod = appointment.advancePayment.paymentMethod;

      report.branches[branchId].advancePayments[advMethod] += advAmount;
      report.branches[branchId].advancePayments.total += advAmount;
      report.branches[branchId].advancePayments.count++;
    });

    // 2. Completed Appointments - bugün tamamlanan randevular
    appointments.forEach(appointment => {
      const branchId = appointment.branch._id.toString();
      initBranch(branchId, appointment.branch.name);

      // Əgər gift card ilə ödənilibs
      if (appointment.paymentType === 'gift_card') {
        // Gift card hesabata daxil edilməz (ayrıca gift card satışı var)
        report.branches[branchId].appointments++;
        return;
      }

      // Əgər beh verilib və bugün qalan məbləğ ödənilibsə
      if (appointment.advancePayment?.amount > 0 && appointment.remainingPayment?.amount > 0) {
        const remAmount = appointment.remainingPayment.amount;
        const remMethod = appointment.remainingPayment.paymentMethod;

        report.branches[branchId].revenue[remMethod] += remAmount;
        report.branches[branchId].revenue.total += remAmount;
        report.branches[branchId].appointments++;
      } 
      // Əgər tam ödəniş (beh yoxdur)
      else if (!appointment.advancePayment?.amount || appointment.advancePayment.amount === 0) {
        const paymentMethod = appointment.paymentMethod;
        const price = appointment.price;

        report.branches[branchId].revenue[paymentMethod] += price;
        report.branches[branchId].revenue.total += price;
        report.branches[branchId].appointments++;
      }
      // Əgər yalnız beh verilib, hələ gəlməyib (bu halda startTime bu gün olmamalı)
      else {
        report.branches[branchId].appointments++;
      }
    });

    // 3. Gift card satışları
    giftCardSales.forEach(giftCard => {
      const branchId = giftCard.branch._id.toString();
      initBranch(branchId, giftCard.branch.name);

      const paymentMethod = giftCard.paymentMethod || 'cash';
      report.branches[branchId].giftCardSales[paymentMethod] += giftCard.originalPrice;
      report.branches[branchId].giftCardSales.total += giftCard.originalPrice;
      report.branches[branchId].giftCardSales.count++;
    });

    // 4. Xərclər
    expenses.forEach(expense => {
      const branchId = expense.branch._id.toString();
      if (report.branches[branchId]) {
        report.branches[branchId].expenses.total += expense.amount;
        report.branches[branchId].expenses.items.push({
          description: expense.description,
          amount: expense.amount,
          category: expense.category
        });
      }
    });

    // 5. Ümumi hesablamalar
    Object.keys(report.branches).forEach(branchId => {
      const branch = report.branches[branchId];
      
      // Ümumi gəlir = masaj gəlirləri + beh gəlirləri + gift card satışları
      branch.totalRevenue = branch.revenue.total + 
                            branch.advancePayments.total + 
                            branch.giftCardSales.total;
      
      // Xalis gəlir = ümumi gəlir - xərclər
      branch.netRevenue = branch.totalRevenue - branch.expenses.total;
    });

    res.json(report);
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;