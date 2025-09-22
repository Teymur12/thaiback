const express = require('express');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Masseur = require('../models/Masseur');
const MassageType = require('../models/MassageType');
const Appointment = require('../models/Appointment');
const Expense = require('../models/Expense');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Həftə üzrə randevuları almaq
router.get('/week/:branchId/:startDate/:token', auth, async (req, res) => {
  try {
    const { branchId, startDate } = req.params;
    
    // Həftənin başlanğıc və son tarixlərini hesabla
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    const appointments = await Appointment.find({
      branch: branchId,
      appointmentDate: { $gte: start, $lte: end }
    })
    .populate('customer', 'name phone')
    .populate('masseur', 'name')
    .populate('massageType', 'name duration')
    .populate('branch', 'name')
    .sort({ appointmentDate: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Gün üzrə randevuları almaq (YENİ)
router.get('/day/:branchId/:date/:token', auth, async (req, res) => {
  try {
    const { branchId, date } = req.params;
    
    // Günün başlanğıc və son saatlarını hesabla
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      branch: branchId,
      appointmentDate: { $gte: start, $lte: end }
    })
    .populate('customer', 'name phone')
    .populate('masseur', 'name')
    .populate('massageType', 'name duration')
    .populate('branch', 'name')
    .sort({ appointmentDate: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Randevu yaratmaq
router.post('/:token', auth, async (req, res) => {
  try {
    const appointmentData = {
      ...req.body,
      createdBy: req.user.userId
    };

    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name duration price')
      .populate('branch', 'name');

    res.status(201).json(populatedAppointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Randevu yeniləmək
router.put('/:id/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('customer', 'name phone')
    .populate('masseur', 'name')
    .populate('massageType', 'name duration price')
    .populate('branch', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    res.json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Randevu silmək (YENİ)
router.delete('/:id/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findByIdAndDelete(id);

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    res.json({ message: 'Randevu uğurla silindi', deletedAppointment: appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Randevu statusunu yeniləmək (başlandı/tamamlandı)
router.patch('/:id/status/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod, price } = req.body;
    
    const updateData = { status };
    
    // Əgər tamamlandı statusu verilsə, ödəniş məlumatlarını da yenilə
    if (status === 'completed' && paymentMethod && price) {
      updateData.paymentMethod = paymentMethod;
      updateData.price = price;
    }

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('customer', 'name phone')
    .populate('masseur', 'name')
    .populate('massageType', 'name duration price')
    .populate('branch', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    res.json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Filial üçün masajistləri almaq
router.get('/masseurs/:branchId/:token', auth, async (req, res) => {
  try {
    const { branchId } = req.params;
    
    const masseurs = await Masseur.find({ branch: branchId })
      .select('name specialties')
      .sort({ name: 1 });

    res.json(masseurs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Masaj növlərini almaq
router.get('/massage-types/:token', auth, async (req, res) => {
  try {
    const massageTypes = await MassageType.find()
      .select('name durations')
      .sort({ name: 1 });

    res.json(massageTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;