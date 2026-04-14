// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');

const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:8081",
    "https://thaifront-1cvf.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI);

// Create admin after DB connection
mongoose.connection.once('open', async () => {
  console.log('Connected to MongoDB');

});

// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/admin', require('./routes/admin.js'));
app.use('/api/appointments', require('./routes/appointments.js'));
app.use('/api/receptionist', require('./routes/receptionist.js'));
app.use('/api/gift-cards', require('./routes/giftCards'));
app.use('/api/packages', require('./routes/packages'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
