const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ['Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'],
    },
    imageUrl: { type: String, default: '' },
    unit: { type: String, default: 'each' }, // e.g. "per kg", "per dozen", "each"
    stock: { type: Number, default: 100 },
    featured: { type: Boolean, default: false },

    // Farm that listed this product (null for admin-created products)
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
