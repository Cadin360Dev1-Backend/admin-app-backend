// src/routes/template.route.js
import express from 'express';
import {
  getAllTemplates,
  addTemplate,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  sendEmailFromTemplate
} from '../controllers/template.controller.js';
import upload from '../config/multerConfig.js'; // Import Multer upload middleware

const router = express.Router();

// GET all templates
router.get('/', getAllTemplates);

// GET a single template by ID
router.get('/:id', getTemplateById);

// POST a new template
router.post('/', addTemplate);

// PUT (update) an existing template by ID
router.put('/:id', updateTemplate);

// DELETE a template by ID
router.delete('/:id', deleteTemplate);


// NEW ROUTE: Send an email using a template with optional attachments
// This route will use Multer to process 'attachments' field (up to 10 files)
router.post('/send-email', upload.array('attachments', 10), sendEmailFromTemplate);

export default router;
