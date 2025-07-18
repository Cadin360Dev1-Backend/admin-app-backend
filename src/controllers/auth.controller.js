import { Admin } from '../models/Admin.model.js';
import { sendOtpEmail } from '../utils/mailer.js';
import jwt from 'jsonwebtoken';

// Define the allowed admin emails for login
const ALLOWED_ADMIN_EMAILS = [
  'cadin360@gmail.com',
  'SNJHA362@gmail.com',
  'support.cadin360@gmail.com'
];

// Define the main admin email for OTP forwarding (if 'support.cadin360@gmail.com' requests OTP)
const MAIN_ADMIN_EMAIL = 'cadin360@gmail.com';
const SECONDARY_ADMIN_EMAIL = 'SNJHA362@gmail.com'; // Secondary admin email for support OTPs

/**
 * Handles the request for an OTP.
 * - Validates the email.
 * - Restricts access to only pre-defined allowed emails.
 * - Generates an OTP and its expiry time.
 * - Saves/updates the admin's OTP in the database.
 * - Sends the OTP email, forwarding 'support.cadin360@gmail.com' OTP to MAIN_ADMIN_EMAIL and SECONDARY_ADMIN_EMAIL.
 * - Sets a temporary cookie for email verification.
 */
export const requestOtp = async (req, res) => {
  const { email } = req.body; // This is the email requesting the OTP

  // 1. Validate email presence
  if (!email) {
    return res.status(400).json({
      statusCode: 400,
      success: false,
      errors: [{ message: "Email is required." }],
      message: "Email is required."
    });
  }

  // Normalize email to lowercase for consistency
  const normalizedEmail = email.toLowerCase();

  // 2. Restrict access to only pre-defined allowed emails
  if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
    return res.status(403).json({
      statusCode: 403,
      success: false,
      errors: [{ message: "Unauthorized email address." }],
      message: "Unauthorized email address."
    });
  }

  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Ensure OTP is a string
    // OTP expires in 5 minutes
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Find or create the admin user
    let admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin) {
      admin = new Admin({ email: normalizedEmail });
    }

    admin.otp = otp;
    admin.otpExpiresAt = otpExpiresAt;
    await admin.save();
    console.log(`✅ Admin data for ${normalizedEmail} saved/updated in DB.`);

    // Determine recipient emails based on the requested email
    let recipientsForEmail = [normalizedEmail];
    let messageToUser = `OTP sent to ${normalizedEmail}. Please check your inbox for verification.`;

    if (normalizedEmail === 'support.cadin360@gmail.com') {
      recipientsForEmail = [MAIN_ADMIN_EMAIL, SECONDARY_ADMIN_EMAIL];
      messageToUser = `OTP for ${normalizedEmail} has been sent to ${MAIN_ADMIN_EMAIL} and ${SECONDARY_ADMIN_EMAIL}. Please check their inboxes for verification.`;
    }

    // Send OTP via email
    for (const recipient of recipientsForEmail) {
      try {
        // Corrected call to sendOtpEmail: pass recipient, otp, and the original requesting email
        await sendOtpEmail(recipient, otp, normalizedEmail);
        console.log(`📨 OTP for ${normalizedEmail} successfully sent to ${recipient}.`);
      } catch (emailError) {
        console.error(`❌ Failed to send OTP email to ${recipient} for ${normalizedEmail}:`, emailError);
        return res.status(500).json({
          statusCode: 500,
          success: false,
          errors: [{ message: "Failed to send OTP email. Please check your email configuration." }],
          message: "Failed to send OTP email. Please check your email configuration."
        });
      }
    }

    // Set a temporary cookie with the email for verification in the next step
    res.cookie('admin_email', normalizedEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      maxAge: 5 * 60 * 1000, // Matches OTP expiry: 5 minutes
      sameSite: 'Lax', // Adjust as per your frontend deployment
    });

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: messageToUser,
    });

  } catch (error) {
    console.error("Error requesting OTP:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Internal server error during OTP request." }],
      message: "Internal server error during OTP request."
    });
  }
};

/**
 * Handles the verification of the OTP.
 * - Retrieves the email from the temporary cookie.
 * - Validates the provided OTP.
 * - Checks OTP expiry.
 * - If successful, generates a JWT, sets it as an HttpOnly cookie, and clears the temporary email cookie.
 * - Updates the lastLogin timestamp.
 */
export const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  let adminEmailFromCookie = req.cookies.admin_email; // Get email from the temporary cookie

  // FIX: Decode the email if it's URL-encoded (e.g., cadin360%40gmail.com -> cadin360@gmail.com)
  if (adminEmailFromCookie) {
    adminEmailFromCookie = decodeURIComponent(adminEmailFromCookie);
    console.log(`Decoded email from cookie: ${adminEmailFromCookie}`); // For debugging
  }

  // 1. Validate OTP presence
  if (!otp) {
    return res.status(400).json({
      statusCode: 400,
      success: false,
      errors: [{ message: "OTP is required." }],
      message: "OTP is required."
    });
  }

  // 2. Validate email cookie presence
  if (!adminEmailFromCookie) {
    return res.status(401).json({
      statusCode: 401,
      success: false,
      errors: [{ message: "Email for verification not found. Please request OTP again." }],
      message: "Email for verification not found. Please request OTP again."
    });
  }

  try {
    // Find the admin by email
    const admin = await Admin.findOne({ email: adminEmailFromCookie });

    // 3. Check if admin exists
    if (!admin) {
      // Clear potentially invalid cookie
      res.clearCookie('admin_email');
      return res.status(401).json({
        statusCode: 401,
        success: false,
        errors: [{ message: "Invalid email for verification. Please request OTP again." }],
        message: "Invalid email for verification. Please request OTP again."
      });
    }

    // 4. Check if OTP exists and matches
    // Ensure both are strings for consistent comparison (OTP from DB and from request body)
    if (!admin.otp || String(admin.otp) !== String(otp)) {
      return res.status(401).json({
        statusCode: 401,
        success: false,
        errors: [{ message: "Invalid OTP. Please try again." }],
        message: "Invalid OTP. Please try again."
      });
    }

    // 5. Check if OTP has expired
    if (admin.otpExpiresAt < new Date()) {
      // Clear OTP fields in DB and cookie
      admin.otp = null;
      admin.otpExpiresAt = null;
      await admin.save();
      res.clearCookie('admin_email');

      return res.status(401).json({
        statusCode: 401,
        success: false,
        errors: [{ message: "OTP has expired. Please request a new OTP." }],
        message: "OTP has expired. Please request a new OTP."
      });
    }

    // If OTP is valid and not expired:
    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // Token valid for 1 day
    );

    // Update last login time
    admin.lastLogin = new Date();
    // Clear OTP from database after successful verification
    admin.otp = null;
    admin.otpExpiresAt = null;
    await admin.save();

    // Clear the temporary admin_email cookie
    res.clearCookie('admin_email', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    });

    // Set JWT token as an HttpOnly cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      sameSite: 'Lax', // Adjust as per your frontend deployment
    });

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "OTP verified successfully. Login successful.",
      data: {
        admin_token: token, // Optionally send token in response for immediate client use
        email: admin.email,
        id: admin._id
      }
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Internal server error during OTP verification." }],
      message: "Internal server error during OTP verification."
    });
  }
};

/**
 * Handles admin logout.
 * Clears the 'admin_token' cookie.
 */
export const logoutAdmin = (req, res) => {
  try {
    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      sameSite: 'Lax', // Adjust as per your frontend deployment
    });

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Logged out successfully."
    });
  } catch (error) {
    console.error("Error logging out admin:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Internal server error during logout." }],
      message: "Internal server error during logout."
    });
  }
};

/**
 * Fetches authenticated admin's details.
 * This route requires authentication via `authMiddleware`.
 * Returns essential user details and the admin_token for frontend authentication.
 */
export const getMe = async (req, res) => {
  try {
    // req.admin is populated by authMiddleware after decoding the JWT token
    const adminId = req.admin.adminId;

    // Fetch the full admin document from the database, excluding sensitive OTP fields
    const admin = await Admin.findById(adminId).select('-otp -otpExpiresAt');

    if (!admin) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Admin user not found." }],
        message: "Admin user not found."
      });
    }

    // Include the admin_token from the request cookies for frontend convenience
    const adminToken = req.cookies.admin_token;

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "User details retrieved successfully.",
      data: {
        id: admin._id,
        email: admin.email,
        lastLogin: admin.lastLogin,
        admin_token: adminToken // Include the token as requested
      }
    });

  } catch (error) {
    console.error("Error fetching user details for /me route:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Internal server error fetching user details." }],
      message: "Internal server error fetching user details."
    });
  }
};