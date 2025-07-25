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
    },
    // Store Cloudinary secure_url
    secure_url: {
      type: String,
    },
    // Store Cloudinary public_id for future deletion/management
    public_id: {
      type: String,
    },
    contentType: {
      type: String,
    },
    // Optional: Size of the attachment in bytes
    size: {
      type: Number,
      default: 0, // Default size is 0 if not provided
    },
  }],
  
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Create the model from the schema
export const Template = mongoose.model('Template', templateSchema);
