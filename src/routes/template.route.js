// src/routes/template.route.js
import express from 'express';
import {
  getAllTemplates,
  addTemplate,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from '../controllers/template.controller.js';

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

export default router;
