// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Lokal üçün
      "https://thaifront-1cvf.vercel.app" // Vercel frontend üçün
    ],
    credentials: true,
  })
);
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://shahinim_db_user:oeNMRviossC4SmPE@cluster0.p2zqjan.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    const User = require('./models/User');
    
    // Check if admin already exists
    const adminExists = await User.findOne({ username: 'admin' });
    
    if (!adminExists) {
      const admin = new User({
        name: 'Admin',
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
      
      await admin.save();
      console.log('Default admin created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin:', error.message);
  }
};

// Create admin after DB connection
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
  createDefaultAdmin();
});

// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/admin', require('./routes/admin.js'));
app.use('/api/appointments', require('./routes/appointments.js'));
app.use('/api/receptionist', require('./routes/receptionist.js'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
