// src/controllers/template.controller.js
import { Template } from '../models/Template.model.js';
import { sendEmail } from '../utils/mailer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from '../config/cloudinaryConfig.js'; // Import cloudinary
import fs from 'fs'; // Import fs for file system operations

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Controller function to fetch all email templates.
 * GET /api/templates
 */
export const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find({});
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Templates fetched successfully!",
      templateCount: templates.length,
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
    const { id } = req.params;

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
      errors: [{ message: "An unexpected internal server error occurred while fetching the template." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to add a new email template.
 * POST /api/templates
 * Expected body: { templateName, subject, htmlContent, type (optional), description (optional), attachments (optional, these are file uploads) }
 */
export const addTemplate = async (req, res) => {
  try {
    const { templateName, subject, htmlContent, type, description } = req.body;
    const uploadedFiles = req.files && req.files.attachments ? req.files.attachments : [];

    const missingFields = [];
    if (!templateName) missingFields.push("templateName");
    if (!subject) missingFields.push("subject");
    if (!htmlContent) missingFields.push("htmlContent");

    if (missingFields.length > 0) {
      // Delete locally uploaded files if validation fails
      uploadedFiles.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting local file after validation failure:", err);
        });
      });
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{
          message: `Missing mandatory field(s): ${missingFields.join(", ")}`
        }],
        message: "Validation error."
      });
    }

    const existingTemplate = await Template.findOne({ templateName });
    if (existingTemplate) {
      // Delete locally uploaded files if template name already exists
      uploadedFiles.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting local file after duplicate template name:", err);
        });
      });
      return res.status(409).json({
        statusCode: 409,
        success: false,
        errors: [{ message: `Template with name '${templateName}' already exists.` }],
        message: "Duplicate template name."
      });
    }

    // Process and upload attachments to Cloudinary
    const attachmentsMetadata = [];
    for (const file of uploadedFiles) {
      try {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: 'email_attachments', // Specify a folder in Cloudinary
          resource_type: 'auto', // Automatically detect resource type
        });
        attachmentsMetadata.push({
          filename: file.originalname,
          size: file.size,
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          contentType: file.mimetype,
        }); 
        // Delete the local file after successful Cloudinary upload
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting local file after Cloudinary upload:", err);
        });
      } catch (uploadError) {
        console.error(`Error uploading file ${file.originalname} to Cloudinary:`, uploadError);
        // Delete local file even if Cloudinary upload fails
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting local file after Cloudinary upload failure:", err);
        });
        // Re-throw or handle as appropriate for your application
        return res.status(500).json({
          statusCode: 500,
          success: false,
          errors: [{ message: `Failed to upload attachment ${file.originalname}: ${uploadError.message}` }],
          message: "Attachment upload error."
        });
      }
    }

    const newTemplate = new Template({
      templateName,
      subject,
      htmlContent,
      type,
      description,
      attachments: attachmentsMetadata,
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
    // If an error occurs before files are processed/deleted, ensure cleanup
    if (req.files && req.files.attachments) {
      req.files.attachments.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting local file during error handling in addTemplate:", err);
        });
      });
    }
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
 * Expected body: { 
 * templateName (optional), 
 * subject (optional), 
 * htmlContent (optional), 
 * type (optional), 
 * description (optional),
 * existingAttachmentPublicIds (optional, array of public_ids to KEEP)
 * }
 * Files are sent via multipart/form-data under the 'attachments' field.
 */
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const uploadedFiles = req.files; // Multer's `upload.array` puts files directly into `req.files`

    // `existingAttachmentPublicIds` will be a comma-separated string if sent via FormData
    let existingAttachmentPublicIds = [];
    if (updates.existingAttachmentPublicIds) {
      try {
        // Try parsing as JSON array if sent as stringified JSON
        existingAttachmentPublicIds = JSON.parse(updates.existingAttachmentPublicIds);
      } catch (e) {
        // If not JSON, assume comma-separated string
        existingAttachmentPublicIds = updates.existingAttachmentPublicIds.split(',').map(id => id.trim()).filter(id => id);
      }
    }
    
    // Ensure existingAttachmentPublicIds is an array
    if (!Array.isArray(existingAttachmentPublicIds)) {
        existingAttachmentPublicIds = [];
    }


    if (Object.keys(updates).length === 0 && (!uploadedFiles || uploadedFiles.length === 0) && existingAttachmentPublicIds.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "No update fields, new files, or existing attachment public IDs provided." }],
        message: "No data to update."
      });
    }

    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.__v;

    // Find the existing template to get its current attachments
    const existingTemplate = await Template.findById(id);
    if (!existingTemplate) {
      // If a new file was uploaded locally, delete it since the item doesn't exist
      if (uploadedFiles && uploadedFiles.length > 0) {
        uploadedFiles.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file (template not found):", err);
          });
        });
      }
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Template not found." }],
        message: "Not Found."
      });
    }

    // Handle templateName uniqueness check during update
    if (updates.templateName && updates.templateName !== existingTemplate.templateName) {
      const nameConflictTemplate = await Template.findOne({ templateName: updates.templateName });
      if (nameConflictTemplate && nameConflictTemplate._id.toString() !== id) {
        // Delete local files if name conflict
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedFiles.forEach(file => {
            fs.unlink(file.path, (err) => {
              if (err) console.error("Error deleting local file due to name conflict:", err);
            });
          });
        }
        return res.status(409).json({
          statusCode: 409,
          success: false,
          errors: [{ message: `Template with name '${updates.templateName}' already exists.` }],
          message: "Duplicate template name."
        });
      }
    }

    let currentAttachments = existingTemplate.attachments || [];
    let attachmentsToKeep = [];
    let attachmentsToDeleteFromCloudinary = [];

    // Separate attachments to keep and attachments to delete
    currentAttachments.forEach(attachment => {
      if (attachment.public_id && existingAttachmentPublicIds.includes(attachment.public_id)) {
        attachmentsToKeep.push(attachment);
      } else if (attachment.public_id) {
        attachmentsToDeleteFromCloudinary.push(attachment.public_id);
      }
    });

    // Delete old attachments from Cloudinary that are no longer requested to be kept
    for (const publicId of attachmentsToDeleteFromCloudinary) {
      try {
        const destroyResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        console.log(`Deleted old Cloudinary attachment: ${publicId}. Result:`, destroyResult);
        if (destroyResult.result !== 'ok' && destroyResult.result !== 'not found') {
            console.error('Failed to delete attachment from Cloudinary:', destroyResult);
        }
      } catch (destroyError) {
        console.error(`Error deleting old Cloudinary attachment ${publicId}:`, destroyError);
        // Continue even if old attachment deletion fails to avoid blocking the update
      }
    }

    // Upload new attachments to Cloudinary
    const newUploadedAttachmentsMetadata = [];
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        try {
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: 'email_attachments',
            resource_type: 'auto',
          });
          newUploadedAttachmentsMetadata.push({
            filename: file.originalname,
            secure_url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            contentType: file.mimetype,
            size: file.size,
          });
          // Delete local file after successful Cloudinary upload
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after new Cloudinary upload:", err);
          });
        } catch (uploadError) {
          console.error(`Error uploading new file ${file.originalname} to Cloudinary during update:`, uploadError);
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after new Cloudinary upload failure:", err);
          });
          return res.status(500).json({
            statusCode: 500,
            success: false,
            errors: [{ message: `Failed to upload new attachment ${file.originalname}: ${uploadError.message}` }],
            message: "Attachment upload error during update."
          });
        }
      }
    }

    // Combine attachments to keep and newly uploaded attachments
    const finalAttachments = [...attachmentsToKeep, ...newUploadedAttachmentsMetadata];

    // Prepare the update object
    const updateFields = {
      ...updates,
      attachments: finalAttachments, // Update with the final list of attachments
    };

    const updatedTemplate = await Template.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
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
    // If an error occurs, ensure locally uploaded files are deleted
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting local file during update error handling:", err);
        });
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid Template ID format." }],
        message: "Invalid ID."
      });
    }
    if (error.code === 11000) {
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
    const { id } = req.params;

    const deletedTemplate = await Template.findByIdAndDelete(id);

    if (!deletedTemplate) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Template not found." }],
        message: "Not Found."
      });
    }

    // Also delete attachments from Cloudinary if they exist
    if (deletedTemplate.attachments && deletedTemplate.attachments.length > 0) {
      for (const attachment of deletedTemplate.attachments) {
        if (attachment.public_id) {
          try {
            const destroyResult = await cloudinary.uploader.destroy(attachment.public_id, { resource_type: 'raw' });
            console.log(`Cloudinary deletion result for ${attachment.public_id}:`, destroyResult);
            if (destroyResult.result !== 'ok' && destroyResult.result !== 'not found') {
                console.error('Failed to delete attachment from Cloudinary:', destroyResult);
            }
          } catch (destroyError) {
            console.error(`Error deleting Cloudinary attachment ${attachment.public_id}:`, destroyError);
            // Log the error but don't prevent the template deletion from proceeding
          }
        }
      }
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Template deleted successfully!",
      data: deletedTemplate,
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

    if (!templateId || !toEmails || (Array.isArray(toEmails) && toEmails.length === 0)) {
      // Delete local files if validation fails
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after sendEmailFromTemplate validation failure:", err);
          });
        });
      }
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Template ID and recipient email(s) are required to send an email.',
      });
    }

    const template = await Template.findById(templateId);

    if (!template) {
      // Delete local files if template not found
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after template not found:", err);
          });
        });
      }
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Template not found with the provided ID.',
      });
    }

    let recipientsArray = toEmails;
    if (!Array.isArray(toEmails)) {
      if (typeof toEmails === 'string' && toEmails.includes(',')) {
        recipientsArray = toEmails.split(',').map(email => email.trim());
      } else {
        recipientsArray = [toEmails];
      }
    }

    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    const invalidEmailsInRequest = recipientsArray.filter(email => !emailRegex.test(email));
    if (invalidEmailsInRequest.length > 0) {
      // Delete local files if email format is invalid
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after invalid email format:", err);
          });
        });
      }
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: `Invalid email format detected for: ${invalidEmailsInRequest.join(', ')}. Please provide valid email addresses.` }],
        message: "Validation error: Invalid email format."
      });
    }

    const attachmentsForEmail = [];

    // Add attachments from the template
    if (template.attachments && template.attachments.length > 0) {
        template.attachments.forEach(attachment => {
            if (attachment.secure_url) {
                attachmentsForEmail.push({
                    filename: attachment.filename,
                    path: attachment.secure_url, // Use Cloudinary URL as path for Nodemailer
                    contentType: attachment.contentType
                });
            }
        });
    }

    // Add attachments from the current request (newly uploaded files for this specific email send)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: 'email_send_temp_attachments', // Use a temporary folder for send-specific attachments
            resource_type: 'auto',
          });
          attachmentsForEmail.push({
            filename: file.originalname,
            path: uploadResult.secure_url, // Use Cloudinary URL
            contentType: file.mimetype,
            // You might want to store public_id here if you plan to delete these temporary files later
            // public_id: uploadResult.public_id
          });
          // Delete the local file after successful Cloudinary upload
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after Cloudinary upload for send-email:", err);
          });
        } catch (uploadError) {
          console.error(`Error uploading temporary file ${file.originalname} to Cloudinary for email send:`, uploadError);
          // Delete local file even if Cloudinary upload fails
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file after temporary Cloudinary upload failure:", err);
          });
          return res.status(500).json({
            statusCode: 500,
            success: false,
            errors: [{ message: `Failed to upload attachment for email send: ${file.originalname} - ${uploadError.message}` }],
            message: "Email attachment upload error."
          });
        }
      }
    }

    const finalSubject = subject || template.subject;
    const finalHtmlContent = message || template.htmlContent;

    try {
      await sendEmail(recipientsArray, finalSubject, finalHtmlContent, attachmentsForEmail);

      const attachmentNames = attachmentsForEmail.map(attach => attach.filename).join(', ') || 'none';

      res.status(200).json({
        statusCode: 200,
        success: true,
        message: `Email sent successfully using template "${template.templateName}" to ${recipientsArray.join(', ')} ` +
                 `${attachmentsForEmail.length > 0 ? `with attachment(s): ${attachmentNames}` : 'without attachments'}.`,
        recipients: recipientsArray,
        subject: finalSubject,
        // Return simplified attachment info, including secure_url
        attachments: attachmentsForEmail.map(attach => ({ filename: attach.filename, secure_url: attach.path, contentType: attach.contentType }))
      });
    } catch (emailError) {
      console.error('Error sending template email:', emailError);
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to send email using template due to an internal error.',
        errors: [{ message: emailError.message }]
      });
    }

  } catch (error) {
    console.error('Unhandled error in sendEmailFromTemplate:', error);
    if (error.message && error.message.startsWith('Error:')) {
      // Ensure local files are cleaned up if Multer error occurred
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error("Error deleting local file during sendEmailFromTemplate error:", err);
          });
        });
      }
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: error.message }],
        message: "File upload error: " + error.message
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Internal server error.',
      errors: [{ message: error.message }]
    });
  }
};