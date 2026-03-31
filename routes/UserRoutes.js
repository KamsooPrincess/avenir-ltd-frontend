const express = require('express');
const router = express.Router();
// Make sure these names match the exports in userController.js exactly
const { signupUser, loginUser, forgotPassword, getClients } = require('../controllers/userController');

// 1. FETCH ALL CLIENTS
router.get('/', getClients);

// 2. SIGNUP
router.post('/signup', signupUser);

// 3. LOGIN
router.post('/login', loginUser);

// 4. FORGOT PASSWORD
router.post('/forgot-password', forgotPassword);

module.exports = router;