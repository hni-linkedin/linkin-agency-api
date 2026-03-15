const path = require('path');
const dotenv = require('dotenv');
// Load .env from Backend folder so it works regardless of where you run npm from
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const captureRoutes = require('./routes/capture');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (Public)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API Routes
app.use('/api/capture', captureRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
