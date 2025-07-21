// src/routes/gallery.route.js
import express from 'express';
import {
  uploadMedia,
  getAllMedia,
  getMediaById,
  updateMedia,
  deleteMedia,
} from '../controllers/gallery.controller.js';
import upload from '../config/multerConfig.js'; // Import Multer upload middleware

const router = express.Router();

// POST route to upload a single media file to Cloudinary and save details to DB
// 'media' is the field name expected in the multipart/form-data request
router.post('/upload', upload.single('media'), uploadMedia);

// GET route to fetch all media items from the gallery
router.get('/', getAllMedia);

// GET route to fetch a single media item by its ID
router.get('/:id', getMediaById);

// PUT route to update an existing media item by its ID
// This route can also handle a new 'media' file if the media itself is being replaced
router.put('/:id', upload.single('media'), updateMedia);

// DELETE route to delete a media item by its ID from both DB and Cloudinary
router.delete('/:id', deleteMedia);

export default router;
