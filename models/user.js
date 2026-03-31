// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'], 
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  phone: { 
    type: String, 
    required: [true, 'Phone number is required'], 
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  role: { 
    type: String, 
    enum: ['client', 'admin'], 
    default: 'client' 
  },

  // NEW: ID number for KYC
  idNumber: { 
    type: String, 
    default: '',
    trim: true 
  },

  // NEW: Default guarantor info (pre-fills on loan applications)
  guarantorName: { type: String, default: '' },
  guarantorPhone: { type: String, default: '' },
  guarantorId: { type: String, default: '' },
  guarantorRelation: { type: String, default: '' },

  kycStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }

  // REMOVED: loans array — redundant with Loan.applicant ref
  // If you need to count loans, use Loan.countDocuments({ applicant: userId })
});

module.exports = mongoose.model('User', userSchema);