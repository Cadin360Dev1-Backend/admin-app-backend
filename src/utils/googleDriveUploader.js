import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_DRIVE_KEY_PATH, // make sure this path is correct
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const driveService = google.drive({ version: 'v3', auth });

export const uploadToDrive = async (filePath, filename, mimeType) => {
  try {
    const fileMetadata = {
      name: filename,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // your actual folder ID
    };

    const media = {
      mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await driveService.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    const fileId = response.data.id;

    // Make the file public
    await driveService.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

    return { fileId, viewUrl, downloadUrl };
  } catch (error) {
    console.error('Drive upload error:', error);
    throw error;
  }
};
