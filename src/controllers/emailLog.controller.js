// src/controllers/emailLog.controller.js
import { EmailLog } from '../models/EmailLog.model.js';

/**
 * Controller function to fetch all email logs.
 * GET /api/email-logs
 */
export const getAllEmailLogs = async (req, res) => {
  try {
    const emailLogs = await EmailLog.find({}).sort({ sentAt: -1 }); // Sort by sentAt in descending order

    // Format the sentAt date for human readability for each log
    const formattedEmailLogs = emailLogs.map(log => ({
      ...log.toObject(), // Convert Mongoose document to plain JavaScript object
      sentAtFormatted: new Date(log.sentAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true, // Use 12-hour clock with AM/PM
      }),
    }));

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Email logs fetched successfully!",
      logCount: formattedEmailLogs.length,
      data: formattedEmailLogs,
    });
  } catch (error) {
    console.error("Error fetching all email logs:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while fetching email logs." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to fetch a single email log by its ID.
 * GET /api/email-logs/:id
 */
export const getEmailLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const emailLog = await EmailLog.findById(id);

    if (!emailLog) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Email log not found." }],
        message: "Not Found."
      });
    }

    // Format the sentAt date for human readability
    const formattedEmailLog = {
      ...emailLog.toObject(), // Convert Mongoose document to plain JavaScript object
      sentAtFormatted: new Date(emailLog.sentAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true, // Use 12-hour clock with AM/PM
      }),
    };

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Email log fetched successfully!",
      data: formattedEmailLog,
    });
  } catch (error) {
    console.error(`Error fetching email log with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid Email Log ID format." }],
        message: "Invalid ID."
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while fetching the email log." }],
      message: "Internal server error."
    });
  }
};

/**
 * Controller function to delete a specific email log by its ID.
 * DELETE /api/email-logs/:id
 */
export const deleteEmailLog = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedEmailLog = await EmailLog.findByIdAndDelete(id);

    if (!deletedEmailLog) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        errors: [{ message: "Email log not found." }],
        message: "Not Found."
      });
    }

    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Email log deleted successfully!",
      data: deletedEmailLog,
    });
  } catch (error) {
    console.error(`Error deleting email log with ID ${req.params.id}:`, error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        errors: [{ message: "Invalid Email Log ID format." }],
        message: "Invalid ID."
      });
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while deleting the email log." }],
      message: "Internal server error."
    });
  }
};
