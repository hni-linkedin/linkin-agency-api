const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

function uploadHtmlToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'raw', format: 'html', ...options },
            (error, result) => {
                if (error) {
                    // Wrap error for global error handler
                    const err = new Error(error.message);
                    err.code = 'CLOUDINARY_UPLOAD_FAILED';
                    err.originalError = error;
                    reject(err);
                } else {
                    resolve(result);
                }
            }
        );
        Readable.from(buffer).pipe(stream);
    });
}

module.exports = {
    uploadHtmlToCloudinary
};
