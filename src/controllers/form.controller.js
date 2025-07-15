import { Form } from '../models/FormData.model.js';
import { getGeolocation } from '../utils/geolocation.js';

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
        errors: [{ message: "Missing one or more mandatory form fields (form_type, page_Name, page_url, name, email, user_type)." }],
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

    // Success response
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Form details saved successfully!",
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

    // Success response
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Sample PDF form details saved successfully! PDF download can now be triggered.",
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