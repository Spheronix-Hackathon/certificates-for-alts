const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for memory storage (for Excel parsing)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const {
  addCertificate,
  getCertificates,
  getCertificateById,
  revokeCertificate,
  deleteCertificate,
  bulkDeleteCertificates
} = require('../controllers/certificateController');

const {
  downloadSampleExcel,
  validateBulkUpload,
  generateBulkCertificates
} = require('../controllers/bulkController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Bulk Routes (must be before /:id)
router.get('/bulk/sample', authorize('Super Admin', 'HR Admin'), downloadSampleExcel);
router.post('/bulk/upload', authorize('Super Admin', 'HR Admin'), upload.single('file'), validateBulkUpload);
router.post('/bulk/generate', authorize('Super Admin', 'HR Admin'), generateBulkCertificates);
router.delete('/bulk', authorize('Super Admin', 'HR Admin'), bulkDeleteCertificates);

router.route('/')
  .post(authorize('Super Admin', 'HR Admin'), addCertificate)
  .get(getCertificates);

router.route('/:id')
  .get(getCertificateById)
  .delete(authorize('Super Admin', 'HR Admin'), deleteCertificate);

router.post('/:id/revoke', authorize('Super Admin', 'HR Admin'), revokeCertificate);

module.exports = router;
