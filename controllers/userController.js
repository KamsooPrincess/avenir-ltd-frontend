const User = require('../models/user');
const bcrypt = require('bcryptjs');

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

    res.json({
      message: 'Login successful!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log(`Password reset requested for: ${email}`);
  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
};

// CRITICAL: This function must exist for the route to work
exports.getClients = async (req, res) => {
  try {
    const users = await User.find({ role: 'client' }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};