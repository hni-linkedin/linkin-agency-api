const logger = require('../utils/logger');
const multer = require('multer');

const errorHandler = (err, req, res, _next) => {
    logger.error(err.message, err.stack);

    // If error has a specific status assigned by us (like 422 from fileFilter)
    if (err.status) {
        return res.status(err.status).json({ success: false, error: err.message });
    }

    // Multer file size error
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, error: 'File too large. Max 10MB.' });
    }

    // Zod validation errors (mostly caught in controller, but just in case)
    if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }

    // Determine specific codes based on our PRD logic
    const code = err.code || 'INTERNAL_SERVER_ERROR';

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: code
    });
};

module.exports = errorHandler;
