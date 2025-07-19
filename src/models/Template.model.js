// src/models/Template.model.js
import mongoose from 'mongoose';

// Define the schema for storing email templates
const templateSchema = new mongoose.Schema({
  // Unique name for the template, e.g., "Welcome Email", "Bundle Thank You"
  templateName: {
    type: String,
    required: true,
    unique: true, // Ensures template names are unique
    trim: true,   // Removes whitespace from both ends of a string
  },
  // Subject line of the email template
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  // HTML content of the email template
  htmlContent: {
    type: String,
    required: true,
  },
  // Optional: Type of template (e.g., 'thank_you', 'follow_up', 'promotional')
  type: {
    type: String,
    enum: ['thank_you', 'follow_up', 'promotional', 'notification', 'other'], // Predefined types
    default: 'other',
  },
  // Optional: Description for internal use
  description: {
    type: String,
    trim: true,
  },
   // Attachments array, now with optional fields for each attachment
  attachments: [{
    filename: {
      type: String,
      // required: true, // Removed, now optional
    },
    path: { // Relative path where the file is stored on the server
      type: String,
      // required: true, // Removed, now optional
    },
    contentType: {
      type: String,
      // required: true, // Removed, now optional
    },
    size: {
      type: Number, // Size in bytes
      // required: true, // Removed, now optional
    }
  }],
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Create the model from the schema
export const Template = mongoose.model('Template', templateSchema);
