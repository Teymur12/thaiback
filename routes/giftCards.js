// routes/giftCards.js (Admin & Receptionist)
const express = require('express');
const GiftCard = require('../models/GiftCard');
const Customer = require('../models/Customer');
const MassageType = require('../models/MassageType');
const Appointment = require('../models/Appointment');
const { auth, adminAuth, receptionistAuth } = require('../middleware/auth');
const router = express.Router();

// Generate card number endpoint
router.get('/generate-number/:token', auth, async (req, res) => {
  try {
    const cardNumber = await GiftCard.generateCardNumber();
    res.json({ cardNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const {
      cardNumber,
      massageType,    // Köhnə format
      duration,       // Köhnə format
      massages,       // Yeni format - array
      purchasedBy,
      paymentMethod,
      notes
    } = req.body;

    const existingCard = await GiftCard.findOne({ cardNumber });
    if (existingCard) {
      return res.status(400).json({ message: 'Bu kart nömrəsi artıq mövcuddur' });
    }

    const customer = await Customer.findById(purchasedBy);
    if (!customer) {
      return res.status(400).json({ message: 'Müştəri tapılmadı' });
    }

    let giftCardData = {
      cardNumber,
      paymentMethod: paymentMethod || 'cash',
      branch: req.user.branch,
      purchasedBy,
      notes,
      createdBy: req.user.userId
    };

    // YENİ FORMAT - Çoxlu masaj
    if (massages && Array.isArray(massages) && massages.length > 0) {
      // Hər masajı validate et
      const validatedMassages = [];

      for (const massage of massages) {
        const massageTypeDoc = await MassageType.findById(massage.massageType);
        if (!massageTypeDoc) {
          return res.status(400).json({ message: `Masaj növü tapılmadı: ${massage.massageType}` });
        }

        const validDuration = massageTypeDoc.durations.find(d => d.minutes === massage.duration);
        if (!validDuration) {
          return res.status(400).json({ message: `${massageTypeDoc.name} üçün səhv müddət: ${massage.duration}` });
        }

        // YENİ: Hər masaja +4 deyil, sadəcə orijinal qiymət
        const price = validDuration.price;

        validatedMassages.push({
          massageType: massage.massageType,
          duration: massage.duration,
          price: price
        });
      }

      // YENİ: İlk masaja +4 manat əlavə et (bütün kart üçün 1 dəfə)
      if (validatedMassages.length > 0) {
        validatedMassages[0].price += 4;
      }

      giftCardData.massages = validatedMassages;
    }
    // KÖHNƏ FORMAT - Tək masaj (backward compatibility)
    else if (massageType && duration) {
      const massageTypeDoc = await MassageType.findById(massageType);
      if (!massageTypeDoc) {
        return res.status(400).json({ message: 'Masaj növü tapılmadı' });
      }

      const validDuration = massageTypeDoc.durations.find(d => d.minutes === duration);
      if (!validDuration) {
        return res.status(400).json({ message: 'Bu masaj növü üçün səhv müddət' });
      }

      const originalPrice = validDuration.price + 4;

      giftCardData.massageType = massageType;
      giftCardData.duration = duration;
      giftCardData.originalPrice = originalPrice;
    } else {
      return res.status(400).json({ message: 'Masaj məlumatları tələb olunur' });
    }

    const giftCard = new GiftCard(giftCardData);
    await giftCard.save();

    const populatedCard = await GiftCard.findById(giftCard._id)
      .populate('massageType', 'name')
      .populate('massages.massageType', 'name')
      .populate('purchasedBy', 'name phone')
      .populate('branch', 'name')
      .populate('createdBy', 'name');

    res.status(201).json(populatedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mövcud routes-dan sonra əlavə edin

// Get gift cards by date (Receptionist)
router.get('/date/:date/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { date } = req.params;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const giftCards = await GiftCard.find({
      branch: req.user.branch,
      purchaseDate: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .populate('massageType', 'name durations')
      .populate('massages.massageType', 'name durations')
      .populate('purchasedBy', 'name phone')
      .populate('usedBy', 'name phone')
      .populate('branch', 'name')
      .populate('createdBy', 'name')
      .sort({ purchaseDate: 1 });

    res.json(giftCards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get gift cards for branch (Receptionist)
router.get('/branch/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { status, search } = req.query;

    let filter = { branch: req.user.branch };

    // Filter by status
    if (status === 'used') {
      filter.isUsed = true;
    } else if (status === 'active') {
      filter.isUsed = false;
    }

    let query = GiftCard.find(filter)
      .populate('massageType', 'name')
      .populate('massages.massageType', 'name')
      .populate('purchasedBy', 'name phone')
      .populate('usedBy', 'name phone')
      .populate('branch', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const giftCards = await query;

    // Search filter
    let filteredCards = giftCards;
    if (search) {
      filteredCards = giftCards.filter(card =>
        card.cardNumber.toLowerCase().includes(search.toLowerCase()) ||
        card.purchasedBy.name.toLowerCase().includes(search.toLowerCase()) ||
        (card.usedBy && card.usedBy.name.toLowerCase().includes(search.toLowerCase()))
      );
    }

    res.json(filteredCards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all gift cards (Admin)
router.get('/admin/:token', auth, adminAuth, async (req, res) => {
  try {
    const { branch, status, search } = req.query;

    let filter = {};

    // Filter by branch
    if (branch) {
      filter.branch = branch;
    }

    // Filter by status
    if (status === 'used') {
      filter.isUsed = true;
    } else if (status === 'active') {
      filter.isUsed = false;
    }

    let query = GiftCard.find(filter)
      .populate('massageType', 'name')
      .populate('massages.massageType', 'name')
      .populate('purchasedBy', 'name phone')
      .populate('usedBy', 'name phone')
      .populate('branch', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const giftCards = await query;

    // Search filter
    let filteredCards = giftCards;
    if (search) {
      filteredCards = giftCards.filter(card =>
        card.cardNumber.toLowerCase().includes(search.toLowerCase()) ||
        card.purchasedBy.name.toLowerCase().includes(search.toLowerCase()) ||
        (card.usedBy && card.usedBy.name.toLowerCase().includes(search.toLowerCase()))
      );
    }

    res.json(filteredCards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Validate gift card by number
router.get('/validate/:cardNumber/:token', auth, async (req, res) => {
  try {
    const { cardNumber } = req.params;

    let giftCard = await GiftCard.findOne({ cardNumber })
      .populate('massageType', 'name durations')
      .populate('massages.massageType', 'name durations')
      .populate('purchasedBy', 'name phone')
      .populate('branch', 'name');

    if (!giftCard) {
      return res.status(404).json({ message: 'Hədiyyə kartı tapılmadı' });
    }

    // Köhnə formatı yeni formata çevir (avtomatik)
    if (giftCard.isSingleMassageCard()) {
      giftCard.convertToMultiMassage();
    }

    // Bütün masajlar istifadə edilibmi yoxla
    const fullyUsed = giftCard.isFullyUsed();

    if (fullyUsed) {
      return res.status(400).json({
        message: 'Bu hədiyyə kartının bütün masajları istifadə olunub',
        giftCard
      });
    }

    // Check if from different branch (optional business rule)
    if (req.user.role === 'receptionist' && giftCard.branch._id.toString() !== req.user.branch.toString()) {
      return res.status(400).json({
        message: 'Bu hədiyyə kartı digər filialdan alınıb',
        giftCard
      });
    }

    // İstifadə olunmamış masajları göstər
    const availableMassages = giftCard.getAvailableMassages();

    res.json({
      valid: true,
      giftCard,
      availableMassages,
      stats: {
        totalMassages: giftCard.totalMassages,
        usedMassages: giftCard.usedMassages,
        remainingMassages: giftCard.remainingMassages,
        totalValue: giftCard.totalValue
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Use gift card in appointment
router.post('/use/:cardNumber/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { cardNumber } = req.params;
    const { appointmentId, usedBy, massageIndex } = req.body;

    const giftCard = await GiftCard.findOne({ cardNumber });

    if (!giftCard) {
      return res.status(404).json({ message: 'Hədiyyə kartı tapılmadı' });
    }

    // Bütün masajlar istifadə edilibmi yoxla
    if (giftCard.isFullyUsed()) {
      return res.status(400).json({ message: 'Bu hədiyyə kartının bütün masajları istifadə olunub' });
    }

    // KÖHNƏ FORMAT - Tək masaj
    if (giftCard.isSingleMassageCard()) {
      if (giftCard.isUsed) {
        return res.status(400).json({ message: 'Bu hədiyyə kartı artıq istifadə olunub' });
      }

      giftCard.isUsed = true;
      giftCard.usedDate = new Date();
      giftCard.usedBy = usedBy;
      giftCard.usedInAppointment = appointmentId;
    }
    // YENİ FORMAT - Çoxlu masaj
    else {
      // Əgər massageIndex göndərilməyibsə, ilk istifadə olunmamış masajı tap
      let targetIndex = massageIndex;

      if (targetIndex === undefined || targetIndex === null) {
        targetIndex = giftCard.massages.findIndex(m => !m.isUsed);

        if (targetIndex === -1) {
          return res.status(400).json({ message: 'İstifadə olunmamış masaj tapılmadı' });
        }
      }

      // Index-i yoxla
      if (targetIndex < 0 || targetIndex >= giftCard.massages.length) {
        return res.status(400).json({ message: 'Səhv masaj index' });
      }

      // Masaj artıq istifadə olunubmu yoxla
      if (giftCard.massages[targetIndex].isUsed) {
        return res.status(400).json({ message: 'Bu masaj artıq istifadə olunub' });
      }

      // Masajı istifadə edilmiş kimi qeyd et
      giftCard.massages[targetIndex].isUsed = true;
      giftCard.massages[targetIndex].usedDate = new Date();
      giftCard.massages[targetIndex].usedBy = usedBy;
      giftCard.massages[targetIndex].usedInAppointment = appointmentId;

      // Bütün masajlar istifadə edilibsə, kartı da istifadə edilmiş kimi qeyd et
      if (giftCard.massages.every(m => m.isUsed)) {
        giftCard.isUsed = true;
        giftCard.usedDate = new Date();
        giftCard.usedBy = usedBy;
        giftCard.usedInAppointment = appointmentId;
      }
    }

    await giftCard.save();

    const populatedCard = await GiftCard.findById(giftCard._id)
      .populate('massageType', 'name')
      .populate('massages.massageType', 'name')
      .populate('massages.usedBy', 'name phone')
      .populate('purchasedBy', 'name phone')
      .populate('usedBy', 'name phone')
      .populate('branch', 'name');

    res.json({
      message: 'Hədiyyə kartı uğurla istifadə edildi',
      giftCard: populatedCard,
      remainingMassages: populatedCard.remainingMassages
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update gift card (Receptionist - limited fields)
router.put('/:id/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const giftCard = await GiftCard.findOne({
      _id: id,
      branch: req.user.branch
    });

    if (!giftCard) {
      return res.status(404).json({ message: 'Hədiyyə kartı tapılmadı və ya icazəniz yoxdur' });
    }

    if (giftCard.isUsed) {
      return res.status(400).json({ message: 'İstifadə olunmuş hədiyyə kartı dəyişdirilə bilməz' });
    }

    // Only allow updating notes
    if (notes !== undefined) giftCard.notes = notes;

    await giftCard.save();

    const populatedCard = await GiftCard.findById(giftCard._id)
      .populate('massageType', 'name')
      .populate('purchasedBy', 'name phone')
      .populate('usedBy', 'name phone')
      .populate('branch', 'name')
      .populate('createdBy', 'name');

    res.json(populatedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete gift card (Admin only)
router.delete('/:id/:token', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const giftCard = await GiftCard.findById(id);

    if (!giftCard) {
      return res.status(404).json({ message: 'Hədiyyə kartı tapılmadı' });
    }

    if (giftCard.isUsed) {
      return res.status(400).json({ message: 'İstifadə olunmuş hədiyyə kartı silinə bilməz' });
    }

    await GiftCard.findByIdAndDelete(id);

    res.json({
      message: 'Hədiyyə kartı uğurla silindi',
      deletedCard: giftCard
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Gift card statistics (Admin)
router.get('/stats/:token', auth, adminAuth, async (req, res) => {
  try {
    const { branch, startDate, endDate } = req.query;

    let matchFilter = {};

    if (branch) {
      matchFilter.branch = new mongoose.Types.ObjectId(branch);
    }

    if (startDate && endDate) {
      matchFilter.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await GiftCard.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$branch',
          totalCards: { $sum: 1 },
          usedCards: {
            $sum: { $cond: ['$isUsed', 1, 0] }
          },
          activeCards: {
            $sum: { $cond: ['$isUsed', 0, 1] }
          },
          totalRevenue: { $sum: '$originalPrice' },
          usedRevenue: {
            $sum: {
              $cond: ['$isUsed', '$originalPrice', 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branchInfo'
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

