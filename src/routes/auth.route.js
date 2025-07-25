import express from 'express';
import { requestOtp, verifyOtp, logoutAdmin, getMe } from '../controllers/auth.controller.js';
import jwt from 'jsonwebtoken'; // Used for token verification in middleware
import { Admin } from '../models/Admin.model.js'; // Import the Admin model

const router = express.Router();

/**
 * Middleware to authenticate requests using a JWT token from cookies.
 * - Checks for 'admin_token' cookie.
 * - Verifies the token using the JWT_SECRET.
 * - Attaches decoded admin information to `req.admin` for downstream handlers.
 * - If token is missing, invalid, or expired, returns a 401 Unauthorized response.
 */
const authMiddleware = async (req, res, next) => { // Make middleware async
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({
      statusCode: 401,
      success: false,
      errors: [{ message: "Authentication required. Please log in." }],
      message: "Authentication required. Please log in."
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Retrieve the admin from the database to check the session token
    const admin = await Admin.findById(decoded.adminId);

    if (!admin || admin.sessionToken !== decoded.sessionToken) {
      // If admin not found or session token does not match, it means a newer login occurred
      // or the token is from an old session. Clear the cookie.
      res.clearCookie('admin_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
      });
      return res.status(401).json({
        statusCode: 401,
        success: false,
        errors: [{ message: "Your session is no longer active. Please log in again." }],
        message: "Your session is no longer active. Please log in again."
      });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.clearCookie('admin_token', { // Clear cookie on any JWT verification failure
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
    });
    return res.status(401).json({
      statusCode: 401,
      success: false,
      errors: [{ message: "Invalid or expired session. Please log in again." }],
      message: "Invalid or expired session. Please log in again."
    });
  }
};

// Define authentication routes:

// POST /api/auth/request-otp: Initiates the OTP login process
router.post('/request-otp', requestOtp);

// POST /api/auth/verify-otp: Verifies the provided OTP
router.post('/verify-otp', verifyOtp);

// POST /api/auth/logout: Logs out the admin by clearing the session cookie
router.post('/logout', logoutAdmin);

// GET /api/auth/dashboard: A protected route that requires authentication
// The authMiddleware will run first to ensure the user is logged in
router.get('/dashboard', authMiddleware, (req, res) => {
  // If the middleware passes, req.admin will contain the authenticated user's details
  res.json({ success: true, message: `Welcome back, ${req.admin.email}! You have access to the dashboard.` });
});

// GET /api/auth/me: Retrieves details of the logged-in user
router.get('/me', authMiddleware, getMe);

export default router;