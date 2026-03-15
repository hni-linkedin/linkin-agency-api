const apiKeyMiddleware = (req, res, next) => {
    // Pass /health endpoint
    if (req.path === '/health') {
        return next();
    }

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
};

module.exports = apiKeyMiddleware;
