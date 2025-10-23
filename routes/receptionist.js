// routes/receptionist.js
const express = require('express');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const Masseur = require('../models/Masseur');
const MassageType = require('../models/MassageType');
const Expense = require('../models/Expense'); // Bu sətr əlavə edilməli idi!
const { auth, receptionistAuth } = require('../middleware/auth');
const router = express.Router();

// routes/receptionist.js - faylın yuxarısında
function generateWhatsAppLink(phone, message) {
  // Bütün qeyri-rəqəm simvolları sil (boşluq, tire, mötərizə, + və s.)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  
  // Əgər 994 ilə başlamırsa
  if (!cleanPhone.startsWith('994')) {
    // Əgər 0 ilə başlayırsa (məs: 0507892134)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '994' + cleanPhone.substring(1);
    } 
    // Əgər birbaşa operator kodu ilə başlayırsa (məs: 507892134)
    else {
      cleanPhone = '994' + cleanPhone;
    }
  }
  
  // WhatsApp linkini yarat
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
  

// Customers - token param ilə
router.post('/customers/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/customers/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/customers/:id/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }
    
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT - Müşteri güncelle
router.put('/customers/:id/:token', auth, receptionistAuth, async (req, res) => {
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

// DELETE - Müşteri sil
router.delete('/customers/:id/:token', auth, receptionistAuth, async (req, res) => {
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

// GET - Telefon numarasına göre müşteri ara
router.get('/customers/:token/search/phone/:phone', auth, receptionistAuth, async (req, res) => {
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

// GET - İsme göre müşteri ara
router.get('/customers/:token/search/name/:name', auth, receptionistAuth, async (req, res) => {
  try {
    const { name } = req.params;
    
    const customers = await Customer.find({ 
      name: { $regex: name, $options: 'i' } 
    });
    
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Appointments - token param ilə
// routes/receptionist.js - Appointment əməliyyatları

// POST - Yeni randevu (Beh ilə və ya beh olmadan)
router.post('/appointments/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const appointmentData = {
      ...req.body,
      branch: req.user.branch,
      createdBy: req.user.userId
    };

    // Əgər beh varsa, onu əlavə et
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

// PUT - Randevunu tamamla (Qalan məbləği ödə)
router.put('/appointments/:id/complete/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { paymentMethod, paymentType, giftCardNumber } = req.body;
    
    // ✅ Customer məlumatını populate et
    const appointment = await Appointment.findById(req.params.id)
      .populate('customer'); // ❗ Bunu əlavə edin

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    const updateData = { 
      status: 'completed',
      paymentType: paymentType || 'cash'
    };

    // Gift Card ilə ödəniş
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
    // Əgər əvvəlcədən beh verilib
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
    // Tam ödəniş (beh yoxdur)
    else {
      updateData.paymentMethod = paymentMethod;
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('customer masseur massageType branch giftCard');

    // ✅ WhatsApp linki yarad (müştəri məlumatı varsa)
    let whatsappLink = null;
    if (updatedAppointment.customer && updatedAppointment.customer.phone) {
      whatsappLink = generateWhatsAppLink(
        updatedAppointment.customer.phone,
        `Salam! Xidmətimizdən razı qaldınızmı? 😊 Sizə göstərilən xidməti 1-5 arası bir rəqəmlə qiymətləndirməyinizi xahiş edirik.`
      );
    }

    // ✅ Response-da appointment + whatsapp link
    res.json({
      ...updatedAppointment.toObject(), // ❗ toObject() əlavə edin
      whatsappLink
    });

  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET - Randevuları çək (bugünkü və ya tarixə görə)
router.get('/appointments/:date/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const appointments = await Appointment.find({
      branch: req.user.branch,
      startTime: { $gte: date, $lt: nextDay }
    }).populate('customer masseur massageType');

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT - Randevunu yenilə
// PUT - Randevunu yenilə
router.put('/appointments/:id/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vaxt dəyişdirilirsə, konflikt yoxla
    if (req.body.startTime || req.body.endTime || req.body.masseur) {
      const currentAppointment = await Appointment.findById(id);
      
      if (!currentAppointment) {
        return res.status(404).json({ message: 'Randevu tapılmadı' });
      }
      
      const updatedData = {
        masseur: req.body.masseur || currentAppointment.masseur,
        branch: req.body.branch || currentAppointment.branch,
        startTime: req.body.startTime || currentAppointment.startTime,
        endTime: req.body.endTime || currentAppointment.endTime
      };

      // ✅ DÜZƏLİŞ: _id-ni query-nin əsas hissəsində exclude et
      const conflictingAppointment = await Appointment.findOne({
        _id: { $ne: id }, // ❗ Burada düzgün istifadə olunur
        masseur: updatedData.masseur,
        branch: updatedData.branch,
        status: { $ne: 'cancelled' },
        $or: [
          {
            // Yeni randevu başlayır, köhnə davam edir
            startTime: {
              $lt: new Date(updatedData.endTime),
              $gte: new Date(updatedData.startTime)
            }
          },
          {
            // Yeni randevu davam edir, köhnə başlayır
            endTime: {
              $gt: new Date(updatedData.startTime),
              $lte: new Date(updatedData.endTime)
            }
          },
          {
            // Yeni randevu tamamilə köhnənin içindədir
            startTime: { $lte: new Date(updatedData.startTime) },
            endTime: { $gte: new Date(updatedData.endTime) }
          }
        ]
      });

      if (conflictingAppointment) {
        return res.status(400).json({ 
          message: 'Bu vaxt aralığında masajist artıq məşğuldur!',
          conflictingAppointment: {
            _id: conflictingAppointment._id,
            startTime: conflictingAppointment.startTime,
            endTime: conflictingAppointment.endTime
          }
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

// GET - BEH gəlirləri (advance payments by date)
router.get('/advance-payments/date/:date/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const appointments = await Appointment.find({
      branch: req.user.branch,
      'advancePayment.paidAt': { $gte: date, $lt: nextDay },
      'advancePayment.amount': { $gt: 0 }
    })
    .populate('customer', 'name phone')
    .populate('masseur', 'name')
    .populate('massageType', 'name');

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Branch specific data - token param ilə
router.get('/masseurs/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const masseurs = await Masseur.find({ branch: req.user.branch, isActive: true });
    res.json(masseurs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/massage-types/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const massageTypes = await MassageType.find();
    res.json(massageTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// EXPENSE ROUTES - Xərc əməliyyatları

// POST - Yeni xərc əlavə et
router.post('/expenses/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const expense = new Expense({
      ...req.body,
      branch: req.user.branch,
      createdBy: req.user.userId
    });
    
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.error('Expense creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET - Bugünkü xərclər
router.get('/expenses/today/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expenses = await Expense.find({
      branch: req.user.branch,
      date: { $gte: today, $lt: tomorrow }
    }).populate('createdBy', 'name');

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET - Tarixə görə xərclər
router.get('/expenses/date/:date/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const expenses = await Expense.find({
      branch: req.user.branch,
      date: { $gte: date, $lt: nextDay }
    }).populate('createdBy', 'name');

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET - Bütün xərclər (resepsiyonçunun filialı üçün)
router.get('/expenses/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const expenses = await Expense.find({
      branch: req.user.branch
    }).populate('createdBy', 'name').sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT - Xərc yenilə
router.put('/expenses/:id/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Yalnız öz filialının xərclərini yeniləyə bilər
    const expense = await Expense.findOne({
      _id: id,
      branch: req.user.branch
    });
    
    if (!expense) {
      return res.status(404).json({ message: 'Xərc tapılmadı və ya icazəniz yoxdur' });
    }
    
    const updatedExpense = await Expense.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');
    
    res.json(updatedExpense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE - Xərc sil
router.delete('/expenses/:id/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Yalnız öz filialının xərclərini silə bilər
    const expense = await Expense.findOne({
      _id: id,
      branch: req.user.branch
    });
    
    if (!expense) {
      return res.status(404).json({ message: 'Xərc tapılmadı və ya icazəniz yoxdur' });
    }
    
    await Expense.findByIdAndDelete(id);
    
    res.json({
      message: 'Xərc uğurla silindi',
      deletedExpense: expense
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// POST - Masajisti müəyyən tarixə blokla
router.post('/masseurs/:masseurId/block/:date/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { masseurId, date } = req.params;
    const { reason } = req.body;
    
    const masseur = await Masseur.findOne({
      _id: masseurId,
      branch: req.user.branch
    });
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı və ya icazəniz yoxdur' });
    }
    
    // Tarix artıq bloklanıbmı yoxla
    const blockDate = new Date(date);
    blockDate.setHours(0, 0, 0, 0);
    
    const alreadyBlocked = masseur.blockedDates.some(blocked => {
      const bd = new Date(blocked.date);
      bd.setHours(0, 0, 0, 0);
      return bd.getTime() === blockDate.getTime();
    });
    
    if (alreadyBlocked) {
      return res.status(400).json({ message: 'Bu tarix artıq bloklanıb' });
    }
    
    // Həmin tarixdə mövcud randevular varsa xəbərdarlıq ver
    const existingAppointments = await Appointment.find({
      masseur: masseurId,
      branch: req.user.branch,
      startTime: {
        $gte: blockDate,
        $lt: new Date(blockDate.getTime() + 24 * 60 * 60 * 1000)
      },
      status: { $ne: 'cancelled' }
    });
    
    if (existingAppointments.length > 0) {
      return res.status(400).json({ 
        message: `Bu tarixdə ${existingAppointments.length} aktiv randevu var! Əvvəlcə onları ləğv edin və ya digər masajistə köçürün.`,
        appointments: existingAppointments
      });
    }
    
    // Tarixi blokla
    masseur.blockedDates.push({
      date: blockDate,
      reason: reason || 'İstirahət günü',
      blockedBy: req.user.userId
    });
    
    await masseur.save();
    
    res.json({
      message: 'Tarix uğurla bloklandı',
      masseur
    });
  } catch (error) {
    console.error('Block masseur error:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE - Masajistin blokunu götür
router.delete('/masseurs/:masseurId/unblock/:date/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { masseurId, date } = req.params;
    
    const masseur = await Masseur.findOne({
      _id: masseurId,
      branch: req.user.branch
    });
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı və ya icazəniz yoxdur' });
    }
    
    const blockDate = new Date(date);
    blockDate.setHours(0, 0, 0, 0);
    
    // Bloklanan tarixi tap və sil
    masseur.blockedDates = masseur.blockedDates.filter(blocked => {
      const bd = new Date(blocked.date);
      bd.setHours(0, 0, 0, 0);
      return bd.getTime() !== blockDate.getTime();
    });
    
    await masseur.save();
    
    res.json({
      message: 'Blok uğurla götürüldü',
      masseur
    });
  } catch (error) {
    console.error('Unblock masseur error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET - Masajistin bloklanmış tarixlərini gör
router.get('/masseurs/:masseurId/blocked-dates/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { masseurId } = req.params;
    
    const masseur = await Masseur.findOne({
      _id: masseurId,
      branch: req.user.branch
    }).populate('blockedDates.blockedBy', 'name');
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı' });
    }
    
    res.json({
      masseur: {
        _id: masseur._id,
        name: masseur.name
      },
      blockedDates: masseur.blockedDates
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST - Masajisti həftənin müəyyən günlərində avtomatik blokla
router.post('/masseurs/:masseurId/block-weekly/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { masseurId } = req.params;
    const { weekDays, reason, startDate, endDate } = req.body;
    // weekDays: [0, 1, 2] - 0=Bazar, 1=Bazar ertəsi, 2=Çərşənbə axşamı və s.
    
    const masseur = await Masseur.findOne({
      _id: masseurId,
      branch: req.user.branch
    });
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı və ya icazəniz yoxdur' });
    }
    
    if (!weekDays || !Array.isArray(weekDays) || weekDays.length === 0) {
      return res.status(400).json({ message: 'Həftənin günlərini seçin' });
    }
    
    // Başlanğıc və son tarix
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 il
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    const blockedDates = [];
    const conflicts = [];
    
    // Başlanğıcdan sona qədər bütün günləri yoxla
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      
      // Əgər seçilmiş günlərdəndirsə
      if (weekDays.includes(dayOfWeek)) {
        const dateToBlock = new Date(currentDate);
        
        // Artıq bloklanıbmı yoxla
        const alreadyBlocked = masseur.blockedDates.some(blocked => {
          const bd = new Date(blocked.date);
          bd.setHours(0, 0, 0, 0);
          return bd.getTime() === dateToBlock.getTime();
        });
        
        if (!alreadyBlocked) {
          // Həmin tarixdə aktiv randevu varsa
          const existingAppointments = await Appointment.find({
            masseur: masseurId,
            branch: req.user.branch,
            startTime: {
              $gte: dateToBlock,
              $lt: new Date(dateToBlock.getTime() + 24 * 60 * 60 * 1000)
            },
            status: { $ne: 'cancelled' }
          }).populate('customer', 'name phone');
          
          if (existingAppointments.length > 0) {
            conflicts.push({
              date: dateToBlock.toISOString().split('T')[0],
              appointments: existingAppointments
            });
          } else {
            blockedDates.push({
              date: dateToBlock,
              reason: reason || 'Həftəlik istirahət günü',
              blockedBy: req.user.userId
            });
          }
        }
      }
      
      // Növbəti günə keç
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Konflikt varsa xəbərdarlıq ver
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        message: `${conflicts.length} tarixdə aktiv randevular var!`,
        conflicts,
        suggestion: 'Əvvəlcə bu randevuları ləğv edin və ya digər masajistə köçürün.'
      });
    }
    
    // Bütün tarixləri blokla
    masseur.blockedDates.push(...blockedDates);
    await masseur.save();
    
    res.json({
      message: `${blockedDates.length} tarix uğurla bloklandı`,
      blockedCount: blockedDates.length,
      masseur
    });
  } catch (error) {
    console.error('Block weekly error:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE - Həftəlik blokları götür
router.delete('/masseurs/:masseurId/unblock-weekly/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { masseurId } = req.params;
    const { weekDays, startDate, endDate } = req.body;
    
    const masseur = await Masseur.findOne({
      _id: masseurId,
      branch: req.user.branch
    });
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı və ya icazəniz yoxdur' });
    }
    
    if (!weekDays || !Array.isArray(weekDays) || weekDays.length === 0) {
      return res.status(400).json({ message: 'Həftənin günlərini seçin' });
    }
    
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    let removedCount = 0;
    
    // Filterlə və sil
    masseur.blockedDates = masseur.blockedDates.filter(blocked => {
      const bd = new Date(blocked.date);
      bd.setHours(0, 0, 0, 0);
      const dayOfWeek = bd.getDay();
      
      // Əgər tarix aralığındadırsa və seçilmiş günlərdəndirsə
      if (bd >= start && bd <= end && weekDays.includes(dayOfWeek)) {
        removedCount++;
        return false; // Sil
      }
      return true; // Saxla
    });
    
    await masseur.save();
    
    res.json({
      message: `${removedCount} tarix blokdan çıxarıldı`,
      removedCount,
      masseur
    });
  } catch (error) {
    console.error('Unblock weekly error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET - Masajistin həftəlik blok statusunu gör
router.get('/masseurs/:masseurId/weekly-schedule/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { masseurId } = req.params;
    
    const masseur = await Masseur.findOne({
      _id: masseurId,
      branch: req.user.branch
    });
    
    if (!masseur) {
      return res.status(404).json({ message: 'Masajist tapılmadı' });
    }
    
    // Həftənin hər günü üçün statistika
    const weeklyStats = {
      0: { name: 'Bazar', blockedCount: 0, dates: [] },
      1: { name: 'Bazar ertəsi', blockedCount: 0, dates: [] },
      2: { name: 'Çərşənbə axşamı', blockedCount: 0, dates: [] },
      3: { name: 'Çərşənbə', blockedCount: 0, dates: [] },
      4: { name: 'Cümə axşamı', blockedCount: 0, dates: [] },
      5: { name: 'Cümə', blockedCount: 0, dates: [] },
      6: { name: 'Şənbə', blockedCount: 0, dates: [] }
    };
    
    masseur.blockedDates.forEach(blocked => {
      const dayOfWeek = new Date(blocked.date).getDay();
      weeklyStats[dayOfWeek].blockedCount++;
      weeklyStats[dayOfWeek].dates.push(blocked.date);
    });
    
    res.json({
      masseur: {
        _id: masseur._id,
        name: masseur.name
      },
      weeklyStats,
      totalBlocked: masseur.blockedDates.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
