// src/controllers/gallery.controller.js
import { CLIENT_RENEG_LIMIT } from 'tls';
import cloudinary from '../config/cloudinaryConfig.js'; // Import the configured Cloudinary instance
import { Gallery } from '../models/Gallery.model.js';   // Import the Gallery Mongoose model
import fs from 'fs'; // Node.js file system module for deleting local files

/**
 * Controller function to upload media to Cloudinary and save its details to MongoDB.
 * POST /api/gallery/upload
 * Expected: multipart/form-data with a 'media' field (file).
 * Body can also include 'title', 'description', 'category', 'tags'.
 */
export const uploadMedia = async (req, res) => {
  try {
    // No longer checking if req.file is provided as a required field.
    // The upload will proceed even without a file, but Cloudinary will not be used.

    const { title, description, category } = req.body;
    // Tags can be a comma-separated string or an array; convert to array if string
    const tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map(tag => tag.trim())) : [];

    let mediaUrl = '';
    let mediaType = 'raw'; // Default to 'raw' if no file or unknown type
    let cloudinaryPublicId = '';

    // Only attempt Cloudinary upload if a file is provided
    if (req.file) {
      // Determine resource type for Cloudinary based on mimetype
      let resourceType = 'auto'; // Cloudinary will automatically detect
      if (req.file.mimetype.startsWith('image/')) {
        resourceType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        resourceType = 'video';
      } else {
        resourceType = 'raw'; // For other file types like documents
      }

      // Upload the file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: resourceType, // 'image', 'video', or 'raw'
        folder: 'gallery_uploads', // Optional: specify a folder in your Cloudinary account
        // You can add more options here, e.g., transformations, tags, etc.
        // tags: tags.join(',') // Cloudinary tags (comma-separated string)
      });

      // Delete the local file after successful upload to Cloudinary
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting local file:", err);
      });

      mediaUrl = result.secure_url;
      mediaType = result.resource_type;
      cloudinaryPublicId = result.public_id;
    }

    // Create a new gallery item document
    const newGalleryItem = new Gallery({
      title,
      description,
      mediaUrl, // URL of the uploaded media on Cloudinary (or empty if no file)
      mediaType, // Type detected by Cloudinary (image, video, raw) or default
      cloudinaryPublicId, // Public ID for future updates/deletions (or empty if no file)
      category,
      tags,
    });

    // Save the gallery item details to MongoDB
    const savedItem = await newGalleryItem.save();

    res.status(201).json({
      statusCode: 201,
      success: true,
      message: 'Media details saved successfully!',
      data: savedItem,
    });

    // console.log('Media uploaded and details saved:', savedItem);
  } catch (error) {
    console.error('Error uploading media:', error);

    // If a file was uploaded locally before an error occurred (e.g., Cloudinary upload fails)
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting local file during error handling:", err);
      });
    }

    // Handle Mongoose validation errors (e.g., for minlength/maxlength if still present)
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({ message: error.errors[key].message }));
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: errors,
        message: "Validation failed for one or more fields."
      });
    }
    // Handle Cloudinary upload errors
    if (error.http_code) { // Cloudinary errors often have an http_code
      return res.status(error.http_code).json({
        statusCode: error.http_code,
        success: false,
        message: `Cloudinary upload failed: ${error.message}`,
        errors: [{ message: error.message }]
      });
    }

    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error during media upload.',
      errors: [{ message: error.message || 'An unexpected error occurred.' }]
    });
  }
};

/**
 * Controller function to retrieve all gallery media items.
 * GET /api/gallery
 */
export const getAllMedia = async (req, res) => {
  try {
    const mediaItems = await Gallery.find({}); // Fetch all items from the Gallery collection

    if (!mediaItems || mediaItems.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'No media items found in the gallery.',
        data: [],
      });
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Media items fetched successfully!',
      mediaCount: mediaItems.length,
      data: mediaItems,
    });
  } catch (error) {
    console.error('Error fetching all media items:', error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error while fetching media items.',
      errors: [{ message: error.message || 'An unexpected error occurred.' }]
    });
  }
};

/**
 * Controller function to retrieve a single gallery media item by ID.
 * GET /api/gallery/:id
 */
export const getMediaById = async (req, res) => {
  try {
    const { id } = req.params; // Get media item ID from URL parameters

    const mediaItem = await Gallery.findById(id);

    if (!mediaItem) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Media item not found with the provided ID.',
      });
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Media item fetched successfully!',
      data: mediaItem,
    });
  } catch (error) {
    console.error(`Error fetching media item with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') { // Mongoose CastError for invalid ID format
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid media item ID format.',
        errors: [{ message: 'Invalid ID.' }]
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error while fetching media item.',
      errors: [{ message: error.message || 'An unexpected error occurred.' }]
    });
  }
};

/**
 * Controller function to update an existing gallery media item.
 * PUT /api/gallery/:id
 * Expected: multipart/form-data (if updating media file) or application/json (for text fields only).
 * Body can include 'title', 'description', 'category', 'tags', and optionally a new 'media' file.
 */
export const updateMedia = async (req, res) => {
  try {
    const { id } = req.params; // Get media item ID from URL parameters
    const updates = req.body; // Get update fields from request body

    // Convert tags to array if provided as a comma-separated string
    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map(tag => tag.trim());
    }

    // Prevent updating _id or createdAt/updatedAt directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.__v;

    // Find the existing media item
    const existingMediaItem = await Gallery.findById(id);
    if (!existingMediaItem) {
      // If a new file was uploaded locally, delete it since the item doesn't exist
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting local file (item not found):", err);
        });
      }
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Media item not found with the provided ID.',
      });
    }

    let newMediaUrl = existingMediaItem.mediaUrl;
    let newMediaType = existingMediaItem.mediaType;
    let newCloudinaryPublicId = existingMediaItem.cloudinaryPublicId;

    // If a new file is provided, upload it to Cloudinary and delete the old one
    if (req.file) {
      // Determine resource type for new upload
      let resourceType = 'auto';
      if (req.file.mimetype.startsWith('image/')) {
        resourceType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        resourceType = 'video';
      } else {
        resourceType = 'raw';
      }

      // Upload the new file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: resourceType,
        folder: 'gallery_uploads', // Same folder as initial upload
      });

      // Delete the local file after successful new upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting new local file:", err);
      });

      // Delete the old media from Cloudinary if a public ID exists
      if (existingMediaItem.cloudinaryPublicId) {
        const destroyResult = await cloudinary.uploader.destroy(existingMediaItem.cloudinaryPublicId, {
          resource_type: existingMediaItem.mediaType // Specify resource type when destroying
        });
        console.log('Old Cloudinary media deleted:', destroyResult);
      }

      newMediaUrl = uploadResult.secure_url;
      newMediaType = uploadResult.resource_type;
      newCloudinaryPublicId = uploadResult.public_id;
    }

    // Prepare the update object
    const updateFields = {
      ...updates, // Include title, description, category, tags from req.body
      // Only update media-related fields if a new file was uploaded
      ...(req.file && { // Conditionally add these fields only if req.file exists
        mediaUrl: newMediaUrl,
        mediaType: newMediaType,
        cloudinaryPublicId: newCloudinaryPublicId,
      })
    };

    // Perform the update in MongoDB
    const updatedMediaItem = await Gallery.findByIdAndUpdate(
      id,
      { $set: updateFields }, // Use $set to update only provided fields
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Media item updated successfully!',
      data: updatedMediaItem,
    });

  } catch (error) {
    console.error(`Error updating media item with ID ${req.params.id}:`, error);

    // If a new file was uploaded locally before an error occurred (e.g., Cloudinary upload fails)
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting local file during update error handling:", err);
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid media item ID format.',
        errors: [{ message: 'Invalid ID.' }]
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({ message: error.errors[key].message }));
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: errors,
        message: "Validation failed for one or more fields."
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error while updating media item.',
      errors: [{ message: error.message || 'An unexpected error occurred.' }]
    });
  }
};

/**
 * Controller function to delete a gallery media item.
 * DELETE /api/gallery/:id
 */
export const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params; // Get media item ID from URL parameters

    // Find the media item in MongoDB to get its Cloudinary public ID
    const mediaItem = await Gallery.findById(id);

    if (!mediaItem) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Media item not found with the provided ID.',
      });
    }

    // Delete the media from Cloudinary if a public ID exists
    if (mediaItem.cloudinaryPublicId) {
      const destroyResult = await cloudinary.uploader.destroy(mediaItem.cloudinaryPublicId, {
        resource_type: mediaItem.mediaType // Specify resource type when destroying
      });
      console.log('Cloudinary deletion result:', destroyResult);

      // Check if Cloudinary deletion was successful or if the resource was not found (already deleted)
      if (destroyResult.result !== 'ok' && destroyResult.result !== 'not found') {
        console.error('Failed to delete media from Cloudinary:', destroyResult);
      }
    }

    // Delete the media item from MongoDB
    const deletedItem = await Gallery.findByIdAndDelete(id);

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Media item deleted successfully from gallery and Cloudinary (if applicable)!',
      data: deletedItem, // Optionally return the deleted document
    });
  } catch (error) {
    console.error(`Error deleting media item with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid media item ID format.',
        errors: [{ message: 'Invalid ID.' }]
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error while deleting media item.',
      errors: [{ message: error.message || 'An unexpected error occurred.' }]
    });
  }
};
