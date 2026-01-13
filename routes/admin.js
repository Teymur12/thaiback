// routes/admin.js
const express = require('express');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Masseur = require('../models/Masseur');
const MassageType = require('../models/MassageType');
const Appointment = require('../models/Appointment');
const Expense = require('../models/Expense');
const GiftCard = require('../models/GiftCard');
const Customer = require('../models/Customer'); // ❗ ƏLAVƏ EDİLDİ
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// WhatsApp link generator - ❗ ƏLAVƏ EDİLDİ
function generateWhatsAppLink(phone, message) {
  let cleanPhone = phone.replace(/[^0-9]/g, '');

  if (!cleanPhone.startsWith('994')) {
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '994' + cleanPhone.substring(1);
    } else {
      cleanPhone = '994' + cleanPhone;
    }
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

// CUSTOMER ROUTES - ❗ ƏLAVƏ EDİLDİ

// POST - Yeni müştəri
router.post('/customers/:token', auth, adminAuth, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET - Bütün müştərilər
router.get('/customers/:token', auth, adminAuth, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET - Telefona görə müştəri axtar
router.get('/customers/:token/search/phone/:phone', auth, adminAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return res.status(404).json({ message: 'Bu telefon numarasına ait müşteri bulunamadı' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT - Müştəri yenilə
router.put('/customers/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE - Müştəri sil
router.delete('/customers/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCustomer = await Customer.findByIdAndDelete(id);

    if (!deletedCustomer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    res.json({
      message: 'Müşteri başarıyla silindi',
      deletedCustomer
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

router.put('/receptionists/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    updateData.role = 'receptionist';

    if (updateData.password && updateData.password.trim() !== '') {
      const user = await User.findById(id);
      if (!user || user.role !== 'receptionist') {
        return res.status(404).json({ message: 'Resepsiyon personeli bulunamadı' });
      }

      Object.assign(user, updateData);
      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json(userResponse);
    } else {
      if (updateData.password === '') {
        delete updateData.password;
      }

      const updatedReceptionist = await User.findOneAndUpdate(
        { _id: id, role: 'receptionist' },
        updateData,
        { new: true, runValidators: true }
      ).populate('branch');

      if (!updatedReceptionist) {
        return res.status(404).json({ message: 'Resepsiyon personeli bulunamadı' });
      }

      const userResponse = updatedReceptionist.toObject();
      delete userResponse.password;

      res.json(userResponse);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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

const Package = require('../models/Package'); // ❗ ƏLAVƏ EDİLDİ
// Daily Reports - token param ilə
router.get('/reports/daily/:date/:token', auth, adminAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const appointments = await Appointment.find({
      startTime: { $gte: date, $lt: nextDay },
      status: 'completed'
    }).populate('branch masseur massageType customer');

    const advancePayments = await Appointment.find({
      'advancePayment.paidAt': { $gte: date, $lt: nextDay },
      'advancePayment.amount': { $gt: 0 }
    }).populate('branch masseur massageType customer');

    const expenses = await Expense.find({
      date: { $gte: date, $lt: nextDay }
    }).populate('branch');

    const giftCardSales = await GiftCard.find({
      purchaseDate: { $gte: date, $lt: nextDay }
    }).populate('branch massageType purchasedBy');

    // ❗ YENİ: Paket satışlarını gətir
    const packageSales = await Package.find({
      createdAt: { $gte: date, $lt: nextDay }
    }).populate('branch massageType customer');

    const report = {
      date: req.params.date,
      branches: {}
    };

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
          advancePayments: {
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
          // ❗ YENİ: Package Sales strukturu
          packageSales: {
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

    advancePayments.forEach(appointment => {
      const branchId = appointment.branch._id.toString();
      initBranch(branchId, appointment.branch.name);

      const advAmount = appointment.advancePayment.amount;
      const advMethod = appointment.advancePayment.paymentMethod;

      report.branches[branchId].advancePayments[advMethod] += advAmount;
      report.branches[branchId].advancePayments.total += advAmount;
      report.branches[branchId].advancePayments.count++;
    });

    appointments.forEach(appointment => {
      const branchId = appointment.branch._id.toString();
      initBranch(branchId, appointment.branch.name);

      if (appointment.paymentType === 'gift_card') {
        report.branches[branchId].appointments++;
        return;
      }

      if (appointment.advancePayment?.amount > 0 && appointment.remainingPayment?.amount > 0) {
        const remAmount = appointment.remainingPayment.amount;
        const remMethod = appointment.remainingPayment.paymentMethod;

        report.branches[branchId].revenue[remMethod] += remAmount;
        report.branches[branchId].revenue.total += remAmount;
        report.branches[branchId].appointments++;
      }
      else if (!appointment.advancePayment?.amount || appointment.advancePayment.amount === 0) {
        const paymentMethod = appointment.paymentMethod;
        const price = appointment.price;

        report.branches[branchId].revenue[paymentMethod] += price;
        report.branches[branchId].revenue.total += price;
        report.branches[branchId].appointments++;
      }
      else {
        report.branches[branchId].appointments++;
      }
    });

    giftCardSales.forEach(giftCard => {
      const branchId = giftCard.branch._id.toString();
      initBranch(branchId, giftCard.branch.name);

      const paymentMethod = giftCard.paymentMethod || 'cash';
      report.branches[branchId].giftCardSales[paymentMethod] += giftCard.originalPrice;
      report.branches[branchId].giftCardSales.total += giftCard.originalPrice;
      report.branches[branchId].giftCardSales.count++;
    });

    // ❗ YENİ: Paket satışlarını hesabla
    packageSales.forEach(pkg => {
      const branchId = pkg.branch._id.toString();
      initBranch(branchId, pkg.branch.name);

      const paymentMethod = pkg.paymentMethod || 'cash';
      report.branches[branchId].packageSales[paymentMethod] += pkg.price;
      report.branches[branchId].packageSales.total += pkg.price;
      report.branches[branchId].packageSales.count++;
    });

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

    Object.keys(report.branches).forEach(branchId => {
      const branch = report.branches[branchId];

      branch.totalRevenue = branch.revenue.total +
        branch.advancePayments.total +
        branch.giftCardSales.total +
        branch.packageSales.total; // ❗ Əlavə edildi

      branch.netRevenue = branch.totalRevenue - branch.expenses.total;
    });

    res.json(report);
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ message: error.message });
  }
});

// APPOINTMENT ROUTES

router.post('/appointments/:token', auth, adminAuth, async (req, res) => {
  try {
    const appointmentData = {
      ...req.body
      // ❗ branch və createdBy req.body-dən gəlir (admin seçir)
    };

    if (req.body.advancePayment && req.body.advancePayment.amount > 0) {
      appointmentData.advancePayment = {
        amount: req.body.advancePayment.amount,
        paymentMethod: req.body.advancePayment.paymentMethod,
        paidAt: new Date()
      };
    }

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customer masseur massageType branch');

    res.status(201).json(populatedAppointment);
  } catch (error) {
    console.error('Appointment creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

router.put('/appointments/:id/complete/:token', auth, adminAuth, async (req, res) => {
  try {
    const { paymentMethod, paymentType, giftCardNumber } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate('customer');

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    const updateData = {
      status: 'completed',
      paymentType: paymentType || 'cash'
    };

    if (paymentType === 'gift_card' && giftCardNumber) {
      const giftCard = await GiftCard.findOne({ cardNumber: giftCardNumber });

      if (!giftCard) {
        return res.status(400).json({ message: 'Hədiyyə kartı tapılmadı' });
      }

      if (giftCard.isUsed) {
        return res.status(400).json({ message: 'Bu hədiyyə kartı artıq istifadə olunub' });
      }

      if (giftCard.expiryDate < new Date()) {
        return res.status(400).json({ message: 'Bu hədiyyə kartının müddəti bitib' });
      }

      giftCard.isUsed = true;
      giftCard.usedDate = new Date();
      giftCard.usedInAppointment = req.params.id;
      await giftCard.save();

      updateData.giftCard = giftCard._id;
      updateData.price = 0;
    }
    else if (appointment.advancePayment && appointment.advancePayment.amount > 0) {
      const remainingAmount = appointment.price - appointment.advancePayment.amount;

      if (remainingAmount > 0) {
        updateData.remainingPayment = {
          amount: remainingAmount,
          paymentMethod: paymentMethod,
          paidAt: new Date()
        };
      }

      updateData.paymentType = 'mixed';
    }
    else {
      updateData.paymentMethod = paymentMethod;
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('customer masseur massageType branch giftCard');

    let whatsappLink = null;
    if (updatedAppointment.customer && updatedAppointment.customer.phone) {
      whatsappLink = generateWhatsAppLink(
        updatedAppointment.customer.phone,
        `Salam! Xidmətimizdən razı qaldınızmı? 😊 Sizə göstərilən xidməti 1-5 arası bir rəqəmlə qiymətləndirməyinizi xahiş edirik.`
      );
    }

    res.json({
      ...updatedAppointment.toObject(),
      whatsappLink
    });

  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(400).json({ message: error.message });
  }
});

// ❗ DƏYİŞDİRİLDİ - Admin bütün filialların randevularını görür
router.get('/appointments/:date/:token', auth, adminAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // ❗ branch filter yoxdur
    const appointments = await Appointment.find({
      startTime: { $gte: date, $lt: nextDay }
    }).populate('customer masseur massageType branch'); // branch populate edildi

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/appointments/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.startTime || req.body.endTime || req.body.masseur) {
      const currentAppointment = await Appointment.findById(id);

      const updatedData = {
        masseur: req.body.masseur || currentAppointment.masseur,
        branch: req.body.branch || currentAppointment.branch,
        startTime: req.body.startTime || currentAppointment.startTime,
        endTime: req.body.endTime || currentAppointment.endTime
      };

      const conflictingAppointment = await Appointment.findOne({
        _id: { $ne: id },
        masseur: updatedData.masseur,
        branch: updatedData.branch,
        status: { $ne: 'cancelled' },
        $or: [
          {
            startTime: {
              $lt: new Date(updatedData.endTime),
              $gte: new Date(updatedData.startTime)
            }
          },
          {
            endTime: {
              $gt: new Date(updatedData.startTime),
              $lte: new Date(updatedData.endTime)
            }
          },
          {
            startTime: { $lte: new Date(updatedData.startTime) },
            endTime: { $gte: new Date(updatedData.endTime) }
          }
        ]
      });

      if (conflictingAppointment) {
        return res.status(400).json({
          message: 'Bu vaxt aralığında masajist artıq məşğuldur!'
        });
      }
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name')
      .populate('branch', 'name');

    if (!updatedAppointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    res.json(updatedAppointment);
  } catch (error) {
    console.error('Randevu güncəllə xətası:', error);
    res.status(400).json({ message: error.message });
  }
});

// routes/admin.js - əlavə routes

// GET - BEH qəbzıləri (filtrlənə bilər)
router.get('/receipts/:token', auth, adminAuth, async (req, res) => {
  try {
    const { date, branch, status } = req.query;

    let query = {
      'advancePayment.receiptImage.url': { $exists: true, $ne: null }
    };

    // Tarixə görə filter
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      query['advancePayment.receiptImage.uploadedAt'] = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Filialə görə filter
    if (branch) {
      query.branch = branch;
    }

    // Status-a görə filter
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name')
      .populate('branch', 'name')
      .sort({ 'advancePayment.receiptImage.uploadedAt': -1 });

    const receipts = appointments.map(apt => ({
      _id: apt._id,
      customer: apt.customer,
      masseur: apt.masseur,
      massageType: apt.massageType,
      branch: apt.branch,
      advancePayment: {
        amount: apt.advancePayment.amount,
        paymentMethod: apt.advancePayment.paymentMethod,
        receiptImage: apt.advancePayment.receiptImage
      },
      appointmentStatus: apt.status,
      startTime: apt.startTime,
      price: apt.price
    }));

    res.json(receipts);
  } catch (error) {
    console.error('Receipts fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET - Spesifik randevunun qəbzisini gör
router.get('/receipts/:appointmentId/view/:token', auth, adminAuth, async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name')
      .populate('branch', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    if (!appointment.advancePayment?.receiptImage?.url) {
      return res.status(404).json({ message: 'Qəbzi şəkli yoxdur' });
    }

    res.json({
      _id: appointment._id,
      customer: appointment.customer,
      masseur: appointment.masseur,
      massageType: appointment.massageType,
      branch: appointment.branch,
      advancePayment: appointment.advancePayment,
      appointmentStatus: appointment.status,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      duration: appointment.duration,
      price: appointment.price
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET - Tarixə görə bütün qəbzılərin hesabatı
router.get('/receipts/report/daily/:date/:token', auth, adminAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const appointments = await Appointment.find({
      'advancePayment.receiptImage.uploadedAt': { $gte: date, $lt: nextDay }
    })
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name')
      .populate('branch', 'name')
      .sort({ 'advancePayment.receiptImage.uploadedAt': -1 });

    const report = {
      date: req.params.date,
      totalReceipts: appointments.length,
      totalAmount: 0,
      byBranch: {},
      byPaymentMethod: {
        cash: 0,
        card: 0,
        terminal: 0
      },
      receipts: []
    };

    appointments.forEach(apt => {
      const branchId = apt.branch._id.toString();
      const method = apt.advancePayment.paymentMethod;
      const amount = apt.advancePayment.amount;

      // Ümumi məbləğ
      report.totalAmount += amount;

      // Ödəniş üsulu
      report.byPaymentMethod[method] += amount;

      // Filialə görə
      if (!report.byBranch[branchId]) {
        report.byBranch[branchId] = {
          name: apt.branch.name,
          count: 0,
          total: 0
        };
      }
      report.byBranch[branchId].count++;
      report.byBranch[branchId].total += amount;

      // Qəbzilər siyahısı
      report.receipts.push({
        _id: apt._id,
        customer: apt.customer,
        masseur: apt.masseur,
        massageType: apt.massageType,
        branch: apt.branch,
        advancePayment: apt.advancePayment,
        appointmentStatus: apt.status,
        startTime: apt.startTime,
        price: apt.price
      });
    });

    res.json(report);
  } catch (error) {
    console.error('Receipt report error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
