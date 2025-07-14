import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
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
 * Sends a One-Time Password (OTP) email to a specified recipient.
 * @param {string} toEmail - The email address of the recipient.
 * @param {string} otp - The 6-digit OTP to be sent.
 * @param {string} [requestingEmail] - Optional: The email address that originally requested the OTP.
 * @returns {Promise<void>} A promise that resolves if the email is sent successfully,
 * or rejects with an error if sending fails.
 */
export const sendOtpEmail = async (toEmail, otp, requestingEmail = toEmail) => {
  // Determine the introductory message based on whether the requesting email is different from the recipient
  const introMessage = (requestingEmail && requestingEmail !== toEmail)
    ? `<p style="text-align: center; color: #555;">This OTP request is from <strong>${requestingEmail}</strong>.</p>`
    : `<p style="text-align: center; color: #555;">Hello,</p>`;

  // Define the mail options, including sender, recipient, subject, and HTML content
  const mailOptions = {
    from: process.env.EMAIL_FROM, // Display name and email in outgoing messages (e.g., "Admin App <your-email@gmail.com>")
    to: toEmail,                  // Recipient's email address
    subject: `Your One-Time Password (OTP) for Admin App - Request from ${requestingEmail}`, // Email subject
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; color: #333; line-height: 1.6; background-color: #f4f7f6; padding: 20px;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e0e0e0;">
          
          <div style="padding: 30px; border-bottom: 1px solid #eee; background-color: #fdfdfd;">
            <h1 style="font-size: 24px; color: #2a64ad; margin-top: 0; margin-bottom: 15px; text-align: center;">One-Time Password (OTP)</h1>
            ${introMessage}
            <p style="text-align: center; color: #555;">Your OTP is:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; background-color: #e6f0fa; color: #2a64ad; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #cce0f0;">
                ${otp}
              </span>
            </div>
            
            <p style="text-align: center; font-size: 14px; color: #666;">This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
          </div>
          
          <div style="padding: 25px 30px; background-color: #f8f8f8; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eee;">
            <p style="margin-top: 0; margin-bottom: 5px;">If you did not request this OTP, please ignore this email or contact support.</p>
            <p style="margin: 0;">Regards,<br>Your Admin App Team</p>
            <p style="margin-top: 15px; font-size: 11px; color: #999;">This is an automated message from the Admin App Backend.</p> <!-- New line added here -->
          </div>
        </div>
      </div>
    `,
  };

  try {
    // Send the email using the configured transporter
    await transporter.sendMail(mailOptions);
    console.log(`📨 OTP email successfully sent to ${toEmail}`);
  } catch (err) {
    // Log the error and re-throw it to be caught by the calling function (e.g., auth.controller.js)
    console.error(`❌ Failed to send OTP to ${toEmail}:`, err);
    throw new Error('Email sending failed. Please check your mailer configuration and network connection.');
  }
};
