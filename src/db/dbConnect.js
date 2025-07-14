import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export async function connectToDatabase() {
  const dbUrl = process.env.MONGO_URL || "mongodb://localhost:27017/admin-App";
  try {
    await mongoose.connect(dbUrl);
    console.log("✅ MongoDB connected successfully:", dbUrl);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1); // Exit process with failure
  }
}