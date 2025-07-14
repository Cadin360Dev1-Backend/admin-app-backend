// src/server.js
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { connectToDatabase } from './db/dbConnect.js'; // Import the database connection function
import app from './app.js'; // Import the Express application instance

/**
 * Asynchronously starts the server.
 * - Connects to the MongoDB database.
 * - Starts the Express application on the configured port.
 */
const startServer = async () => {
  try {
    // Attempt to connect to the database
    await connectToDatabase();
    console.log('✅ Database connected successfully!');

    // Get the port from environment variables, default to 5000 if not set
    const PORT = process.env.PORT || 5000;

    // Start the Express server and listen for incoming requests
    app.listen(PORT, () => {
      console.log(`🚀 Server listening at http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    // Log any errors that occur during database connection or server startup
    console.error('❌ Failed to start server:', error.message);
    // Exit the process if the database connection fails, as the app won't function without it
    process.exit(1);
  }
};

// Call the function to start the server
startServer();