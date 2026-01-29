// routes/receptionist.js
const express = require('express');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const Masseur = require('../models/Masseur');
const MassageType = require('../models/MassageType');
const Expense = require('../models/Expense'); // Bu sətr əlavə edilməli idi!
const { auth, receptionistAuth } = require('../middleware/auth');
const router = express.Router();
const uploadAdvanceReceipt = require('../middleware/uploadMiddleware');
const cloudinary = require('cloudinary').v2;

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

router.post('/appointments/:token', uploadAdvanceReceipt, auth, receptionistAuth, async (req, res) => {
  try {
    // ✅ FormData-dan gələn JSON-u parse et
    let appointmentData;

    if (req.body.body) {
      // Frontend FormData ilə 'body' field-ində göndərir
      appointmentData = JSON.parse(req.body.body);
    } else {
      // Birbaşa JSON göndərilibsə (köhnə üsul)
      appointmentData = req.body;
    }

    // Branch və createdBy əlavə et
    appointmentData.branch = req.user.branch;
    appointmentData.createdBy = req.user.userId;

    // ✅ YENİ: XÜSUSİ FİLİAL İÇİN ENDİRİM MƏNTİQİ
    const SPECIAL_BRANCH_ID = '68d2693d8b8c7e6256a90bc8';

    // Əgər hədiyyə kartı deyilsə və xüsusi filialdırsa
    if (req.user.branch.toString() === SPECIAL_BRANCH_ID && !appointmentData.giftCard) {
      const startTime = new Date(appointmentData.startTime);
      const dayOfWeek = startTime.getDay(); // 0 = Bazar, 6 = Şənbə
      let discountPercent = 0;

      // Həftə sonu (Şənbə və Bazar) - 10%
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        discountPercent = 10;
      }
      // Həftə içi - 25%
      else {
        discountPercent = 25;
      }

      if (discountPercent > 0) {
        const originalPrice = Number(appointmentData.price);
        const discountAmount = (originalPrice * discountPercent) / 100;
        let finalPrice = originalPrice - discountAmount;

        // Yuvarlaqlaşdırma məntiqi
        if (discountPercent === 10) {
          finalPrice = Math.round(finalPrice);
        } else if (discountPercent === 25) {
          finalPrice = Math.ceil(finalPrice);
        }

        // Appointment data-nı yenilə
        appointmentData.price = finalPrice;
        appointmentData.discountApplied = true;
        appointmentData.discount = {
          percent: discountPercent,
          amount: Number((originalPrice - finalPrice).toFixed(2)),
          originalPrice: originalPrice,
          reason: (dayOfWeek === 0 || dayOfWeek === 6) ? 'Həftə sonu endirimi' : 'Həftə içi endirimi'
        };

        console.log(`🎁 Endirim tətbiq edildi: ${discountPercent}% (${appointmentData.discount.reason})`);
        console.log(`💰 Orijinal: ${originalPrice}, Yekun: ${finalPrice}`);
      }
    }

    // Əgər BEH varsa
    if (appointmentData.advancePayment && appointmentData.advancePayment.amount > 0) {
      appointmentData.advancePayment.paidAt = new Date();

      // ✅ Qəbzin şəkli yüklənirsə
      if (req.file) {
        appointmentData.advancePayment.receiptImage = {
          url: req.file.path, // Cloudinary URL
          publicId: req.file.filename, // Public ID (silmə üçün)
          uploadedAt: new Date()
        };
      }
    }

    const appointment = new Appointment(appointmentData);
    await appointment.save();
    console.log('✅ Randevu yaradıldı:', appointment._id);

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customer masseur massageType branch');

    res.status(201).json({
      ...populatedAppointment.toObject(),
      receiptImageUrl: appointmentData.advancePayment?.receiptImage?.url || null
    });
  } catch (error) {
    console.error('❌ Appointment creation error:', error);
    res.status(400).json({
      message: error.message,
      error: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT - BEH qəbzisini yüksəlt (Mövcud randevuya əlavə et)
router.put('/appointments/:id/upload-receipt/:token', uploadAdvanceReceipt, auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    if (!appointment.advancePayment || appointment.advancePayment.amount === 0) {
      return res.status(400).json({ message: 'Bu randevuda beh rəkordı yoxdur' });
    }

    // Əgər əvvəlki qəbzi varsa, onu sil
    if (appointment.advancePayment.receiptImage?.publicId) {
      try {
        await cloudinary.uploader.destroy(appointment.advancePayment.receiptImage.publicId);
      } catch (deleteError) {
        console.error('Köhnə qəbzi silmə xətası:', deleteError);
      }
    }

    // Yeni qəbzi əlavə et
    if (!req.file) {
      return res.status(400).json({ message: 'Şəkil seçilmədi' });
    }

    appointment.advancePayment.receiptImage = {
      url: req.file.path,
      publicId: req.file.filename,
      uploadedAt: new Date()
    };

    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('customer masseur massageType branch');

    res.json({
      message: 'Qəbzi uğurla yükləndi',
      appointment: updatedAppointment,
      receiptImageUrl: appointment.advancePayment.receiptImage.url
    });
  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE - BEH qəbzisini sil
router.delete('/appointments/:id/receipt/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    const publicId = appointment.advancePayment?.receiptImage?.publicId;

    if (!publicId) {
      return res.status(400).json({ message: 'Bu randevuda qəbzi yoxdur' });
    }

    // Cloudinarydan sil
    await cloudinary.uploader.destroy(publicId);

    // Modeldən sil
    appointment.advancePayment.receiptImage = {
      url: null,
      publicId: null,
      uploadedAt: null
    };

    await appointment.save();

    res.json({
      message: 'Qəbzi uğurla silindi',
      appointment
    });
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET - BEH qəbzisini gör
router.get('/appointments/:id/receipt/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .select('advancePayment customer');

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    const receiptUrl = appointment.advancePayment?.receiptImage?.url;

    if (!receiptUrl) {
      return res.status(404).json({ message: 'Bu randevuda qəbzi yoxdur' });
    }

    res.json({
      appointmentId: id,
      receiptUrl,
      uploadedAt: appointment.advancePayment.receiptImage.uploadedAt,
      advanceAmount: appointment.advancePayment.amount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT - Randevunu tamamla (Qalan məbləği ödə)
// PUT - Randevunu tamamla (Qalan məbləği ödə + Bahşiş)
router.put('/appointments/:id/complete/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const {
      paymentType,
      giftCardNumber,
      // ✅ YENİ - Qarışıq ödəniş üçün
      payments, // { cash: 50, card: 30, terminal: 20 }
      // ✅ YENİ - Bahşiş üçün
      tips // { cash: 10, card: 5 }
    } = req.body;

    // Customer məlumatını populate et
    const appointment = await Appointment.findById(req.params.id)
      .populate('customer');

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    const updateData = {
      status: 'completed'
    };

    // ========== ƏSAS ÖDƏNİŞ ==========

    // 1️⃣ Gift Card ilə ödəniş
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
      updateData.paymentType = 'gift_card';
      updateData.price = 0;
    }

    // 2️⃣ BEH verilib, indi qalan ödənilir
    else if (appointment.advancePayment && appointment.advancePayment.amount > 0) {
      const remainingAmount = appointment.price - appointment.advancePayment.amount;

      if (remainingAmount > 0) {
        // Qarışıq ödəniş (nağd + kart + terminal)
        if (payments && typeof payments === 'object') {
          const totalPayment = (payments.cash || 0) + (payments.card || 0) + (payments.terminal || 0);

          // Yoxla ki, ödəniş məbləği düzgündür
          if (Math.abs(totalPayment - remainingAmount) > 0.01) {
            return res.status(400).json({
              message: `Ödəniş məbləği düzgün deyil. Ödənilməli: ${remainingAmount} AZN, Ödənilən: ${totalPayment} AZN`
            });
          }

          updateData.remainingPayment = {
            cash: payments.cash || 0,
            card: payments.card || 0,
            terminal: payments.terminal || 0,
            paidAt: new Date()
          };
          updateData.paymentType = 'mixed';
          updateData.paymentMethod = 'mixed';
        }
        // Tək üsulla ödəniş
        else {
          const method = req.body.paymentMethod;
          if (!method) {
            return res.status(400).json({ message: 'Ödəniş üsulu göstərilməlidir' });
          }

          updateData.remainingPayment = {
            [method]: remainingAmount,
            paidAt: new Date()
          };
          updateData.paymentType = method;
          updateData.paymentMethod = method;
        }
      }
    }

    // 3️⃣ Tam ödəniş (beh yoxdur)
    else {
      // Qarışıq ödəniş
      if (payments && typeof payments === 'object') {
        const totalPayment = (payments.cash || 0) + (payments.card || 0) + (payments.terminal || 0);

        if (Math.abs(totalPayment - appointment.price) > 0.01) {
          return res.status(400).json({
            message: `Ödəniş məbləği düzgün deyil. Ödənilməli: ${appointment.price} AZN, Ödənilən: ${totalPayment} AZN`
          });
        }

        updateData.remainingPayment = {
          cash: payments.cash || 0,
          card: payments.card || 0,
          terminal: payments.terminal || 0,
          paidAt: new Date()
        };
        updateData.paymentType = 'mixed';
        updateData.paymentMethod = 'mixed';
      }
      // Tək üsulla ödəniş
      else {
        const method = req.body.paymentMethod;
        if (!method) {
          return res.status(400).json({ message: 'Ödəniş üsulu göstərilməlidir' });
        }

        updateData.paymentMethod = method;
        updateData.paymentType = method;
      }
    }

    // ========== BAHŞİŞ (TIPS) ==========
    if (tips && typeof tips === 'object') {
      const totalTips = (tips.cash || 0) + (tips.card || 0) + (tips.terminal || 0);

      if (totalTips > 0) {
        updateData.tips = {
          amount: totalTips,
          paymentMethods: {
            cash: tips.cash || 0,
            card: tips.card || 0,
            terminal: tips.terminal || 0
          },
          paidAt: new Date()
        };
      }
    }

    // Appointment-i yenilə
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('customer masseur massageType branch giftCard');

    // WhatsApp linki yarad
    let whatsappLink = null;
    if (updatedAppointment.customer && updatedAppointment.customer.phone) {
      whatsappLink = generateWhatsAppLink(
        updatedAppointment.customer.phone,
        `Salam! Xidmətimizdən razı qaldınızmı? 😊 Sizə göstərilən xidməti 1-5 arası bir rəqəmlə qiymətləndirməyinizi xahiş edirik.
        Здравствуйте! Остались ли вы довольны нашим сервисом? 😊 Просим вас оценить оказанную вам услугу по шкале от 1 до 5.
        Hello! Were you satisfied with our service? 😊 We kindly ask you to rate the service you received on a scale from 1 to 5.`
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
router.put('/appointments/:id', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Əvvəlcə mövcud randevunu tapaq
    const currentAppointment = await Appointment.findById(id);

    if (!currentAppointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    // Conflict yoxlaması - yalnız masseur, startTime və ya endTime dəyişirsə
    if (req.body.startTime || req.body.endTime || req.body.masseur) {
      const updatedData = {
        masseur: req.body.masseur || currentAppointment.masseur,
        branch: req.body.branch || currentAppointment.branch,
        startTime: new Date(req.body.startTime || currentAppointment.startTime),
        endTime: new Date(req.body.endTime || currentAppointment.endTime)
      };

      // Debug üçün
      console.log('Yoxlanılan randevu ID:', id);
      console.log('Yeni vaxt:', updatedData.startTime, '-', updatedData.endTime);

      const conflictingAppointment = await Appointment.findOne({
        _id: { $ne: id }, // Bu randevunu xaric et
        masseur: updatedData.masseur,
        branch: updatedData.branch,
        status: { $nin: ['cancelled', 'completed'] }, // Ləğv və tamamlanmış randevuları xaric et
        $or: [
          // Yeni randevunun başlanğıcı mövcud randevunun içindədir
          {
            $and: [
              { startTime: { $lte: updatedData.startTime } },
              { endTime: { $gt: updatedData.startTime } }
            ]
          },
          // Yeni randevunun sonu mövcud randevunun içindədir
          {
            $and: [
              { startTime: { $lt: updatedData.endTime } },
              { endTime: { $gte: updatedData.endTime } }
            ]
          },
          // Mövcud randevu yeni randevunun içindədir
          {
            $and: [
              { startTime: { $gte: updatedData.startTime } },
              { endTime: { $lte: updatedData.endTime } }
            ]
          }
        ]
      });

      if (conflictingAppointment) {
        console.log('Conflict tapıldı:', conflictingAppointment._id);
        console.log('Conflict randevu vaxtı:', conflictingAppointment.startTime, '-', conflictingAppointment.endTime);
        console.log('Conflict randevu masajist:', conflictingAppointment.masseur);
        console.log('Conflict randevu status:', conflictingAppointment.status);
        return res.status(400).json({
          message: 'Bu vaxt aralığında masajist artıq məşğuldur!',
          conflictingAppointment: {
            _id: conflictingAppointment._id,
            customer: conflictingAppointment.customer,
            startTime: conflictingAppointment.startTime,
            endTime: conflictingAppointment.endTime
          }
        });
      }
    }


    // ✅ YENİ: XÜSUSİ FİLİAL İÇİN ENDİRİM MƏNTİQİ (UPDATE)
    const SPECIAL_BRANCH_ID = '68d2693d8b8c7e6256a90bc8';

    // Check if we need to recalculate discount
    // If startTime, price, or massageType changes, we might need to recalculate
    if (req.user.branch.toString() === SPECIAL_BRANCH_ID) {
      // Check if gift card is used (either in current appointment or in update payload)
      const hasGiftCard = req.body.giftCard || currentAppointment.giftCard;

      if (!hasGiftCard) {
        // Use new start time if provided, otherwise use existing
        const startTimeStr = req.body.startTime || currentAppointment.startTime;
        const startTime = new Date(startTimeStr);
        const dayOfWeek = startTime.getDay();

        // Determine discount based on day
        let discountPercent = 0;
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          discountPercent = 10;
        } else {
          discountPercent = 25;
        }

        // Get the "original" price. 
        // Logic: The frontend might send the 'price' field. 
        // If frontend sends price, we assume it's the raw price (before discount) OR we need to trust the backend calc.
        // Let's assume req.body.price is the intended new price (which might be raw).

        // HOWEVER, to be safe and consistent with CREATE logic, we should apply discount to the price provided in body.
        // If price is NOT in body, we use currentAppointment.price (which might be already discounted... this is tricky).

        // BETTER APPROACH: Frontend sends price. We interpret it as the BASE price if we are going to apply discount.
        // Or we check if discount was already applied and reverse it? No, that's error prone.

        // DECISION: If price is being updated OR startTime is being updated, we recalculate.
        if (req.body.price || req.body.startTime) {
          // Logic: The frontend sends 'price'. If it matches the current discounted price, 
          // we should assume it's the same base price as before, so we recover originalPrice.

          let originalPrice = req.body.price ? Number(req.body.price) : currentAppointment.price;

          if (currentAppointment.discountApplied &&
            currentAppointment.discount &&
            currentAppointment.discount.originalPrice) {

            // If the incoming price (or current price if not provided) matches the stored discounted price
            // We assume the user didn't manually change the price to this exact value as a new base.
            if (Math.abs(originalPrice - currentAppointment.price) < 0.1) {
              originalPrice = currentAppointment.discount.originalPrice;
            }
          }

          if (discountPercent > 0) {
            const discountAmount = (originalPrice * discountPercent) / 100;
            let finalPrice = originalPrice - discountAmount;

            // Yuvarlaqlaşdırma
            if (discountPercent === 10) {
              finalPrice = Math.round(finalPrice);
            } else if (discountPercent === 25) {
              finalPrice = Math.ceil(finalPrice);
            }

            req.body.price = finalPrice;
            req.body.discountApplied = true;
            req.body.discount = {
              percent: discountPercent,
              amount: Number((originalPrice - finalPrice).toFixed(2)),
              originalPrice: originalPrice,
              reason: (dayOfWeek === 0 || dayOfWeek === 6) ? 'Həftə sonu endirimi' : 'Həftə içi endirimi'
            };
          } else {
            // If moved to a day with no discount, ensure we reset to original price if available
            if (!req.body.price && currentAppointment.discount && currentAppointment.discount.originalPrice) {
              req.body.price = currentAppointment.discount.originalPrice;
            }
            req.body.discountApplied = false;
            req.body.discount = null;
          }
        }
      }
    }

    // Update et
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

// DELETE - Randevunu sil (Yalnız username "leman" olan istifadəçi silə bilər)
router.delete('/appointments/:id/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Yalnız username "leman" olan istifadəçi randevu silə bilər
    if (req.user.username !== 'leman') {
      return res.status(403).json({
        message: 'Randevu silmə icazəniz yoxdur. Yalnız müəyyən istifadəçilər randevu silə bilər.'
      });
    }

    // Randevunu tap
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    // Randevunu sil
    await Appointment.findByIdAndDelete(id);

    res.json({
      message: 'Randevu uğurla silindi',
      deletedAppointment: appointment
    });
  } catch (error) {
    console.error('Randevu silmə xətası:', error);
    res.status(500).json({ message: error.message });
  }
});


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

// ✅ YENİ - Müştəri rəyi əlavə et / yenilə
router.put('/appointments/:id/feedback/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { response, satisfactionRating } = req.body;

    // Reytinq validation (əgər göndərilibsə)
    if (satisfactionRating !== null && satisfactionRating !== undefined) {
      if (satisfactionRating < 1 || satisfactionRating > 5) {
        return res.status(400).json({
          message: 'Məmnuniyyət reytinqi 1-5 arası olmalıdır'
        });
      }
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    // Yalnız tamamlanmış randevulara rəy əlavə edilə bilər
    if (appointment.status !== 'completed') {
      return res.status(400).json({
        message: 'Yalnız tamamlanmış randevulara rəy əlavə edilə bilər'
      });
    }

    // Rəy məlumatlarını yenilə
    appointment.customerFeedback = {
      response: response || null,
      satisfactionRating: satisfactionRating || null,
      submittedAt: new Date(),
      submittedBy: req.user.userId
    };

    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('customer masseur massageType branch');

    res.json({
      message: 'Müştəri rəyi uğurla əlavə edildi',
      appointment: updatedAppointment
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ YENİ - Masajistlərin reytinqlərini gətir
router.get('/masseurs/ratings/:token', auth, receptionistAuth, async (req, res) => {
  try {
    // Filialın bütün masajistlərini gətir
    const masseurs = await Masseur.find({
      branch: req.user.branch,
      isActive: true
    });

    // Hər masajist üçün reytinq hesabla
    const ratingsData = await Promise.all(
      masseurs.map(async (masseur) => {
        // Masajistin tamamlanmış və reytinqi olan randevularını tap
        const appointments = await Appointment.find({
          masseur: masseur._id,
          status: 'completed',
          'customerFeedback.satisfactionRating': { $ne: null }
        });

        // Ortalama reytinq hesabla
        let averageRating = 0;
        const totalFeedbacks = appointments.length;

        if (totalFeedbacks > 0) {
          const totalRating = appointments.reduce((sum, apt) => {
            return sum + (apt.customerFeedback.satisfactionRating || 0);
          }, 0);
          averageRating = (totalRating / totalFeedbacks).toFixed(1);
        }

        return {
          masseurId: masseur._id,
          masseurName: masseur.name,
          averageRating: parseFloat(averageRating),
          totalFeedbacks: totalFeedbacks,
          branch: masseur.branch
        };
      })
    );

    // Reytinqə görə sırala (ən yüksək əvvəl)
    ratingsData.sort((a, b) => b.averageRating - a.averageRating);

    res.json(ratingsData);

  } catch (error) {
    console.error('Fetch masseur ratings error:', error);
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

// routes/receptionist.js-ə əlavə ediləcək yeni route-lar

// GET - Müştərinin bütün randevularını gör (ID ilə)
router.get('/customers/:customerId/appointments/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Müştəri mövcuddurmu yoxla
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    // Müştərinin bütün randevularını tap (ən yenidən köhnəyə)
    const appointments = await Appointment.find({
      customer: customerId
    })
      .populate('masseur', 'name')
      .populate('massageType', 'name duration')
      .populate('branch', 'name')
      .sort({ startTime: -1 }); // Ən yeni randevular əvvəl

    // Statistika
    const stats = {
      total: appointments.length,
      completed: appointments.filter(a => a.status === 'completed').length,
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      totalSpent: appointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + a.price, 0),
      totalTips: appointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.tips?.amount || 0), 0)
    };

    res.json({
      customer: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes
      },
      appointments,
      stats
    });
  } catch (error) {
    console.error('Customer appointments error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET - Telefon nömrəsi ilə müştəri tap və randevularını gör
router.get('/customers/phone/:phone/appointments/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { phone } = req.params;

    // Telefona görə müştəri tap
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return res.status(404).json({
        message: 'Bu telefon numarasına ait müşteri bulunamadı',
        phone
      });
    }

    // Müştərinin bütün randevularını tap
    const appointments = await Appointment.find({
      customer: customer._id
    })
      .populate('masseur', 'name')
      .populate('massageType', 'name duration')
      .populate('branch', 'name')
      .sort({ startTime: -1 });

    // Statistika
    const stats = {
      total: appointments.length,
      completed: appointments.filter(a => a.status === 'completed').length,
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      totalSpent: appointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + a.price, 0),
      totalTips: appointments
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.tips?.amount || 0), 0),
      favoriteServices: getFavoriteServices(appointments),
      favoriteMasseurs: getFavoriteMasseurs(appointments),
      lastVisit: appointments.find(a => a.status === 'completed')?.startTime
    };

    res.json({
      customer: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes
      },
      appointments,
      stats
    });
  } catch (error) {
    console.error('Customer phone appointments error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET - Ad ilə müştəri axtar və randevularını gör
router.get('/customers/name/:name/appointments/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { name } = req.params;

    // İsmə görə müştəriləri tap (hissəvi uyğunluq)
    const customers = await Customer.find({
      name: { $regex: name, $options: 'i' }
    });

    if (customers.length === 0) {
      return res.status(404).json({
        message: 'Bu adda müşteri bulunamadı',
        searchTerm: name
      });
    }

    // Hər müştəri üçün randevuları tap
    const results = await Promise.all(
      customers.map(async (customer) => {
        const appointments = await Appointment.find({
          customer: customer._id
        })
          .populate('masseur', 'name')
          .populate('massageType', 'name duration')
          .populate('branch', 'name')
          .sort({ startTime: -1 });

        const stats = {
          total: appointments.length,
          completed: appointments.filter(a => a.status === 'completed').length,
          scheduled: appointments.filter(a => a.status === 'scheduled').length,
          cancelled: appointments.filter(a => a.status === 'cancelled').length,
          totalSpent: appointments
            .filter(a => a.status === 'completed')
            .reduce((sum, a) => sum + a.price, 0),
          lastVisit: appointments.find(a => a.status === 'completed')?.startTime
        };

        return {
          customer: {
            _id: customer._id,
            name: customer.name,
            phone: customer.phone,
            notes: customer.notes
          },
          appointments,
          stats
        };
      })
    );

    res.json({
      searchTerm: name,
      found: customers.length,
      results
    });
  } catch (error) {
    console.error('Customer name appointments error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET - Müştərinin son 5 randevusunu gör (tez baxış üçün)
router.get('/customers/:customerId/recent-appointments/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { customerId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const recentAppointments = await Appointment.find({
      customer: customerId
    })
      .populate('masseur', 'name')
      .populate('massageType', 'name duration')
      .populate('branch', 'name')
      .sort({ startTime: -1 })
      .limit(limit);

    res.json({
      customer: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone
      },
      recentAppointments
    });
  } catch (error) {
    console.error('Recent appointments error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Kömək funksiyaları
function getFavoriteServices(appointments) {
  const services = {};

  appointments
    .filter(a => a.status === 'completed')
    .forEach(a => {
      const serviceId = a.massageType._id.toString();
      const serviceName = a.massageType.name;

      if (!services[serviceId]) {
        services[serviceId] = { name: serviceName, count: 0 };
      }
      services[serviceId].count++;
    });

  return Object.values(services)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3); // Top 3
}

function getFavoriteMasseurs(appointments) {
  const masseurs = {};

  appointments
    .filter(a => a.status === 'completed')
    .forEach(a => {
      const masseurId = a.masseur._id.toString();
      const masseurName = a.masseur.name;

      if (!masseurs[masseurId]) {
        masseurs[masseurId] = { name: masseurName, count: 0 };
      }
      masseurs[masseurId].count++;
    });

  return Object.values(masseurs)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3); // Top 3
}

// ✅ BONUS: Müştəri məlumatları ilə birlikdə randevu statistikasını gör
router.get('/customers/:customerId/full-profile/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const appointments = await Appointment.find({
      customer: customerId
    })
      .populate('masseur', 'name')
      .populate('massageType', 'name duration')
      .populate('branch', 'name')
      .sort({ startTime: -1 });

    const completedAppointments = appointments.filter(a => a.status === 'completed');

    const profile = {
      customer: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
        createdAt: customer.createdAt
      },
      statistics: {
        totalAppointments: appointments.length,
        completedAppointments: completedAppointments.length,
        scheduledAppointments: appointments.filter(a => a.status === 'scheduled').length,
        cancelledAppointments: appointments.filter(a => a.status === 'cancelled').length,
        totalSpent: completedAppointments.reduce((sum, a) => sum + a.price, 0),
        totalTips: completedAppointments.reduce((sum, a) => sum + (a.tips?.amount || 0), 0),
        averageSpending: completedAppointments.length > 0
          ? (completedAppointments.reduce((sum, a) => sum + a.price, 0) / completedAppointments.length).toFixed(2)
          : 0,
        firstVisit: completedAppointments[completedAppointments.length - 1]?.startTime,
        lastVisit: completedAppointments[0]?.startTime,
        favoriteServices: getFavoriteServices(appointments),
        favoriteMasseurs: getFavoriteMasseurs(appointments)
      },
      recentAppointments: appointments.slice(0, 5),
      allAppointments: appointments
    };

    res.json(profile);
  } catch (error) {
    console.error('Full profile error:', error);
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
