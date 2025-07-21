// src/config/cloudinaryConfig.js
import { v2 as cloudinary } from 'cloudinary'; // Import Cloudinary v2 SDK
import dotenv from 'dotenv'; // Import dotenv to load environment variables

dotenv.config(); // Load environment variables from .env file

// Configure Cloudinary using credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Your Cloudinary cloud name
  api_key: process.env.CLOUDINARY_API_KEY,       // Your Cloudinary API key
  api_secret: process.env.CLOUDINARY_API_SECRET, // Your Cloudinary API secret
  secure: true // Use HTTPS for all Cloudinary URLs
});

export default cloudinary; // Export the configured Cloudinary instance
