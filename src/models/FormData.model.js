// src/models/FormData.model.js
import mongoose from 'mongoose';

// Define the schema for storing form submission details
const formSchema = new mongoose.Schema({
  // Mandatory fields as per user's request
  form_type: { type: String, required: true },
  page_Name: { type: String, required: true },
  page_url: { type: String, required: true },
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address.`
    }
  },
  // Make college_name and user_type optional in the schema.
  // Their requirement will now be handled by the controller's logic
  // based on the form_type.
  user_type: { type: String }, // Removed required: true
  college_name: { type: String }, // Removed required: true

  // Geo-location and IP details - these can be optional if derived on backend
  geo_ip: { type: String },
  geo_hostname: { type: String }, // New
  geo_country: { type: String },
  geo_region: { type: String },
  geo_city: { type: String },  
  geo_loc: { type: String }, // New: Latitude,Longitude
  geo_org: { type: String }, // New: Organization (ISP)
  geo_postal: { type: String }, // New: Postal code
  geo_timezone: { type: String }, // New: Timezone

  // Other form fields
  bundle_form: { type: String }, // Assuming this might be optional or derived
  reason: { type: String },
  website_url: { type: String },

    // New fields for customizable email content from frontend
  emailSubject: { type: String }, // Custom subject for the thank-you email
  emailMessage: { type: String }, // Custom HTML message body for the thank-you email
  // Timestamp for when the form was submitted
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true }); // Add Mongoose timestamps for createdAt and updatedAt

// Create and export the Form model
export const Form = mongoose.model('Form', formSchema);