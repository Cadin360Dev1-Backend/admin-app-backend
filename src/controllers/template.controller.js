// src/controllers/template.controller.js
import { Template } from '../models/Template.model.js';

/**
 * Controller function to fetch all email templates.
 * GET /api/templates
 */
export const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find({}); // Fetch all templates
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Templates fetched successfully!",
      data: templates,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while fetching templates." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to fetch a single email template by its ID.
 * GET /api/templates/:id
 */
export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params; // Get template ID from URL parameters

    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Template not found." }],
        message: "Not Found."
      });
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Template fetched successfully!",
      data: template,
    });
  } catch (error) {
    console.error(`Error fetching template with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') { // Mongoose CastError for invalid ID format
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid Template ID format." }],
        message: "Invalid ID."
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while fetching the template." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to add a new email template.
 * POST /api/templates
 * Expected body: { templateName, subject, htmlContent, type (optional), description (optional) }
 */
export const addTemplate = async (req, res) => {
  try {
    const { templateName, subject, htmlContent, type, description } = req.body;

    // Basic validation
    if (!templateName || !subject || !htmlContent) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Missing mandatory fields: templateName, subject, and htmlContent are required." }],
        message: "Validation error."
      });
    }

    // Check if a template with the same name already exists
    const existingTemplate = await Template.findOne({ templateName });
    if (existingTemplate) {
      return res.status(409).json({ // 409 Conflict
        statusCode: 409,
        success: false,
        errors: [{ message: `Template with name '${templateName}' already exists.` }],
        message: "Duplicate template name."
      });
    }

    const newTemplate = new Template({
      templateName,
      subject,
      htmlContent,
      type,
      description,
    });

    const savedTemplate = await newTemplate.save();

    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Template added successfully!",
      data: savedTemplate,
    });
  } catch (error) {
    console.error("Error adding template:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while adding the template." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to update an existing email template.
 * PUT /api/templates/:id
 * Expected body: { templateName (optional), subject (optional), htmlContent (optional), type (optional), description (optional) }
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params; // Get template ID from URL parameters
    const updates = req.body; // Get update fields from request body

    // Check if any update fields are provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "No update fields provided." }],
        message: "No data to update."
      });
    }

    // Prevent updating _id or createdAt/updatedAt directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.__v;

    // If templateName is being updated, check for uniqueness
    if (updates.templateName) {
      const existingTemplate = await Template.findOne({ templateName: updates.templateName });
      if (existingTemplate && existingTemplate._id.toString() !== id) {
        return res.status(409).json({
          statusCode: 409,
          success: false,
          errors: [{ message: `Template with name '${updates.templateName}' already exists.` }],
          message: "Duplicate template name."
        });
      }
    }

    const updatedTemplate = await Template.findByIdAndUpdate(
      id,
      { $set: updates }, // Use $set to update only provided fields
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedTemplate) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Template not found." }],
        message: "Not Found."
      });
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Template updated successfully!",
      data: updatedTemplate,
    });
  } catch (error) {
    console.error(`Error updating template with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid Template ID format." }],
        message: "Invalid ID."
      });
    }
    if (error.code === 11000) { // Duplicate key error for unique fields
      return res.status(409).json({
        statusCode: 409,
        success: false,
        errors: [{ message: "A template with the provided name already exists." }],
        message: "Duplicate key error."
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while updating the template." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to delete an email template.
 * DELETE /api/templates/:id
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params; // Get template ID from URL parameters

    const deletedTemplate = await Template.findByIdAndDelete(id);

    if (!deletedTemplate) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Template not found." }],
        message: "Not Found."
      });
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Template deleted successfully!",
      data: deletedTemplate, // Optionally return the deleted document
    });
  } catch (error) {
    console.error(`Error deleting template with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid Template ID format." }],
        message: "Invalid ID."
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while deleting the template." }],
      message: "Internal server error."
    });
  }
};
