// src/config/multerConfig.js
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define the destination folder for uploads
    // Ensure this folder exists in your project root or adjust path
    cb(null, path.join(__dirname, '../../uploads')); // Adjust path as needed, e.g., '/path/to/your/project/uploads'
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent conflicts
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

// Initialize upload middleware
// Max file size 20MB (20 * 1024 * 1024 bytes)
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
  fileFilter: (req, file, cb) => {
    // Allowed ext
    const filetypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z|mp3|mp4|mov|avi|wav|ogg/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Invalid file type! Allowed types: Images, Documents (PDF, Word, Excel, PPT), Archives (Zip, RAR, 7z), Audio, Video.');
    }
  },
});

export default upload;