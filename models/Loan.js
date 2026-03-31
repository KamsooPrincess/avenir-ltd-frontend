// models/Loan.js
const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  applicant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true // Speeds up /my-loans query
  },
  phoneNumber: { type: String, required: true },
  idNumber: { type: String, required: true },
  principal: { type: Number, required: true },
  duration: { type: String, required: true },
  interestRate: { type: Number, required: true },
  interestAmount: { type: Number, required: true },
  totalToPay: { type: Number, required: true },
  
  // Changed from String to Date — critical for overdue detection
  expectedPayDate: { type: Date, required: true },
  
  description: { type: String, default: '' },

  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'paid', 'overdue'], 
    default: 'pending' 
  },

  // Guarantor — was missing entirely
  guarantorName: { type: String, default: '' },
  guarantorPhone: { type: String, default: '' },
  guarantorId: { type: String, default: '' },
  guarantorRelation: { type: String, default: '' },

  // Documents
  idFrontImage: { type: String, default: null },
  idBackImage: { type: String, default: null },
  signedAgreement: { type: String, default: null },

  // Timestamps for status changes
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  paidAt: { type: Date },

}, { timestamps: true });

// Virtual: check if overdue (only meaningful when status is 'approved')
loanSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'approved') return false;
  return new Date(this.expectedPayDate) < new Date();
});

// Make virtuals appear in JSON/toObject
loanSchema.set('toJSON', { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Loan', loanSchema);