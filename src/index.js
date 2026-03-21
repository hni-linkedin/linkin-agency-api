const path = require('path');
const dotenv = require('dotenv');
// Load .env from Backend folder so it works regardless of where you run npm from
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const app = require('./app');

const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
