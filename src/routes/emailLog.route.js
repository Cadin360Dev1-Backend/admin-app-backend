// src/routes/emailLog.route.js
import express from 'express';
import {
  getAllEmailLogs,
  getEmailLogById,
  deleteEmailLog,
  retryFailedEmails,

} from '../controllers/emailLog.controller.js';

const router = express.Router();

// GET all email logs
router.get('/', getAllEmailLogs);

// GET a single email log by ID
router.get('/:id', getEmailLogById);

// DELETE an email log by ID
router.delete('/:id', deleteEmailLog);

//Retry sending failed emails
router.post('/retry-failed-emails', retryFailedEmails);

export default router;
