// src/models/EmailLog.model.js
import mongoose from 'mongoose';

// Schema for individual recipient details
const recipientSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  status: {
    type: String, // 'Pending', 'Success', 'Failed' for this specific recipient
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Pending', // Default to pending until confirmed
  },
  error: {
    type: String, // To store specific errors for this recipient
  },
}, { _id: false }); // Do not create a default _id for subdocuments

// Schema for attachment metadata
const attachmentLogSchema = new mongoose.Schema({
  filename: {
    type: String,
  },
  size: {
    type: Number,
  },
  secure_url: {
    type: String, // For Cloudinary attachments
  },
  path: {
    type: String, // For local attachments (e.g., from form submissions)
  },
  contentType: {
    type: String,
  },
  public_id: {
    type: String, // Cloudinary public ID
  },
}, { _id: false });

// Main schema for email send logs
const emailLogSchema = new mongoose.Schema({
  messageId: {
    type: String,
    // This is the message ID returned by the SMTP server (e.g., Nodemailer).
    // It's useful for debugging and tracking individual emails in the mail server logs.
    unique: true, // Assuming message IDs are unique
    sparse: true, // Allows null values, so validation only applies if a value is present
  },
  sender: {
    type: String,
    trim: true,
    lowercase: true,
  },
  // 'to', 'cc', 'bcc' will store an array of objects, each with an email and its status
  to: [recipientSchema],
  cc: [recipientSchema],
  bcc: [recipientSchema],
  subject: {
    type: String,
    trim: true,
  },
  htmlContent: { // Changed from htmlContentPreview to htmlContent
    type: String, // Stores the full HTML content
  },
  attachments: [attachmentLogSchema], // Array of attachment metadata
  overallStatus: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Pending', // Initial status
  },
  errorLog: {
    type: String, // Detailed error message for overall email sending failure
  },
  relatedFormSubmissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form', // Reference to the FormData model if the email is linked to a form submission
    sparse: true, // Allows null values
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true }); // Automatically add createdAt and updatedAt timestamps

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);