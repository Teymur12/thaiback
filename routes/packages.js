const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const Customer = require('../models/Customer');
const MassageType = require('../models/MassageType');
const Appointment = require('../models/Appointment'); // Assuming you might need this for checking appointment existence
const { auth, receptionistAuth, adminAuth } = require('../middleware/auth'); // Check default auth import

// 1. Create a new package (Sale)
router.post('/create/:token', auth, receptionistAuth, async (req, res) => {
    try {
        const {
            customerId,
            massageTypeId,
            duration,
            paymentMethod,
            notes
        } = req.body;

        // Validate inputs
        const customer = await Customer.findById(customerId);
        if (!customer) return res.status(404).json({ message: 'Müştəri tapılmadı' });

        const massageType = await MassageType.findById(massageTypeId);
        if (!massageType) return res.status(404).json({ message: 'Masaj növü tapılmadı' });

        // Validate duration and get price
        const durationOption = massageType.durations.find(d => d.minutes === Number(duration));
        if (!durationOption) return res.status(400).json({ message: 'Yanlış müddət' });

        // Calculate Price: (Unit Price * 10) * 0.90
        const originalUnitPrice = durationOption.price;
        const totalOriginalPrice = originalUnitPrice * 10;
        const discountedPrice = totalOriginalPrice * 0.90;

        const newPackage = new Package({
            customer: customerId,
            massageType: massageTypeId,
            duration: Number(duration),
            totalVisits: 10,
            remainingVisits: 10,
            price: discountedPrice,
            paymentMethod: paymentMethod || 'cash',
            branch: req.user.branch,
            createdBy: req.user.userId,
            notes
        });

        await newPackage.save();

        // Populate for response
        await newPackage.populate(['customer', 'massageType', 'createdBy']);

        res.status(201).json(newPackage);
    } catch (error) {
        console.error('Package creation error:', error);
        res.status(500).json({ message: 'Paket yaradılarkən xəta baş verdi', error: error.message });
    }
});

// 2. Get customer's active packages
router.get('/customer/:customerId/:token', auth, async (req, res) => {
    try {
        const { customerId } = req.params;

        const query = {
            customer: customerId,
            isActive: true,
            remainingVisits: { $gt: 0 },
            branch: req.user.branch
        };

        // Find active packages with remaining visits > 0
        const packages = await Package.find(query)
            .populate('massageType')
            .sort({ createdAt: -1 });

        res.json(packages);
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ message: 'Paketlər gətirilərkən xəta baş verdi' });
    }
});

// 3. Use a visit from package
router.post('/:id/use/:token', auth, receptionistAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { appointmentId } = req.body;

        const pkg = await Package.findById(id);
        if (!pkg) return res.status(404).json({ message: 'Paket tapılmadı' });

        if (!pkg.isActive) return res.status(400).json({ message: 'Paket aktiv deyil' });
        if (pkg.remainingVisits <= 0) return res.status(400).json({ message: 'Paketdə gediş haqqı bitib' });

        // Decrement visits
        pkg.remainingVisits -= 1;
        pkg.visits.push({
            date: new Date(),
            appointmentId: appointmentId
        });

        // Check if finished
        if (pkg.remainingVisits === 0) {
            pkg.isActive = false; // Optionally mark inactive if finished, or just rely on remainingVisits check
        }

        await pkg.save();
        res.json({ message: 'Paket istifadə edildi', remainingVisits: pkg.remainingVisits });

    } catch (error) {
        console.error('Package usage error:', error);
        res.status(500).json({ message: 'Paket istifadə edilərkən xəta baş verdi' });
    }
});

// 4. Delete package (Admin only)
router.delete('/:id/:token', auth, adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const pkg = await Package.findByIdAndDelete(id);

        if (!pkg) return res.status(404).json({ message: 'Paket tapılmadı' });

        res.json({ message: 'Paket silindi' });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ message: 'Paket silinərkən xəta baş verdi' });
    }
});

// 5. Get all packages (for Admin/List)
router.get('/all/:token', auth, async (req, res) => {
    try {
        const { branch } = req.query;
        let query = {};

        // If not admin, or no branch query param, filter by user's branch
        if (req.user.role !== 'admin' || !branch) {
            query.branch = req.user.branch;
        } else {
            query.branch = branch;
        }

        const packages = await Package.find(query)
            .populate('customer')
            .populate('massageType')
            .populate('createdBy')
            .populate('branch', 'name')
            .sort({ createdAt: -1 });

        res.json(packages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 6. Get packages sold on a specific date (for Daily Report)
router.get('/date/:date/:token', auth, async (req, res) => {
    try {
        const { date } = req.params;
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const query = {
            branch: req.user.branch,
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        };

        const packages = await Package.find(query)
            .populate('customer')
            .populate('massageType')
            .populate('createdBy')
            .sort({ createdAt: -1 });

        res.json(packages);
    } catch (error) {
        console.error('Get daily packages error:', error);
        res.status(500).json({ message: 'Paketlər gətirilərkən xəta baş verdi' });
    }
});

module.exports = router;
