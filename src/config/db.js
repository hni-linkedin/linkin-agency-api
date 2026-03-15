const mongoose = require('mongoose');
const logger = require('../utils/logger');

function getMongoUri() {
    const uri = process.env.MONGODB_URI?.trim();
    if (uri) return uri;

    const user = process.env.MONGO_USER?.trim();
    const pass = process.env.MONGO_PASSWORD?.trim();
    const host = process.env.MONGO_HOST?.trim();
    const db = process.env.MONGO_DB?.trim();
    if (user && pass && host && db) {
        const encodedPass = encodeURIComponent(pass);
        return `mongodb+srv://${user}:${encodedPass}@${host}/${db}`;
    }

    throw new Error('Set either MONGODB_URI or MONGO_USER, MONGO_PASSWORD, MONGO_HOST, MONGO_DB in .env');
}

const connectDB = async () => {
    try {
        const uri = getMongoUri();
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
        });
        logger.info(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = { connectDB };
