// routes/receptionist.js
const express = require('express');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const Masseur = require('../models/Masseur');
const MassageType = require('../models/MassageType');
const { auth, receptionistAuth } = require('../middleware/auth');
const router = express.Router();

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
router.post('/appointments/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const appointment = new Appointment({
      ...req.body,
      branch: req.user.branch,
      createdBy: req.user.userId
    });
    await appointment.save();
    res.status(201).json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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

router.put('/appointments/:id/complete/:token', auth, receptionistAuth, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'completed',
        paymentMethod: paymentMethod
      },
      { new: true }
    );
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
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

module.exports = router;