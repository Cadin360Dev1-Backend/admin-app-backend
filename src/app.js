import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.route.js';
import formRoutes from './routes/form.route.js';
import templateRoutes from './routes/template.route.js'; //Import template routes

const app = express();

// Detect environment (default to development)
const environment = process.env.NODE_ENV || 'development';
const corsOriginEnv = process.env.CORS_ORIGIN;

let corsOptions;

if (environment === 'development') {
  // In development, allow all origins (public access, no credentials)
  corsOptions = {
    origin: '*',
    credentials: false // Cookies won't work with '*', so this must be false
  };
} else if (corsOriginEnv) {
  // In production or staging, restrict to specified origins
  const allowedOrigins = corsOriginEnv.split(',').map(url => url.trim());

  corsOptions = {
    origin: (origin, callback) => {
      // Allow server-to-server or same-origin requests, AND null origin for specific scenarios
      // Also allow origins listed in CORS_ORIGIN
      if (!origin || allowedOrigins.includes(origin) || origin === 'null') {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy for this site does not allow access from the specified Origin: ${origin}`), false);
      }
    },
    credentials: true // Enable cookies for allowed domains
  };
} else {
  // No CORS allowed by default (strict)
  corsOptions = {
    origin: false,
    credentials: true
  };
}

// Use the configured CORS options
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/form', formRoutes);
app.use('/api/templates', templateRoutes); // Use template routes

// Root route for server status
app.get('/', (req, res) => {
  res.send('🚀 Admin App Backend is running...');
});

export default app;