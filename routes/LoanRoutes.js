const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Loan = require('../models/Loan');
const User = require('../models/user');
const nodemailer = require('nodemailer');

// Import authentication middleware
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|pdf/;
        const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
        if (extName) return cb(null, true);
        cb(new Error("Only images and PDFs allowed"));
    }
});

// Upload middleware with error handling
const uploadDocuments = (req, res, next) => {
    upload.fields([
        { name: 'idFront', maxCount: 1 },
        { name: 'idBack', maxCount: 1 },
        { name: 'agreement', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
                }
                return res.status(400).json({ message: "Upload error: " + err.message });
            }
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
};

// ============================================================
// CLIENT ROUTES
// ============================================================

// 1. Submit loan application
router.post('/apply', authMiddleware, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        const newLoan = new Loan({
            ...req.body,
            applicant: userId,
            status: 'pending'
        });

        const savedLoan = await newLoan.save();

        // Update user profile with KYC data automatically
        await User.findByIdAndUpdate(userId, {
            $set: {
                idNumber: req.body.idNumber,
                guarantorName: req.body.guarantorName,
                guarantorPhone: req.body.guarantorPhone
            }
        });

        res.status(201).json(savedLoan);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 2. Get my loans
router.get('/my-loans', authMiddleware, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const loans = await Loan.find({ applicant: userId }).sort({ createdAt: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch loans" });
    }
});

// 3. Upload documents
router.patch('/upload-docs/:id', authMiddleware, uploadDocuments, async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ message: "Loan not found" });

        const userId = req.user._id || req.user.id;
        if (loan.applicant.toString() !== userId.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Unauthorized access" });
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

// 4. Get all loans for admin
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

// 5. Admin upload override
router.patch('/admin/upload-docs/:id', authMiddleware, adminOnly, uploadDocuments, async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ message: "Loan not found" });

        if (req.files['idFront']) loan.idFrontImage = req.files['idFront'][0].path;
        if (req.files['idBack']) loan.idBackImage = req.files['idBack'][0].path;
        if (req.files['agreement']) loan.signedAgreement = req.files['agreement'][0].path;

        await loan.save();
        res.json({ message: "Documents updated by admin" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 6. Admin Update Status
router.patch('/admin/update-status/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const loan = await Loan.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(loan);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 7. Admin Delete Loan
router.delete('/admin/delete/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await Loan.findByIdAndDelete(req.params.id);
        res.json({ message: "Loan record deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;