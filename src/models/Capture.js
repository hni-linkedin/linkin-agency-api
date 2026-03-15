const mongoose = require('mongoose');

const captureSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        index: true,
    },
    clientName: {
        type: String,
    },
    pageType: {
        type: String,
        required: true,
        index: true,
    },
    capturedAt: {
        type: Date,
        required: true,
        index: -1,
    },
    tabUrl: {
        type: String,
        required: true,
    },
    cloudinaryUrl: {
        type: String,
        required: true,
    },
    cloudinaryId: {
        type: String,
    },
    parsedData: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    parseSuccess: {
        type: Boolean,
        required: true,
        index: true,
    },
    agentVersion: {
        type: String,
    },
    notes: {
        type: String,
    },
    deleted: {
        type: Boolean,
        default: false,
        index: true,
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Capture', captureSchema);
