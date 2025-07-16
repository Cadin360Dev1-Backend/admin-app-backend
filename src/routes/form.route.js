import express from 'express';
import {
        fetchAllSubmissions,
        fetchBundleSubmissions,
        fetchSampleSubmissions,
        submitForm,
        submitSamplePdfForm
    }from '../controllers/form.controller.js';
    
const router = express.Router();

// Define the route for submitting original form data (Bundle Form)
router.post('/submit', submitForm);

// Define the new route for submitting sample PDF download form data
router.post('/submit-sample-pdf', submitSamplePdfForm);

// Define the route for fetching all bundle form submissions
router.get('/fetch-bundle-submissions', fetchBundleSubmissions);

// Define the route for fetching all sample PDF form submissions
router.get('/fetch-sample-submissions', fetchSampleSubmissions);

// Define the route for fetching all form submissions (both types)
router.get('/fetch-all-submissions', fetchAllSubmissions);

export default router;


