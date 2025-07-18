import mongoose from 'mongoose';

// Define the schema for the Admin model
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true, // Email is mandatory
    unique: true,   // Email must be unique across admin accounts
    lowercase: true, // Store emails in lowercase to ensure uniqueness consistency
    trim: true,      // Remove whitespace from both ends of the email string
    // Basic email format validation (can be more robust in controller)
    match: [/^[^@]+@[^@]+\.[^@]+$/, 'Please enter a valid email address']
  },
  otp: {
    type: Number, // Ensure OTP is stored as a Number
    // OTP is not required when an admin account is first created, only when an OTP is generated
    // It will be null after successful verification or before an OTP request
  },
  otpExpiresAt: {
    type: Date,
    // This field stores the expiration timestamp for the OTP
    // It will be null after successful verification or before an OTP request
  },
  lastLogin: {
    type: Date,
    // Records the timestamp of the last successful login
  },
}, {
  timestamps: true // Adds `createdAt` and `updatedAt` fields automatically
});

// Create and export the Admin model based on the schema
export const Admin = mongoose.model('Admin', adminSchema);