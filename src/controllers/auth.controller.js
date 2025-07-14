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

  // 2. Restrict access: Check if the requested email is in the allowed list
  if (!ALLOWED_ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({
      statusCode: 403,
      success: false,
      errors: [{ message: "Access denied. This email is not authorized to log in." }],
      message: "Access denied. This email is not authorized to log in."
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

  let admin;
  try {
    // Attempt to find an existing admin by email
    admin = await Admin.findOne({ email });

    if (!admin) {
      // If admin does not exist, create a new Admin document
      admin = new Admin({ email, otp, otpExpiresAt: expiresAt });
    } else {
      // If admin exists, update their OTP and expiry time
      admin.otp = otp;
      admin.otpExpiresAt = expiresAt;
    }

    // Save the admin document (new or updated) to the database
    await admin.save();
    console.log(`✅ Admin data for ${email} saved/updated in DB.`);

  } catch (dbError) {
    // Log and return an error if saving to the database fails
    console.error(`❌ Error saving admin data for ${email} to DB:`, dbError);
    return res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Failed to save admin data to database. Please try again." }],
      message: "Failed to save admin data to database. Please try again."
    });
  }

  // 3. Determine the actual recipient(s) for the OTP email and send
  let recipients = [];
  let messageToUser = '';

  if (email === 'support.cadin360@gmail.com') {
    recipients.push(MAIN_ADMIN_EMAIL, SECONDARY_ADMIN_EMAIL);
    messageToUser = `OTP for ${email} has been sent to ${MAIN_ADMIN_EMAIL} and ${SECONDARY_ADMIN_EMAIL}. Please check their inboxes for verification.`;
  } else {
    recipients.push(email);
    messageToUser = `OTP sent to ${email}. Please check your inbox for verification.`;
  }

  for (const recipient of recipients) {
    try {
      // Pass the original requesting email to sendOtpEmail for message customization
      await sendOtpEmail(recipient, otp, email);
      console.log(`📨 OTP for ${email} successfully sent to ${recipient}.`);
    } catch (emailError) {
      console.error(`❌ Failed to send OTP email to ${recipient} for ${email}:`, emailError);
      return res.status(500).json({
        statusCode: 500,
        success: false,
        errors: [{ message: "Failed to send OTP email. Please check your email configuration." }],
        message: "Failed to send OTP email. Please check your email configuration."
      });
    }
  }

  // 4. Set a temporary cookie to store the email for OTP verification
  res.cookie('admin_email', email, {
    httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    maxAge: 5 * 60 * 1000, // Cookie expires in 5 minutes (matches OTP expiry)
  });

  res.status(200).json({ success: true, message: messageToUser });
};

/**
 * Handles the verification of an OTP.
 * - Retrieves OTP from body and email from cookie.
 * - Validates presence of both.
 * - Finds the admin in the database.
 * - Checks if OTP matches and if it's expired.
 * - Clears OTP from database and updates last login.
 * - Generates and sets a JWT token cookie for authenticated access.
 */
export const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  let email = req.cookies.admin_email; // Get the email from the temporary cookie

  // FIX: Decode the email if it's URL-encoded (e.g., cadin360%40gmail.com -> cadin360@gmail.com)
  if (email) {
    email = decodeURIComponent(email);
    console.log(`Decoded email from cookie: ${email}`); // For debugging
  }

  // 1. Validate required fields
  if (!email || !otp) {
    return res.status(400).json({
      statusCode: 400,
      success: false,
      errors: [{ message: "OTP and email cookie are required for verification." }],
      message: "OTP and email cookie are required for verification."
    });
  }

  let admin;
  try {
    // 2. Find the admin document by email (now with the decoded email)
    admin = await Admin.findOne({ email });
  } catch (dbError) {
    console.error(`❌ Error finding admin data for ${email} during OTP verification:`, dbError);
    return res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Database error during verification. Please try again." }],
      message: "Database error during verification. Please try again."
    });
  }

  // 3. Validate admin existence and OTP match
  if (!admin || admin.otp !== otp) {
    return res.status(401).json({
      statusCode: 401,
      success: false,
      errors: [{ message: "Invalid OTP or email. Please try again." }],
      message: "Invalid OTP or email. Please try again."
    });
  }

  // 4. Check if the OTP has expired
  if (admin.otpExpiresAt < new Date()) {
    return res.status(410).json({
      statusCode: 410,
      success: false,
      errors: [{ message: "OTP has expired. Please request a new one." }],
      message: "OTP has expired. Please request a new one."
    });
  }

  // 5. Clear OTP and update last login time in the database
  admin.otp = null; // Invalidate the used OTP
  admin.otpExpiresAt = null; // Clear OTP expiry
  admin.lastLogin = new Date(); // Record last successful login

  try {
    await admin.save();
    console.log(`✅ Admin ${email} OTP cleared and last login updated in DB.`);
  } catch (dbError) {
    console.error(`❌ Error updating admin data for ${email} after OTP verification:`, dbError);
    // Even if save fails here, the user is technically verified, but log the error.
    // For now, we'll return a 500 as per request, indicating a problem during the final save.
    return res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "Failed to update admin data after OTP verification." }],
      message: "Failed to update admin data after OTP verification."
    });
  }

  // 6. Generate a JSON Web Token (JWT) for authenticated sessions
  const token = jwt.sign(
    { adminId: admin._id, email: admin.email }, // Payload: admin ID and email
    process.env.JWT_SECRET, // Secret key from environment variables
    { expiresIn: '1d' } // Token expires in 1 day
  );

  // 7. Clear the temporary email cookie (no longer needed after verification)
  res.clearCookie('admin_email');

  // 8. Set the authentication token cookie
  res.cookie('admin_token', token, {
    httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    maxAge: 24 * 60 * 60 * 1000, // Cookie expires in 1 day (matches JWT expiry)
  });

  res.status(200).json({ success: true, message: "Welcome Admin! You have been successfully logged in." });
};

/**
 * Handles admin logout by clearing the authentication token cookie.
 */
export const logoutAdmin = (req, res) => {
  res.clearCookie('admin_token'); // Clear the JWT token cookie
  res.json({ success: true, message: "Logged out successfully" });
};

/**
 * Retrieves details of the currently logged-in admin user.
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
      errors: [{ message: "Failed to retrieve user details." }],
      message: "Internal server error while fetching user details."
    });
  }
};
