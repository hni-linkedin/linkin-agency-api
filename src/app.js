const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createCorsOptions } = require('./config/cors');
const captureRoutes = require('./routes/capture');
const networkRoutes = require('./routes/network');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const managerRoutes = require('./routes/manager');
const clientRoutes = require('./routes/client');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const corsOptions = createCorsOptions();

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/capture', captureRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/client', clientRoutes);

app.use(errorHandler);

module.exports = app;
