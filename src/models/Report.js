const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['follower_stats', 'top_posts', 'audience_breakdown', 'text', 'metric'],
      required: true,
    },
    label: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    sections: [SectionSchema],
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', ReportSchema);
