import { Form } from '../models/FormData.model.js';
import { getGeolocation } from '../utils/geolocation.js';
import { sendEmail } from '../utils/mailer.js'; // Import the generic sendEmail function

// Controller function to handle Bundle form submission
export const submitForm = async (req, res) => {
  try {
    // Extract form data from the request body
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
    } = req.body;

    // Extract geo_ip from the request
    // IMPORTANT: When using 'x-forwarded-for', it can be a comma-separated list.
    // We should take the first IP in the list, which is typically the client's IP.
    let geo_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (geo_ip && geo_ip.includes(',')) {
      geo_ip = geo_ip.split(',')[0].trim();
    }

    // Basic validation for mandatory fields (for the original bundle form)
    if (!form_type || !page_Name || !page_url || !name || !email || !user_type ) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: `Missing one or more mandatory form fields (${!form_type ? 'form_type' : ''}, ${!page_Name ? 'page_Name' : ''}, ${!page_url ? 'page_url' : ''}, ${!name ? 'name' : ''}, ${!email ? 'email' : ''}, ${!user_type ? 'user_type' : ''}).` }],
        message: "Missing one or more mandatory form fields."
      });
    }

    // Email format validation using regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid email format. Please enter a valid email address." }],
        message: "Invalid email format."
      });
    }

    // Name validation - allows letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[A-Za-z\s'-]{2,50}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid name. Only letters, spaces, hyphens, and apostrophes are allowed (2-50 characters)." }],
        message: "Invalid name."
      });
    }

    // Fetch geolocation details using the extracted IP
    let geolocationData = {};
    if (geo_ip) {
      const geoResult = await getGeolocation(geo_ip);
      if (geoResult) {
        geolocationData = geoResult;
      }
    }

    // Create a new form document instance
    const newFormSubmission = new Form({
      form_type,
      bundle_form,
      page_Name,
      page_url,
      geo_ip,
      ...geolocationData,
      name,
      email,
      user_type,
      college_name,
      reason,
      website_url,
    });

    // Save to DB
    const savedForm = await newFormSubmission.save();

    // --- Send Thank You Email ---
    const subject = `Thank You for Your Interest in ${form_type === 'bundle_form' ? 'Our Bundle Offer' : 'Our Products'}!`;
    const htmlContent = `
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
    try {
      await sendEmail(email, subject, htmlContent);
    } catch (emailError) {
      console.error("Failed to send thank you email:", emailError);
      // You might choose to still send a success response to the user
      // but log the email sending failure for internal monitoring.
    }
    // --- End Send Thank You Email ---

    // Success response
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Form details saved successfully! A thank-you email has been sent.",
      data: savedForm,
    });

  } catch (error) {
    console.error("Error saving form details:", error);
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

// Controller function to handle sample PDF download form submission
export const submitSamplePdfForm = async (req, res) => {
  try {
    const {
      name,
      email,
      page_Name,
      page_url,
      website_url,
    } = req.body;

    const form_type = 'sample_pdf_download_form';

    // Extract geo_ip from the request
    // IMPORTANT: When using 'x-forwarded-for', it can be a comma-separated list.
    // We should take the first IP in the list, which is typically the client's IP.
    let geo_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (geo_ip && geo_ip.includes(',')) {
      geo_ip = geo_ip.split(',')[0].trim();
    }

    // Basic validation for mandatory fields for sample_pdf_download_form
    if (!name || !email || !page_Name || !page_url) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Missing one or more mandatory form fields (name, email, page_Name, page_url)." }],
        message: "Missing one or more mandatory form fields."
      });
    }

    // Email format validation using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid email format. Please enter a valid email address." }],
        message: "Invalid email format."
      });
    }

    // Name validation - allows letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[A-Za-z\s'-]{2,50}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid name. Only letters, spaces, hyphens, and apostrophes are allowed (2-50 characters)." }],
        message: "Invalid name."
      });
    }

    // Fetch geolocation details using the extracted IP
    let geolocationData = {};
    if (geo_ip) {
      const geoResult = await getGeolocation(geo_ip);
      if (geoResult) {
        geolocationData = geoResult;
      }
    }

    // Create a new form document instance
    const newFormSubmission = new Form({
      form_type,
      page_Name,
      page_url,
      geo_ip,
      ...geolocationData,
      name,
      email,
      website_url,
      // bundle_form, user_type, college_name, reason are not required for this form_type, so they are omitted
    });

    // Save to DB
    const savedForm = await newFormSubmission.save();

    // --- Send Thank You Email for PDF ---
    const pdfSubject = `Thank You for Downloading the Sample PDF from ${page_Name}!`;
    const pdfHtmlContent = `
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
    try {
      await sendEmail(email, pdfSubject, pdfHtmlContent);
    } catch (emailError) {
      console.error("Failed to send sample PDF thank you email:", emailError);
    }
    // --- End Send Thank You Email for PDF ---

    // Success response
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Sample PDF form details saved successfully! A thank-you email has been sent. PDF download can now be triggered.",
      data: savedForm,
      // You can add a specific flag or URL for PDF download here for the frontend
      // e.g., pdf_download_url: '/download/sample-pdf'
    });

  } catch (error) {
    console.error("Error saving sample PDF form details:", error);
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

// Controller function to fetch all bundle form submissions
export const fetchBundleSubmissions = async (req, res) => {
  try {
    // Fetch all forms where form_type is 'bundle_form'
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
    // Fetch all forms where form_type is 'sample_pdf_download_form'
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
    // Fetch all forms regardless of form_type
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