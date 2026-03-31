const cron = require('node-cron');
const Loan = require('../models/Loan');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const checkDueLoansAndNotify = async () => {
    try {
        console.log('Running Scheduler...');
        const today = new Date();
        
        const dateIn2Days = new Date(today);
        dateIn2Days.setDate(today.getDate() + 2);
        
        const dateIn3Days = new Date(today);
        dateIn3Days.setDate(today.getDate() + 3);

        const targetDate2 = formatDate(dateIn2Days);
        const targetDate3 = formatDate(dateIn3Days);

        // FIXED: Added '$' before 'in'
        const dueLoans = await Loan.find({
            status: 'approved',
            expectedPayDate: { $in: [targetDate2, targetDate3] }
        }).populate('applicant');

        console.log('Found ' + dueLoans.length + ' loans due soon.');

        for (const loan of dueLoans) {
            if (!loan.applicant || !loan.applicant.email) continue;
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: loan.applicant.email,
                    subject: 'Loan Reminder - Avenir',
                    text: 'Hi ' + loan.applicant.name + ', your loan of KES ' + loan.principal + ' is due on ' + loan.expectedPayDate + '.'
                });
                console.log('Email sent to ' + loan.applicant.email);
            } catch (e) {
                console.log("Email error", e.message);
            }
        }
    } catch (error) {
        console.error('Cron Error:', error);
    }
};

const startNotificationScheduler = () => {
    cron.schedule('0 8 * * *', checkDueLoansAndNotify);
    console.log('Scheduler Started.');
};

module.exports = { startNotificationScheduler };