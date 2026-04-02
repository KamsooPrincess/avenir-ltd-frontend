const User = require('../models/user');
const bcrypt = require('bcryptjs');
// 1. IMPORT JWT HERE
const jwt = require('jsonwebtoken'); 

exports.signupUser = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const { name, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'client'
    });

    await newUser.save();

    res.status(201).json({ 
      message: 'Account created successfully!',
      user: { 
        id: newUser._id, 
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      } 
    });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    res.status(500).json({ message: 'Registration failed: ' + error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const cleanEmail = email.trim().toLowerCase();
    
    const user = await User.findOne({ email: cleanEmail });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // 2. CREATE THE TOKEN (This was missing!)
    const payload = {
      id: user._id,
      role: user.role
    };

    // Sign the token. Make sure JWT_SECRET is in your .env file
    const token = jwt.sign(
        payload, 
        process.env.JWT_SECRET || "avenir_super_secret_key_123", 
        { expiresIn: "5h" }
    );

    // 3. SEND THE TOKEN AND USER BACK TO FRONTEND
    res.json({
      message: 'Login successful!',
      token: token, // <--- Your frontend needs this!
      user: {
        id: user._id,
        _id: user._id, // Ensure both are sent just in case
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        // Include these so the frontend can pre-fill forms
        idNumber: user.idNumber,
        guarantorName: user.guarantorName,
        guarantorPhone: user.guarantorPhone,
        guarantorId: user.guarantorId,
        guarantorRelation: user.guarantorRelation
      }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log(`Password reset requested for: ${email}`);
  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
};

exports.getClients = async (req, res) => {
  try {
    const users = await User.find({ role: 'client' }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};