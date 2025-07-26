// src/utils/mailer.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { EmailLog } from '../models/EmailLog.model.js'; // Import the EmailLog model

dotenv.config(); // Load environment variables from .env file

// Create a Nodemailer transporter using SMTP details from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,         // e.g., smtp.gmail.com
  port: process.env.EMAIL_PORT,         // e.g., 587 (for TLS)
  secure: false,                         // `true` for 465 (SSL), `false` for other ports (TLS)
  auth: {
    user: process.env.EMAIL_USERNAME,   // Sender's email address (e.g., your Gmail)
    pass: process.env.EMAIL_PASSWORD,   // App-specific password or token for the sender email
  },
});

/**
 * Helper to normalize recipient emails into an array of objects,
 * initializing their status as 'Pending'.
 * @param {string|string[]} emails - Single email string or array of emails.
 * @returns {Array<{email: string, status: string, error: string|null}>}
 */
const normalizeRecipients = (emails) => {
  if (!emails) return [];
  // If emails is a string, split by comma and trim each part
  if (typeof emails === 'string') {
    emails = emails.split(',').map(e => e.trim()).filter(e => e); // Filter out empty strings
  }
  // Ensure it's an array and map to the recipientSchema format
  return Array.isArray(emails) ? emails.map(email => ({ email, status: 'Pending', error: null })) : [];
};

/**
 * Sends a generic email to a specified recipient(s) and logs its status.
 *
 * @param {string|string[]} toEmail - The email address(es) of the primary recipient(s).
 * @param {string} subject - The subject line of the email.
 * @param {string} htmlContent - The HTML content of the email.
 * @param {Array<Object>} [attachments=[]] - Array of attachment objects for Nodemailer (e.g., { filename, path, contentType, secure_url, public_id }).
 * @param {string|string[]} [ccEmail] - Optional: CC recipient(s).
 * @param {string|string[]} [bccEmail] - Optional: BCC recipient(s).
 * @param {mongoose.Types.ObjectId} [relatedFormSubmissionId] - Optional: ID of the related form submission.
 * @returns {Promise<string>} A promise that resolves with the _id of the saved EmailLog document.
 */
export const sendEmail = async (toEmail, subject, htmlContent, attachments = [], ccEmail = null, bccEmail = null, relatedFormSubmissionId = null) => {
  let emailLogEntry = null; // To hold the Mongoose document for the EmailLog

  try {
    const senderEmail = process.env.EMAIL_USERNAME;

    // Prepare initial recipient arrays for logging with 'Pending' status
    const toRecipients = normalizeRecipients(toEmail);
    const ccRecipients = normalizeRecipients(ccEmail);
    const bccRecipients = normalizeRecipients(bccEmail);

    // Create an initial EmailLog entry with 'Pending' status
    emailLogEntry = new EmailLog({
      sender: senderEmail,
      to: toRecipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject: subject,
      htmlContent: htmlContent, // Store the full HTML content
      attachments: attachments.map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        // Handle both local paths (from form uploads) and secure URLs (from templates via Cloudinary)
        path: att.path || null,
        secure_url: att.secure_url || null,
        public_id: att.public_id || null,
        size: att.size || null,
      })),
      overallStatus: 'Pending',
      relatedFormSubmissionId: relatedFormSubmissionId,
    });

    await emailLogEntry.save(); // Save the initial pending status to the database
    console.log(`Email log entry created with ID: ${emailLogEntry._id} (Status: Pending)`);

    const mailOptions = {
      from: senderEmail,
      to: toEmail,
      subject: subject,
      html: htmlContent,
      attachments: attachments,
      cc: ccEmail,
      bcc: bccEmail,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);

    // Update the EmailLog entry with success status and messageId
    emailLogEntry.messageId = info.messageId;
    emailLogEntry.overallStatus = 'Success';

    // Nodemailer's `info.accepted` and `info.rejected` provide details.
    // Update individual recipient statuses based on Nodemailer's response.
    // Convert info.accepted and info.rejected to lowercase for robust comparison
    const acceptedEmails = (info.accepted || []).map(e => e.toLowerCase());
    const rejectedEmails = (info.rejected || []).map(e => e.toLowerCase());

    const updateRecipientStatus = (recipientsArray) => {
      recipientsArray.forEach(r => {
        const lowerCaseEmail = r.email.toLowerCase();
        if (acceptedEmails.includes(lowerCaseEmail)) {
          r.status = 'Success';
          r.error = null;
        } else if (rejectedEmails.includes(lowerCaseEmail)) {
          r.status = 'Failed';
          r.error = `Rejected by SMTP server.`; // Placeholder error
        } else {
          // If not explicitly accepted or rejected, assume success for simplicity if overall send was successful
          r.status = 'Success';
          r.error = null;
        }
      });
    };

    updateRecipientStatus(emailLogEntry.to);
    updateRecipientStatus(emailLogEntry.cc);
    updateRecipientStatus(emailLogEntry.bcc);

    await emailLogEntry.save(); // Save updated status
    return emailLogEntry._id; // Return the ID of the log entry

  } catch (error) {
    console.error(`Error sending email or updating log (Initial Log ID: ${emailLogEntry ? emailLogEntry._id : 'N/A'}):`, error);

    // If an EmailLog entry was successfully created, update its status to "Failed"
    if (emailLogEntry) {
      emailLogEntry.overallStatus = 'Failed';
      emailLogEntry.errorLog = error.message; // Store the error message

      // Set all pending recipients as 'Failed' if the overall send failed
      const markAsFailed = (recipientsArray) => {
        recipientsArray.forEach(r => {
          if (r.status === 'Pending') {
            r.status = 'Failed';
            r.error = error.message;
          }
        });
      };
      markAsFailed(emailLogEntry.to);
      markAsFailed(emailLogEntry.cc);
      markAsFailed(emailLogEntry.bcc);

      await emailLogEntry.save(); // Save updated error status
      return emailLogEntry._id; // Still return the ID even on failure, so calling function knows which log failed
    } else {
      // If no log entry could be created (e.g., DB connection issue before save),
      // we just re-throw the error.
      throw new Error(`Failed to send email and log it: ${error.message}`);
    }
  }
};

/**
 * Sends a One-Time Password (OTP) email to a specified recipient.
 * This function now utilizes the generic `sendEmail` utility and will therefore be logged.
 * @param {string} toEmail - The email address of the recipient.
 * @param {string} otp - The 6-digit OTP to be sent.
 * @param {string} [requestingEmail] - Optional: The email address that originally requested the OTP.
 * @returns {Promise<string>} A promise that resolves with the _id of the saved EmailLog document.
 */
export const sendOtpEmail = async (toEmail, otp, requestingEmail = toEmail) => {
  const introMessage = (requestingEmail && requestingEmail !== toEmail)
    ? `An OTP was requested for ${requestingEmail}.`
    : 'You have requested a One-Time Password.';

  const subject = 'Your One-Time Password (OTP)';
  const htmlContent = `
       <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; color: #333; line-height: 1.6; background-color: #f4f7f6; padding: 20px;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e0e0e0;">
          <div style="padding: 30px; border-bottom: 1px solid #eee; background-color: #fdfdfd;">
            <h1 style="font-size: 24px; color: #2a64ad; margin-top: 0; margin-bottom: 15px; text-align: center;">One-Time Password (OTP)</h1>
            <p style="text-align: center; color: #555;">${introMessage}</p>
            <p style="text-align: center; color: #555;">Please use the following One-Time Password (OTP) to complete your action:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; background-color: #e6f2ff; color: #2a64ad; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #cce0f0;">
                ${otp}
              </span>
            </div>
            
            <p style="text-align: center; font-size: 14px; color: #666;">This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
          </div>
          
          <div style="padding: 25px 30px; background-color: #f8f8f8; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eee;">
            <p style="margin-top: 0; margin-bottom: 5px;">If you did not request this OTP, please ignore this email or contact support.</p>
            <p style="margin: 0;">Regards,<br>Your Admin App Team</p>
            <p style="margin-top: 15px; font-size: 11px; color: #999;">This is an automated message from the Admin App Backend.</p>
          </div>
        </div>
      </div>
    `;

  // Call the generic sendEmail function to log OTP emails
  return await sendEmail(toEmail, subject, htmlContent);
};