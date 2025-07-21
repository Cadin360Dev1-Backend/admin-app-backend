// src/controllers/template.controller.js
import { Template } from '../models/Template.model.js';
import { sendEmail } from '../utils/mailer.js'; // Import the generic sendEmail function
import path from 'path'; // Import path module
import { fileURLToPath } from 'url'; // For __dirname equivalent in ES Modules

// Get __dirname equivalent for local file paths in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 Expected Form Fields:
 * - `emails`: A stringified JSON object containing the template's text data.
 * Example `emails` content:
 * `{
 * "templateName": "Your Template Name",
 * "subject": "Email Subject Line",
 * "htmlContent": "<html>...</html>",
 * "type": "thank_you",      // Optional
 * "description": "A brief description" // Optional
 * }`
 * - `attachments`: (Optional) One or more binary files. These are actual file uploads.
 * The `attachments` array within the `emails` JSON string is treated as metadata
 * or a placeholder, and the actual files are processed from the `attachments` form field.
 */
export const addTemplate = async (req, res) => {
  try {
    let templateData;
    // The 'emails' field will be a string in req.body
    if (req.body.emails) {
      try {
        templateData = JSON.parse(req.body.emails);
      } catch (parseError) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          errors: [{ message: "Invalid JSON format for 'emails' field." }],
          message: "Parsing error."
        });
      }
    } else {
      // If the 'emails' field itself is missing from the multipart form
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Missing mandatory 'emails' data field." }],
        message: "Validation error."
      });
    }

    // Now destructure from the parsed templateData object
    const { templateName, subject, htmlContent, type, description } = templateData;
    // Dynamic validation for missing fields
    const missingFields = [];
    if (!templateName) missingFields.push("templateName");
    if (!subject) missingFields.push("subject");
    if (!htmlContent) missingFields.push("htmlContent");

if (missingFields.length > 0) {
  return res.status(400).json({ 
    statusCode: 400,
    success: false,
    errors: [{
      message: `Missing mandatory field(s): ${missingFields.join(", ")}`
    }],
    message: "Validation error."
  });
}

    // Handle uploaded files (from req.files.attachments)
    const uploadedFiles = req.files && req.files.attachments ? req.files.attachments : [];

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

    // Process uploaded files to store their metadata (filename, path, etc.)
    const attachmentsMetadata = uploadedFiles.map(file => ({
      filename: file.originalname,
      path: file.path, // Multer stores the path of the uploaded file
      contentType: file.mimetype,
      size: file.size
    }));

    const newTemplate = new Template({
      templateName,
      subject,
      htmlContent,
      type,
      description,
      attachments: attachmentsMetadata, // Save attachments metadata
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
 * Expected body: { templateName (optional), subject (optional), htmlContent (optional), type (optional), description (optional), attachments (optional) }
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

    // Basic validation for attachments if provided in updates
    if (updates.attachments && !Array.isArray(updates.attachments)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Attachments must be an array if provided." }],
        message: "Validation error."
      });
    }
    if (updates.attachments) {
      for (const attachment of updates.attachments) {
        if (!attachment.filename || (!attachment.content && !attachment.path)) {
          return res.status(400).json({
            statusCode: 400,
            success: false,
            errors: [{ message: "Each attachment must have a 'filename' and either 'content' (base64) or 'path'." }],
            message: "Invalid attachment data."
          });
        }
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

/**
 * Controller function to send an email using a saved template.
 * This function now supports dynamic recipients and optional attachments.
 * It expects 'multipart/form-data' for file uploads.
 *
 * POST /api/templates/send-email
 *
 * Expected request body (sent via multipart/form-data from frontend):
 * {
 * "templateId": "ID_OF_SAVED_TEMPLATE",
 * "toEmails": "recipient1@example.com,recipient2@example.com", // Comma-separated string or array of emails
 * "subject": "Optional custom subject to override template subject",
 * "message": "Optional custom message body to override template HTML content"
 * // Files are sent under the form field name 'attachments' (type: file)
 * }
 */
export const sendEmailFromTemplate = async (req, res) => {
  try {
    console.log("sendEmailFromTemplate: Incoming request body:", req.body);
    console.log("sendEmailFromTemplate: Incoming files:", req.files); // `req.files` populated by Multer

    const { templateId, toEmails, subject, message } = req.body;

    // Basic validation for mandatory fields for sending an email
    if (!templateId || !toEmails || (Array.isArray(toEmails) && toEmails.length === 0)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Template ID and recipient email(s) are required to send an email.',
      });
    }

    // Fetch the template from the database
    const template = await Template.findById(templateId);

    if (!template) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Template not found with the provided ID.',
      });
    }

    // Ensure `toEmails` is an array for consistent processing
    let recipientsArray = toEmails;
    if (!Array.isArray(toEmails)) {
      // If `toEmails` comes as a single string (e.g., "email1@a.com,email2@b.com"), split it
      if (typeof toEmails === 'string' && toEmails.includes(',')) {
        recipientsArray = toEmails.split(',').map(email => email.trim());
      } else {
        recipientsArray = [toEmails]; // Convert single string email to an array
      }
    }

    // Validate email formats for all recipients
    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    const invalidEmailsInRequest = recipientsArray.filter(email => !emailRegex.test(email));
    if (invalidEmailsInRequest.length > 0) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: `Invalid email format detected for: ${invalidEmailsInRequest.join(', ')}. Please provide valid email addresses.` }],
        message: "Validation error: Invalid email format."
      });
    }

    // --- Process and prepare attachments for email ---
    const attachmentsForEmail = []; // This array will contain attachment objects for Nodemailer
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const relativePath = path.join('uploads', file.filename); // Assuming Multer saves to 'uploads'
        attachmentsForEmail.push({
          filename: file.originalname,
          path: path.join(process.cwd(), relativePath), // Absolute path for Nodemailer to find the file
          contentType: file.mimetype
        });
      });
    }
    // --- End attachment processing ---

    // Determine the final subject and HTML content for the email
    // Prioritize subject/message from request body, otherwise use template's
    const finalSubject = subject || template.subject;
    const finalHtmlContent = message || template.htmlContent;

    try {
      // Send the email using the mailer utility with recipients, subject, HTML, and attachments
      await sendEmail(recipientsArray, finalSubject, finalHtmlContent, attachmentsForEmail);

      // Prepare attachment names for the success message
      const attachmentNames = attachmentsForEmail.map(attach => attach.filename).join(', ') || 'none';

      res.status(200).json({
        statusCode: 200,
        success: true,
        message: `Email sent successfully using template "${template.templateName}" to ${recipientsArray.join(', ')} ` +
                 `${attachmentsForEmail.length > 0 ? `with attachment(s): ${attachmentNames}` : 'without attachments'}.`,
        recipients: recipientsArray,
        subject: finalSubject,
        attachments: attachmentsForEmail.map(attach => ({ filename: attach.filename, size: attach.size, contentType: attach.contentType })) // Return simplified attachment info
      });
    } catch (emailError) {
      console.error('Error sending template email:', emailError);
      // If email sending fails, you might want to consider deleting the locally saved files
      // to avoid orphaned files, especially in a production environment.
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to send email using template due to an internal error.',
        errors: [{ message: emailError.message }]
      });
    }

  } catch (error) {
    console.error('Unhandled error in sendEmailFromTemplate:', error);
    // Catch Multer errors (e.g., file size limit exceeded, invalid file type)
    if (error.message && error.message.startsWith('Error:')) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: error.message }],
        message: "File upload error: " + error.message // Provide more specific Multer error
      });
    }
    // Catch any other unexpected errors
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error.',
      errors: [{ message: error.message }]
    });
  }
};