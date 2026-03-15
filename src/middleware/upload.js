const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/html') {
        cb(null, true);
    } else {
        const error = new Error('Invalid file type. Expected text/html.');
        error.status = 422;
        cb(error, false);
    }
};

const limits = {
    // MAX_FILE_SIZE_MB from env, fallback to 10
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024
};

const upload = multer({
    storage,
    fileFilter,
    limits
});

module.exports = upload;
