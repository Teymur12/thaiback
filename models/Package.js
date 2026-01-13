const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    massageType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MassageType',
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    totalVisits: {
        type: Number,
        default: 10
    },
    remainingVisits: {
        type: Number,
        default: 10
    },
    price: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'terminal'],
        default: 'cash'
    },
    visits: [{
        date: {
            type: Date,
            default: Date.now
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment'
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Package', packageSchema);
