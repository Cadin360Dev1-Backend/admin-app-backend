// src/controllers/form.controller.js
import { Form } from '../models/FormData.model.js';
import { getGeolocation } from '../utils/geolocation.js';
import { sendEmail } from '../utils/mailer.js'; // Import the generic sendEmail function
import path from 'path'; // Import path module
import { fileURLToPath } from 'url'; // For __dirname equivalent in ES Modules

// Get __dirname equivalent for local file paths in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Controller function to handle Bundle form submission
export const submitForm = async (req, res) => {
  try {
    // Log incoming request body and files for debugging purposes
    console.log("submitForm: Incoming request body:", req.body);
    console.log("submitForm: Incoming files:", req.files); // `req.files` is populated by Multer for array uploads

    // Destructure necessary fields from the request body.
    // Use an empty object as default if `req.body` is undefined/null to prevent errors.
    const {
      form_type,
      bundle_form,
      page_Name,
      page_url,
      name,
      email,
      user_type,
      college_name,
      reason,
      website_url,
      emailSubject,
      emailMessage,
      // `attachments` are handled separately from `req.files`, not `req.body`
    } = req.body || {};

    // Extract user's IP address. Prioritize 'x-forwarded-for' for proxy/load balancer environments.
    let geo_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    // If 'x-forwarded-for' contains multiple IPs, take the first one
    if (geo_ip && geo_ip.includes(',')) {
      geo_ip = geo_ip.split(',')[0].trim();
    }

    // --- Basic Server-Side Validation for Mandatory Fields ---
    if (!form_type || !page_Name || !page_url || !name || !email || !user_type ) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: `Missing one or more mandatory form fields. Please ensure all required fields are provided.` }],
        message: "Missing mandatory form fields."
      });
    }

    // Email format validation using a regular expression
    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid email format. Please enter a valid email address (e.g., example@domain.com)." }],
        message: "Invalid email format."
      });
    }

    // Name validation - allows letters, spaces, hyphens, and apostrophes, between 2-50 characters
    const nameRegex = /^[A-Za-z\s'-]{2,50}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid name. Only letters, spaces, hyphens, and apostrophes are allowed (2-50 characters)." }],
        message: "Invalid name."
      });
    }
    // --- End Basic Validation ---

    // --- Handle Attachments Uploaded via Multer ---
    const uploadedAttachments = [];
    // Check if files were uploaded (`req.files` is an array of file objects from Multer)
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        // Construct the relative path where the file is stored
        const relativePath = path.join('uploads', file.filename);
        uploadedAttachments.push({
          filename: file.originalname, // Original name of the file
          path: relativePath,           // Relative path to the locally saved file
          contentType: file.mimetype,   // MIME type of the file
          size: file.size               // Size of the file in bytes
        });
      });
    }
    // --- End Handle Attachments ---

    // --- Fetch Geolocation Data ---
    let geolocationData = {};
    if (geo_ip) {
      const geoResult = await getGeolocation(geo_ip);
      if (geoResult) {
        geolocationData = geoResult;
      }
    }
    // --- End Fetch Geolocation Data ---

    // Create a new form document instance for saving to MongoDB
    const newFormSubmission = new Form({
      form_type,
      bundle_form,
      page_Name,
      page_url,
      geo_ip,
      ...geolocationData, // Spread geolocation data into the document
      name,
      email,
      user_type,
      college_name,
      reason,
      website_url,
      emailSubject,
      emailMessage,
      attachments: uploadedAttachments, // Save attachment metadata (paths, names, types, sizes)
    });

    // Save the new form submission to the database
    const savedForm = await newFormSubmission.save();

    // --- Prepare and Send Thank You Email ---
    // Use custom subject if provided, otherwise a default
    const finalSubject = emailSubject || `Thank You for Your Interest in ${form_type === 'bundle_form' ? 'Our Bundle Offer' : 'Our Products'}!`;
    
    // Default HTML content for the thank-you email
    const defaultHtmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; color: #333; line-height: 1.6; background-color: #f4f7f6; padding: 20px;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e0e0e0;">
          <div style="padding: 30px; border-bottom: 1px solid #eee; background-color: #fdfdfd;">
            <h1 style="font-size: 24px; color: #2a64ad; margin-top: 0; margin-bottom: 15px; text-align: center;">Thank You for Your Interest, ${name}!</h1>
            <p style="text-align: center; color: #555;">We appreciate you showing interest in our ${page_Name}.</p>
            <p style="text-align: center; color: #555;">We've received your submission and will get back to you shortly if needed.</p>
            <p style="text-align: center; font-size: 14px; color: #666;">In the meantime, feel free to explore more on our website: <a href="${page_url}" style="color: #2a64ad; text-decoration: none;">${page_url}</a></p>
          </div>
          <div style="padding: 25px 30px; background-color: #f8f8f8; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eee;">
            <p style="margin-top: 0; margin-bottom: 5px;">This is an automated email, please do not reply.</p>
            <p style="margin: 0;">Regards,<br>The Admin App Team</p>
          </div>
        </div>
      </div>
    `;
    // Use custom HTML content if provided, otherwise the default
    const finalHtmlContent = emailMessage || defaultHtmlContent;

    try {
      // Map uploaded attachment metadata to Nodemailer-compatible attachment objects
      const attachmentsForEmail = uploadedAttachments.map(attach => ({
        filename: attach.filename,
        // Nodemailer needs an absolute path to access local files.
        // `process.cwd()` gives the current working directory (project root).
        path: path.join(process.cwd(), attach.path),
        contentType: attach.contentType
      }));
      
      // Send the email using the mailer utility
      await sendEmail(email, finalSubject, finalHtmlContent, attachmentsForEmail);
    } catch (emailError) {
      console.error("Failed to send thank you email with attachments:", emailError);
      // Log the error but don't prevent the successful form submission response,
      // as the form data was already saved. You might add a rollback here if needed.
    }
    // --- End Send Thank You Email ---

    // Respond to the client indicating success
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Form details and attachments saved successfully! A thank-you email has been sent.",
      data: savedForm,
    });

  } catch (error) {
    // --- Error Handling ---
    console.error("Error saving form details with attachments:", error);

    // Handle Multer-specific errors (e.g., file size limits, invalid file types)
    if (error.message && error.message.startsWith('Error:')) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: error.message }],
        message: "File upload error."
      });
    }
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({ message: error.errors[key].message }));
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: errors,
        message: "Validation failed for one or more fields."
      });
    }
    // Catch any other unexpected server errors
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred. Please try again later." }],
      message: "Internal server error."
    });
  }
};

// Controller function to handle sample PDF download form submission
export const submitSamplePdfForm = async (req, res) => {
  try {
    console.log("submitSamplePdfForm: Incoming request body:", req.body);
    console.log("submitSamplePdfForm: Incoming files:", req.files);

    const {
      name,
      email,
      page_Name,
      page_url,
      website_url,
      emailSubject,
      emailMessage,
    } = req.body || {};

    const form_type = 'sample_pdf_download_form'; // Fixed form type for this route

    let geo_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (geo_ip && geo_ip.includes(',')) {
      geo_ip = geo_ip.split(',')[0].trim();
    }

    // Validation for sample PDF form
    if (!name || !email || !page_Name || !page_url) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Missing one or more mandatory form fields (name, email, page name, page URL)." }],
        message: "Missing mandatory form fields."
      });
    }

    const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid email format. Please enter a valid email address." }],
        message: "Invalid email format."
      });
    }

    const nameRegex = /^[A-Za-z\s'-]{2,50}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid name. Only letters, spaces, hyphens, and apostrophes are allowed (2-50 characters)." }],
        message: "Invalid name."
      });
    }

    // Handle attachments (same logic as submitForm)
    const uploadedAttachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const relativePath = path.join('uploads', file.filename);
        uploadedAttachments.push({
          filename: file.originalname,
          path: relativePath,
          contentType: file.mimetype,
          size: file.size
        });
      });
    }

    let geolocationData = {};
    if (geo_ip) {
      const geoResult = await getGeolocation(geo_ip);
      if (geoResult) {
        geolocationData = geoResult;
      }
    }

    const newFormSubmission = new Form({
      form_type,
      page_Name,
      page_url,
      geo_ip,
      ...geolocationData,
      name,
      email,
      website_url,
      emailSubject,
      emailMessage,
      attachments: uploadedAttachments,
    });

    const savedForm = await newFormSubmission.save();

    // --- Prepare and Send Thank You Email for Sample PDF ---
    const finalPdfSubject = emailSubject || `Thank You for Downloading the Sample PDF from ${page_Name}!`;
    const defaultPdfHtmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; color: #333; line-height: 1.6; background-color: #f4f7f6; padding: 20px;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e0e0e0;">
          <div style="padding: 30px; border-bottom: 1px solid #eee; background-color: #fdfdfd;">
            <h1 style="font-size: 24px; color: #2a64ad; margin-top: 0; margin-bottom: 15px; text-align: center;">Thank You, ${name}!</h1>
            <p style="text-align: center; color: #555;">We hope you find the sample PDF useful.</p>
            <p style="text-align: center; color: #555;">You can download your PDF here (if applicable, or link to the download on your site):</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${website_url || page_url}" style="display: inline-block; background-color: #2a64ad; color: #ffffff; font-size: 18px; font-weight: bold; padding: 15px 30px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Download PDF</a>
            </div>
            <p style="text-align: center; font-size: 14px; color: #666;">If you have any questions, feel free to visit our website: <a href="${page_url}" style="color: #2a64ad; text-decoration: none;">${page_url}</a></p>
          </div>
          <div style="padding: 25px 30px; background-color: #f8f8f8; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eee;">
            <p style="margin-top: 0; margin-bottom: 5px;">This is an automated email, please do not reply.</p>
            <p style="margin: 0;">Regards,<br>The Admin App Team</p>
          </div>
        </div>
      </div>
    `;
    const finalPdfHtmlContent = emailMessage || defaultPdfHtmlContent;

    try {
      const attachmentsForEmail = uploadedAttachments.map(attach => ({
        filename: attach.filename,
        path: path.join(process.cwd(), attach.path),
        contentType: attach.contentType
      }));
      await sendEmail(email, finalPdfSubject, finalPdfHtmlContent, attachmentsForEmail);
    } catch (emailError) {
      console.error("Failed to send sample PDF thank you email with attachments:", emailError);
    }
    // --- End Send Thank You Email ---

    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Sample PDF form details and attachments saved successfully! A thank-you email has been sent.",
      data: savedForm,
    });

  } catch (error) {
    console.error("Error saving sample PDF form details with attachments:", error);
    if (error.message && error.message.startsWith('Error:')) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: error.message }],
        message: "File upload error."
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
      errors: [{ message: "An unexpected internal server error occurred." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to handle sending a custom Thank You message.
 * This function now accepts direct file uploads via Multer using 'multipart/form-data'.
 * It is designed to send a SINGLE email request (which can be to multiple 'to' recipients)
 * with the attachments uploaded in the same request.
 *
 * Expected request body (sent via multipart/form-data from frontend):
 * {
 * "toEmails": "recipient@example.com" or ["recipient1@example.com", "recipient2@example.com"],
 * "subject": "Custom Thank You from My App",
 * "message": "<p>Hello,</p><p>This is a <strong>custom</strong> thank you message!</p>",
 * // Files are sent under the form field name 'attachments' (type: file)
 * }
 */
export const handleThankYouSubmission = async (req, res) => {
  try {
    console.log("handleThankYouSubmission: Incoming request body:", req.body);
    console.log("handleThankYouSubmission: Incoming files:", req.files); // `req.files` populated by Multer

    // Destructure text fields from `req.body`
    const { toEmails, subject, message } = req.body || {};

    // Basic validation for mandatory email sending fields
    if (!toEmails || toEmails.length === 0 || !subject || !message) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Missing one or more mandatory fields: 'toEmails', 'subject', and 'message' are required." }],
        message: "Validation error: Missing mandatory fields."
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

    // Process attachments uploaded via Multer for this email
    const attachmentsForEmail = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const relativePath = path.join('uploads', file.filename);
        attachmentsForEmail.push({
          filename: file.originalname,
          // Crucial: Provide the absolute path for Nodemailer to find the file
          path: path.join(process.cwd(), relativePath), // `process.cwd()` is the project root
          contentType: file.mimetype,
          size: file.size // Attachments saved locally won't be saved to DB in this specific API call
        });
      });
    }

    try {
      // Send the email with the collected text content and uploaded attachments
      await sendEmail(recipientsArray, subject, message, attachmentsForEmail);
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: `Thank you email sent successfully to ${recipientsArray.length} recipient(s) with ${attachmentsForEmail.length} attachment(s)!`,
      });
    } catch (emailError) {
      console.error("Failed to send thank you email:", emailError);
      // If email sending fails, you might want to consider deleting the locally saved files
      // to avoid orphaned files, especially in a production environment.
      // Example: fs.unlinkSync(path.join(process.cwd(), relativePath)); for each uploaded file.
      res.status(500).json({
        statusCode: 500,
        success: false,
        errors: [{ message: "Failed to send email due to a server error. Please check server logs." }],
        message: "Email sending failed."
      });
    }

  } catch (error) {
    console.error("Unhandled error in handleThankYouSubmission:", error);
    // Catch Multer errors (e.g., file size limit exceeded, invalid file type)
    if (error.message && error.message.startsWith('Error:')) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: error.message }],
        message: "File upload error."
      });
    }
    // Catch any other unexpected errors
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred. Please try again later." }],
      message: "Internal server error."
    });
  }
};


// Controller function to fetch all bundle form submissions
export const fetchBundleSubmissions = async (req, res) => {
  try {
    const submissions = await Form.find({ form_type: 'bundle_form' });
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Bundle form submissions fetched successfully!",
      data: submissions,
    });
  } catch (error) {
    console.error("Error fetching bundle form submissions:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred." }],
      message: "Internal server error."
    });
  }
};

// Controller function to fetch all sample PDF form submissions
export const fetchSampleSubmissions = async (req, res) => {
  try {
    const sampleSubmissions = await Form.find({ form_type: 'sample_pdf_download_form' });
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Sample PDF form submissions fetched successfully!",
      data: sampleSubmissions,
    });
  } catch (error) {
    console.error("Error fetching sample PDF form submissions:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred." }],
      message: "Internal server error."
    });
  }
};

// Controller function to fetch all form submissions (both types)
export const fetchAllSubmissions = async (req, res) => {
  try {
    const allSubmissions = await Form.find({});
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "All form submissions fetched successfully!",
      data: allSubmissions,
    });
  } catch (error) {
    console.error("Error fetching all form submissions:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred." }],
      message: "Internal server error."
    });
  }
};