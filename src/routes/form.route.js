// src/routes/form.route.js
import express from 'express';
import {
        fetchAllSubmissions,
        fetchBundleSubmissions,
        fetchSampleSubmissions,
        submitForm,
        submitSamplePdfForm,
        handleThankYouSubmission,
     }from '../controllers/form.controller.js';
import upload from '../config/multerConfig.js'; // Import Multer upload middleware

const router = express.Router();

// Define the route for submitting original form data (Bundle Form)
// Apply multer middleware to handle 'attachments' field as an array of files
router.post('/submit', upload.array('attachments', 10), submitForm);

// Define the new route for submitting sample PDF download form data
router.post('/submit-sample-pdf', upload.array('attachments', 10), submitSamplePdfForm);

// Define the new route for sending custom thank you messages
// NOW accepts multipart/form-data for direct attachment uploads
// Use upload.fields to specify both file and text fields.
// The 'emails' field will be a text field containing a JSON string or parsed object.
router.post('/thankyou', upload.fields([
  { name: 'attachments', maxCount: 10 }, // For file attachments
  { name: 'emails' } // For the 'emails' text field (which contains JSON data)
]), handleThankYouSubmission);

// Define the route for fetching all bundle form submissions
router.get('/fetch-bundle-submissions', fetchBundleSubmissions);

// Define the route for fetching all sample PDF form submissions
router.get('/fetch-sample-submissions', fetchSampleSubmissions);

// Define the route for fetching all form submissions (both types)
router.get('/fetch-all-submissions', fetchAllSubmissions);

export default router;
