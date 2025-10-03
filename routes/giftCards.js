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

// Create gift card (Receptionist)
router.post('/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const {
      cardNumber,
      massageType,
      duration,
      purchasedBy,
      notes
    } = req.body;

    // Check if card number already exists
    const existingCard = await GiftCard.findOne({ cardNumber });
    if (existingCard) {
      return res.status(400).json({ message: 'Bu kart nömrəsi artıq mövcuddur' });
    }

    // Validate massage type and duration
    const massageTypeDoc = await MassageType.findById(massageType);
    if (!massageTypeDoc) {
      return res.status(400).json({ message: 'Masaj növü tapılmadı' });
    }

    const validDuration = massageTypeDoc.durations.find(d => d.minutes === duration);
    if (!validDuration) {
      return res.status(400).json({ message: 'Bu masaj növü üçün səhv müddət' });
    }

    // Automatically calculate gift card price
    const originalPrice = validDuration.price + 5;

    // Validate customer
    const customer = await Customer.findById(purchasedBy);
    if (!customer) {
      return res.status(400).json({ message: 'Müştəri tapılmadı' });
    }

    const giftCard = new GiftCard({
      cardNumber,
      massageType,
      duration,
      originalPrice, // Avtomatik hesablanmış qiymət
      branch: req.user.branch,
      purchasedBy,
      notes,
      createdBy: req.user.userId
    });

    await giftCard.save();

    const populatedCard = await GiftCard.findById(giftCard._id)
      .populate('massageType', 'name')
      .populate('purchasedBy', 'name phone')
      .populate('branch', 'name')
      .populate('createdBy', 'name');

    res.status(201).json(populatedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
    
    const giftCard = await GiftCard.findOne({ cardNumber })
      .populate('massageType', 'name durations')
      .populate('purchasedBy', 'name phone')
      .populate('branch', 'name');

    if (!giftCard) {
      return res.status(404).json({ message: 'Hədiyyə kartı tapılmadı' });
    }

    // Check if used
    if (giftCard.isUsed) {
      return res.status(400).json({ 
        message: 'Bu hədiyyə kartı artıq istifadə olunub',
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

    res.json({
      valid: true,
      giftCard
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Use gift card in appointment
router.post('/use/:cardNumber/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { cardNumber } = req.params;
    const { appointmentId, usedBy } = req.body;

    const giftCard = await GiftCard.findOne({ cardNumber });
    
    if (!giftCard) {
      return res.status(404).json({ message: 'Hədiyyə kartı tapılmadı' });
    }

    if (giftCard.isUsed) {
      return res.status(400).json({ message: 'Bu hədiyyə kartı artıq istifadə olunub' });
    }

    // Update gift card as used
    giftCard.isUsed = true;
    giftCard.usedDate = new Date();
    giftCard.usedBy = usedBy;
    giftCard.usedInAppointment = appointmentId;

    await giftCard.save();

    const populatedCard = await GiftCard.findById(giftCard._id)
      .populate('massageType', 'name')
      .populate('purchasedBy', 'name phone')
      .populate('usedBy', 'name phone')
      .populate('branch', 'name');

    res.json({
      message: 'Hədiyyə kartı uğurla istifadə edildi',
      giftCard: populatedCard
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

