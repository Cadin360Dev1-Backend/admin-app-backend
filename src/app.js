import express from 'express';
import cors from 'cors'; // Import CORS middleware for cross-origin requests
import cookieParser from 'cookie-parser'; // Import cookie-parser middleware to parse cookies
import authRoutes from './routes/auth.route.js'; // Import authentication routes
import formRoutes from './routes/form.route.js'; // Import form submission routes

const app = express();

// Middleware setup:

// Enable CORS for all origins (or specify allowed origins for production)
// `origin: true` allows any origin, `credentials: true` allows cookies to be sent
app.use(cors({ origin: true, credentials: true }));

// Parse cookies attached to the client request object
app.use(cookieParser());

// Parse incoming JSON requests with a payload limit of 50mb
app.use(express.json({ limit: '50mb' }));

// Route handlers:

// Mount authentication routes under the '/api/auth' path
app.use('/api/auth', authRoutes);

// Mount form submission routes under the '/api/form' path
app.use('/api/form', formRoutes);

// Define a simple root route to check if the backend is running
app.get('/', (req, res) => {
  res.send('🚀 Admin App Backend is running...');
});

export default app; // Export the configured Express app
