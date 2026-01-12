// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Token-i params, query və ya header-dan al
    let token = req.params.token || req.query.token || req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Remove Bearer if present in header
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.userId).populate('branch');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = {
      userId: user._id,
      role: user.role,
      branch: user.branch?._id,
      name: user.name,
      username: user.username
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Token is not valid', error: error.message });
  }
};

const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const receptionistAuth = (req, res, next) => {
  if (req.user.role !== 'receptionist') {
    return res.status(403).json({ message: 'Receptionist access required' });
  }
  next();
};

module.exports = { auth, adminAuth, receptionistAuth };