// routes/loans.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Loan = require('../models/Loan');
const User = require('../models/user');
const nodemailer = require('nodemailer');

// ============================================================
// IMPORTANT: Import YOUR auth middleware — adjust path as needed
// ============================================================
const authMiddleware = require('../middleware/auth');

// --- MULTER CONFIGURATION ---
const uploadDir = 'uploads/documents';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const cleanName = file.originalname.replace(/\s+/g, '-').toLowerCase();
        cb(null, `${Date.now()}-${cleanName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|pdf/;
        const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
        if (extName) return cb(null, true);
        cb(new Error("Only images and PDFs allowed"));
    }
});

// Multer error handler wrapper
const handleUpload = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
        }
        return res.status(400).json({ message: "Upload error: " + err.message });
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
};

// Admin-only gate
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
};


// ============================================================
// CLIENT ROUTES
// ============================================================

// 1. CLIENT: Submit loan application
router.post('/apply', authMiddleware, async (req, res) => {
    try {
        const applicant = req.user._id;

        const { 
            phoneNumber, idNumber, 
            principal, duration, interestRate, 
            interestAmount, totalToPay, expectedPayDate, 
            description,
            guarantorName, guarantorPhone, guarantorId, guarantorRelation
        } = req.body;

        if (!principal || principal < 500) {
            return res.status(400).json({ message: "Minimum loan amount is KES 500" });
        }
        if (!phoneNumber || !idNumber) {
            return res.status(400).json({ message: "Phone number and ID are required" });
        }

        const newLoan = new Loan({
            applicant,
            phoneNumber,
            idNumber,
            principal: Number(principal),
            duration,
            interestRate: Number(interestRate),
            interestAmount: Number(interestAmount),
            totalToPay: Number(totalToPay),
            expectedPayDate: new Date(expectedPayDate),
            description: description || '',
            guarantorName: guarantorName || '',
            guarantorPhone: guarantorPhone || '',
            guarantorId: guarantorId || '',
            guarantorRelation: guarantorRelation || '',
            status: 'pending'
        });

        const savedLoan = await newLoan.save();

        // Persist KYC info to user profile for next time
        if (idNumber && req.user.idNumber !== idNumber) {
            await User.findByIdAndUpdate(applicant, { $set: { idNumber } });
        }
        if (guarantorName) {
            await User.findByIdAndUpdate(applicant, {
                $set: {
                    guarantorName: guarantorName || '',
                    guarantorPhone: guarantorPhone || '',
                    guarantorId: guarantorId || '',
                    guarantorRelation: guarantorRelation || ''
                }
            });
        }

        res.status(201).json(savedLoan);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 2. CLIENT: Get only my loans
router.get('/my-loans', authMiddleware, async (req, res) => {
    try {
        const loans = await Loan.find({ applicant: req.user._id })
            .sort({ createdAt: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch loans" });
    }
});

// 3. CLIENT: Upload documents for own loan
router.patch('/upload-docs/:id', authMiddleware, upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'agreement', maxCount: 1 }
]), handleUpload(), async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ message: "Loan not found" });

        if (loan.applicant.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "You can only upload documents for your own loan" });
        }

        if (req.files['idFront']) loan.idFrontImage = req.files['idFront'][0].path;
        if (req.files['idBack']) loan.idBackImage = req.files['idBack'][0].path;
        if (req.files['agreement']) loan.signedAgreement = req.files['agreement'][0].path;

        await loan.save();
        res.json({ message: "Documents uploaded successfully", loan });
    } catch (err) {
        res.status(500).json({ message: "Server Error: " + err.message });
    }
});


// ============================================================
// ADMIN ROUTES
// ============================================================

// 4. ADMIN: Get all loans
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
    try {
        const loans = await Loan.find()
            .populate('applicant', 'name email phone')
            .sort({ createdAt: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. ADMIN: Create loan for any client
router.post('/admin/create', authMiddleware, adminOnly, async (req, res) => {
    try {
        const {
            applicant, phoneNumber, idNumber,
            principal, duration, interestRate,
            interestAmount, totalToPay, expectedPayDate,
            description, status,
            guarantorName, guarantorPhone, guarantorId, guarantorRelation
        } = req.body;

        if (!applicant) return res.status(400).json({ message: "Applicant ID is required" });
        if (!principal || principal < 500) return res.status(400).json({ message: "Minimum loan is KES 500" });

        const newLoan = new Loan({
            applicant,
            phoneNumber,
            idNumber,
            principal: Number(principal),
            duration,
            interestRate: Number(interestRate),
            interestAmount: Number(interestAmount),
            totalToPay: Number(totalToPay),
            expectedPayDate: new Date(expectedPayDate),
            description: description || '',
            status: status || 'approved',
            guarantorName: guarantorName || '',
            guarantorPhone: guarantorPhone || '',
            guarantorId: guarantorId || '',
            guarantorRelation: guarantorRelation || ''
        });

        const savedLoan = await newLoan.save();
        res.status(201).json(savedLoan);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 6. ADMIN: Upload documents (admin override)
router.patch('/admin/upload-docs/:id', authMiddleware, adminOnly, upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'agreement', maxCount: 1 }
]), handleUpload(), async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ message: "Loan not found" });

        if (req.files['idFront']) loan.idFrontImage = req.files['idFront'][0].path;
        if (req.files['idBack']) loan.idBackImage = req.files['idBack'][0].path;
        if (req.files['agreement']) loan.signedAgreement = req.files['agreement'][0].path;

        await loan.save();
        res.json({ message: "Documents uploaded successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error: " + err.message });
    }
});

// 7. ADMIN: Bulk Actions
router.patch('/admin/bulk-action', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { ids, action } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No IDs provided" });
        }

        const validActions = ['approved', 'rejected', 'paid', 'overdue', 'pending'];
        if (action !== 'delete' && !validActions.includes(action)) {
            return res.status(400).json({ message: `Invalid action: ${action}` });
        }

        if (action === 'delete') {
            const loans = await Loan.find({ _id: { $in: ids } });
            for (const loan of loans) {
                [loan.idFrontImage, loan.idBackImage, loan.signedAgreement].forEach(file => {
                    if (file && fs.existsSync(file)) {
                        try { fs.unlinkSync(file); } catch (e) {}
                    }
                });
            }
            await Loan.deleteMany({ _id: { $in: ids } });
            return res.json({ message: `Deleted ${ids.length} records.` });
        }

        let updateData = { status: action };
        const now = new Date();
        if (action === 'approved') updateData.approvedAt = now;
        if (action === 'rejected') updateData.rejectedAt = now;
        if (action === 'paid') updateData.paidAt = now;

        await Loan.updateMany({ _id: { $in: ids } }, updateData);
        res.json({ message: `Updated ${ids.length} loans to ${action}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 8. ADMIN: Update status (Single)
router.patch('/admin/update-status/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'approved', 'rejected', 'paid', 'overdue'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status: ${status}` });
        }

        let updateData = { status };
        const now = new Date();
        if (status === 'approved') updateData.approvedAt = now;
        if (status === 'rejected') updateData.rejectedAt = now;
        if (status === 'paid') updateData.paidAt = now;

        const updatedLoan = await Loan.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedLoan) return res.status(404).json({ message: "Loan not found" });

        res.json(updatedLoan);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 9. ADMIN: Delete Record (Single)
router.delete('/admin/delete/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ message: "Loan not found" });

        [loan.idFrontImage, loan.idBackImage, loan.signedAgreement].forEach(file => {
            if (file && fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch (e) {}
            }
        });

        await Loan.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 10. ADMIN: Send Reminder Email
router.post('/admin/notify/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id).populate('applicant');
        if (!loan || !loan.applicant) {
            return res.status(404).json({ message: "Loan or client not found" });
        }

        const dueDate = loan.expectedPayDate 
            ? new Date(loan.expectedPayDate).toLocaleDateString('en-GB', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              })
            : 'Not set';

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS 
            }
        });

        await transporter.sendMail({
            from: `"Avenir K&A" <${process.env.EMAIL_USER}>`,
            to: loan.applicant.email,
            subject: 'Payment Reminder — Avenir K&A',
            text: `Dear ${loan.applicant.name},\n\nThis is a reminder that your loan of KES ${loan.principal.toLocaleString()} is due on ${dueDate}.\n\nTotal Due: KES ${loan.totalToPay.toLocaleString()}\nDuration: ${loan.duration}\n\nPlease make your payment before the due date to avoid penalties.\n\nRegards,\nAvenir K&A Team`
        });

        res.json({ message: "Email sent successfully!" });
    } catch (err) {
        console.error('Email error:', err);
        res.status(500).json({ message: "Failed to send email" });
    }
});

module.exports = router;