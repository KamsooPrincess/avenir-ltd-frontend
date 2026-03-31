const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// --- 1. IMPORTS ---
const UserRoutes = require('./routes/UserRoutes'); 
const LoanRoutes = require('./routes/LoanRoutes'); 
// Import the notification service
const { startNotificationScheduler } = require('./services/notificationService');

dotenv.config();
const app = express();

// 2. Middleware
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// 3. Connect to Database
connectDB();

// 4. API Endpoints
app.use('/api/users', UserRoutes);
app.use('/api/loans', LoanRoutes);

app.get('/', (req, res) => res.send('Avenir API is live and running'));

const PORT = 5000;
app.listen(PORT, () => {
    console.log(` SERVER IS RUNNING ON PORT ${PORT}`);
    console.log(` API Users Endpoint: http://localhost:${PORT}/api/users`);
    console.log(` API Loans Endpoint: http://localhost:${PORT}/api/loans`);
    
    // --- 5. START THE SCHEDULER ---
    startNotificationScheduler();
});