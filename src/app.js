import express from 'express';
import cors from 'cors'; // Import CORS middleware for cross-origin requests
import cookieParser from 'cookie-parser'; // Import cookie-parser middleware to parse cookies
import authRoutes from './routes/auth.route.js'; // Import authentication routes
import formRoutes from './routes/form.route.js'; // Import form submission routes

const app = express();

// Middleware setup:



// CAUTION: Using '*' with credentials: true is NOT allowed by CORS specification
// Browsers will block requests that include cookies if Access-Control-Allow-Origin is '*'
app.use(cors({
  origin: '*', // This allows requests from any origin
  // credentials: true // This attempts to allow sending/receiving cookies, but will be ignored by browsers if origin is '*'
}));


// // Define allowed origins from environment variables.
// // It can be a single URL or a comma-separated list of URLs.
// const allowedOrigins = process.env.FRONTEND_ORIGIN ?
//   process.env.FRONTEND_ORIGIN.split(',').map(url => url.trim()) :
//   [];

// app.use(cors({
//   origin: (origin, callback) => {
//     // Allow requests with no origin (like same-origin requests, mobile apps, or curl requests)
//     // Also allow if the origin is in our list of allowed origins
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       // If the origin is not allowed, return an error
//       callback(new Error(`CORS policy for this site does not allow access from the specified Origin: ${origin}`), false);
//     }
//   },
//   credentials: true // IMPORTANT: This allows cookies to be sent and received cross-origin
// }));

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
