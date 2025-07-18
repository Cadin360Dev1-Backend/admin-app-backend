import express from 'express';
import { requestOtp, verifyOtp, logoutAdmin, getMe } from '../controllers/auth.controller.js';
import jwt from 'jsonwebtoken'; // Used for token verification in middleware

const router = express.Router();

/**
 * Middleware to authenticate requests using a JWT token from cookies.
 * - Checks for 'admin_token' cookie.
 * - Verifies the token using the JWT_SECRET.
 * - Attaches decoded admin information to `req.admin` for downstream handlers.
 * - If token is missing, invalid, or expired, returns a 401 Unauthorized response.
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies.admin_token; // Get the token from the cookie

  // If no token is found, the user is not authenticated
  if (!token) {
    return res.status(401).json({
      statusCode: 401,
      success: false,
      errors: [{ message: "Authentication required. Please log in." }],
      message: "Authentication required. Please log in."
    });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // Attach the decoded payload (e.g., adminId, email) to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    // If token verification fails (e.g., invalid signature, expired token)
    console.error("JWT verification failed:", err.message);
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