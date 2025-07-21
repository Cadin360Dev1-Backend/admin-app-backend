import mongoose from 'mongoose';

// Define the schema for storing gallery media details
const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    // required: true, // Removed: no longer required
    trim: true, // Remove whitespace from both ends
    minlength: [3, 'Title must be at least 3 characters long.'],
    maxlength: [100, 'Title cannot exceed 100 characters.'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters.'],
    default: '', // Default to an empty string if not provided
  },
  mediaUrl: {
    type: String,
    // required: true, // Removed: no longer required
    unique: true, // Ensure each media URL is unique (still good for data integrity)
    trim: true,
  },
  mediaType: {
    type: String,
    // required: true, // Removed: no longer required
    enum: ['image', 'video', 'raw'], // Define allowed media types (e.g., 'image', 'video', 'raw' for other files)
    default: 'image', // Default to image if not specified
  },
  cloudinaryPublicId: {
    type: String,
    // required: true, // Removed: no longer required
    unique: true, // Ensure each Cloudinary public ID is unique (still good for data integrity)
    trim: true,
  },
  // Optional: You can add more fields like tags, categories, uploader_id, etc.
  tags: [{
    type: String,
    trim: true,
  }],
  category: {
    type: String,
    trim: true,
    default: 'Uncategorized',
  },
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps automatically
});

// Create and export the Gallery model
export const Gallery = mongoose.model('Gallery', gallerySchema);