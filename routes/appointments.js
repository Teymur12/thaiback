// routes/appointments.js
const express = require('express');
const Appointment = require('../models/Appointment');
const Customer = require('../models/Customer');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Günlük randevuları al (filial və tarixə görə)
router.get('/daily/:branchId/:date/:token', auth, async (req, res) => {
  try {
    const { branchId, date } = req.params;
    
    // Tarixi parse et
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      branch: branchId,
      startTime: {
        $gte: startDate,
        $lte: endDate
      },
      status: { $ne: 'cancelled' }
    })
    .populate('customer', 'name phone')
    .populate('masseur', 'name')
    .populate('massageType', 'name')
    .populate('branch', 'name')
    .sort({ startTime: 1 });

    res.json(appointments);
  } catch (error) {
    console.error('Randevuları alma xətası:', error);
    res.status(500).json({ message: error.message });
  }
});

// Yeni randevu yarat
router.post('/:token', auth, async (req, res) => {
  try {
    const appointmentData = {
      ...req.body,
      createdBy: req.user.id,
      status: 'scheduled'
    };

    // Randevu konfliktini yoxla
    const conflictingAppointment = await Appointment.findOne({
      masseur: appointmentData.masseur,
      branch: appointmentData.branch,
      status: { $ne: 'cancelled' },
      $or: [
        {
          startTime: {
            $lt: new Date(appointmentData.endTime),
            $gte: new Date(appointmentData.startTime)
          }
        },
        {
          endTime: {
            $gt: new Date(appointmentData.startTime),
            $lte: new Date(appointmentData.endTime)
          }
        },
        {
          startTime: { $lte: new Date(appointmentData.startTime) },
          endTime: { $gte: new Date(appointmentData.endTime) }
        }
      ]
    });

    if (conflictingAppointment) {
      return res.status(400).json({ 
        message: 'Bu vaxt aralığında masajist artıq məşğuldur!' 
      });
    }

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    // Populate edilmiş versiyonu qaytar
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name')
      .populate('branch', 'name');

    res.status(201).json(populatedAppointment);
  } catch (error) {
    console.error('Randevu yaratma xətası:', error);
    res.status(400).json({ message: error.message });
  }
});

// Randevu güncəllə
router.put('/:id/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Əgər vaxt dəyişdirilirsə, konflikt yoxla
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

// Randevu sil
router.delete('/:id/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu tapılmadı' });
    }

    // Admin və ya yaradanı randevunu silə bilər
    if (req.user.role !== 'admin' && appointment.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Bu randevunu silmək səlahiyyətiniz yoxdur' });
    }

    await Appointment.findByIdAndDelete(id);
    
    res.json({ message: 'Randevu uğurla silindi' });
  } catch (error) {
    console.error('Randevu silmə xətası:', error);
    res.status(500).json({ message: error.message });
  }
});

// Randevunu tamamla (ödəniş məlumatı əlavə et)
router.put('/:id/complete/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, actualPrice, notes } = req.body;

    if (!paymentMethod || !['cash', 'card', 'terminal'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Ödəniş metodu seçilməlidir' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      { 
        status: 'completed',
        paymentMethod: paymentMethod,
        price: actualPrice || undefined,
        notes: notes || undefined
      },
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
    console.error('Randevu tamamlama xətası:', error);
    res.status(400).json({ message: error.message });
  }
});

// Randevunu ləğv et
router.put('/:id/cancel/:token', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      { 
        status: 'cancelled',
        notes: reason ? `Ləğv səbəbi: ${reason}` : 'Ləğv edildi'
      },
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
    console.error('Randevu ləğv etmə xətası:', error);
    res.status(400).json({ message: error.message });
  }
});

// Masajistin günlük cədvəlini al
router.get('/masseur/:masseurId/:date/:token', auth, async (req, res) => {
  try {
    const { masseurId, date } = req.params;
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      masseur: masseurId,
      startTime: {
        $gte: startDate,
        $lte: endDate
      },
      status: { $ne: 'cancelled' }
    })
    .populate('customer', 'name phone')
    .populate('massageType', 'name')
    .populate('branch', 'name')
    .sort({ startTime: 1 });

    res.json(appointments);
  } catch (error) {
    console.error('Masajist cədvəli alma xətası:', error);
    res.status(500).json({ message: error.message });
  }
});

// Randevu axtarışı (müştəri adı və ya telefon ilə)
router.get('/search/:token', auth, async (req, res) => {
  try {
    const { q, branchId, date } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Axtarış sorğusu ən az 2 simvol olmalıdır' });
    }

    // İlk olaraq müştəriləri tap
    const customers = await Customer.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ]
    });

    const customerIds = customers.map(c => c._id);

    // Sorğu filtri yarat
    const filter = {
      customer: { $in: customerIds },
      status: { $ne: 'cancelled' }
    };

    if (branchId) {
      filter.branch = branchId;
    }

    if (date) {
      const searchDate = new Date(date);
      const startDate = new Date(searchDate.setHours(0, 0, 0, 0));
      const endDate = new Date(searchDate.setHours(23, 59, 59, 999));
      filter.startTime = { $gte: startDate, $lte: endDate };
    }

    const appointments = await Appointment.find(filter)
      .populate('customer', 'name phone')
      .populate('masseur', 'name')
      .populate('massageType', 'name')
      .populate('branch', 'name')
      .sort({ startTime: -1 })
      .limit(20);

    res.json(appointments);
  } catch (error) {
    console.error('Randevu axtarış xətası:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;