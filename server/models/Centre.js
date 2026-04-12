const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    postcode: { type: String, required: true },
    // Postcodes this centre serves (prefix matching)
    servedPostcodes: [{ type: String }],
    deliveryDays: [{ type: String }], // e.g. ["Monday", "Thursday"]
    phone: { type: String },
    email: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Centre', centreSchema);
