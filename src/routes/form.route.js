import express from 'express';
import { submitForm, submitSamplePdfForm } from '../controllers/form.controller.js';

const router = express.Router();

// Define the route for submitting original form data (Bundle Form)
router.post('/submit', submitForm);

// Define the new route for submitting sample PDF download form data
router.post('/submit-sample-pdf', submitSamplePdfForm);

export default router;