const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    postcode: { type: String, trim: true },
    assignedCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre' },
    role: { type: String, enum: ['customer', 'admin', 'farm'], default: 'customer' },

    // Farm-specific profile fields (only used when role === 'farm')
    farmName: { type: String, trim: true },
    farmDescription: { type: String },
    farmLocation: { type: String, trim: true }, // e.g. "Shropshire, UK"
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
