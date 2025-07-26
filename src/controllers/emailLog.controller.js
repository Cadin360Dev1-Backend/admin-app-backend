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

/**
 * Controller function to retry sending emails that previously failed.
 * This will fetch all email logs with overallStatus: "Failed" and attempt to resend them.
 * Each retry will generate a new EmailLog entry.
 * POST /api/email-logs/retry-failed
 */
export const retryFailedEmails = async (req, res) => {
  try {
    const failedEmailLogs = await EmailLog.find({ overallStatus: 'Failed' });

    if (failedEmailLogs.length === 0) {
      return res.status(200).json({
        statusCode: 200,
        success: true,
        message: "No failed emails found to retry.",
        retriedCount: 0,
        results: [],
      });
    }

    const retryResults = [];

    for (const log of failedEmailLogs) {
      // Extract necessary data from the failed log
      const toEmails = log.to.map(rec => rec.email);
      const ccEmails = log.cc.map(rec => rec.email);
      const bccEmails = log.bcc.map(rec => rec.email);
      const subject = log.subject;
      // Use htmlContent as the content for retry.
      const htmlContent = log.htmlContent;

      // Prepare attachments for Nodemailer. Prioritize secure_url (Cloudinary) over local path.
      const attachmentsForRetry = log.attachments.map(att => ({
        filename: att.filename,
        path: att.secure_url || att.path, // Nodemailer can use URLs directly for remote files
        contentType: att.contentType,
      }));

      try {
        // Attempt to resend the email. This will create a NEW EmailLog entry.
        const newEmailLogId = await sendEmail(
          toEmails,
          subject,
          htmlContent,
          attachmentsForRetry,
          ccEmails.length > 0 ? ccEmails : null,
          bccEmails.length > 0 ? bccEmails : null,
          log.relatedFormSubmissionId // Link to original form submission if any
        );

        retryResults.push({
          originalLogId: log._id,
          status: 'success',
          newLogId: newEmailLogId,
          message: `Email retried successfully. New log ID: ${newEmailLogId}`,
        });
      } catch (retryError) {
        console.error(`Error retrying email log ${log._id}:`, retryError);
        retryResults.push({
          originalLogId: log._id,
          status: 'failed',
          newLogId: null,
          message: `Failed to retry email: ${retryError.message}`,
        });
      }
    }

    const successfulRetries = retryResults.filter(r => r.status === 'success').length;
    const failedRetries = retryResults.filter(r => r.status === 'failed').length;

    let responseMessage = `Attempted to retry ${failedEmailLogs.length} failed emails. `;
    if (successfulRetries > 0) {
      responseMessage += `${successfulRetries} succeeded. `;
    }
    if (failedRetries > 0) {
      responseMessage += `${failedRetries} failed.`;
    }

    res.status(200).json({
      statusCode: 200,
      success: failedRetries === 0, // Overall success if no retries failed
      message: responseMessage,
      retriedCount: successfulRetries,
      results: retryResults,
    });

  } catch (error) {
    console.error("Unhandled error during retryFailedEmails:", error);
    res.status(500).json({
      statusCode: 500,
      success: false,
      errors: [{ message: "An unexpected internal server error occurred while retrying failed emails." }],
      message: "Internal server error."
    });
  }
};
