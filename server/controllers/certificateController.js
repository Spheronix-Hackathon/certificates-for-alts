const Certificate = require('../models/Certificate');
const ActivityLog = require('../models/ActivityLog');
const { createCertificate } = require('../services/certificate.service');

// @desc    Create new certificate
// @route   POST /api/certificates
// @access  Private (Admin/HR)
const addCertificate = async (req, res, next) => {
  try {
    const certificate = await createCertificate(req.body, req.user._id);
    res.status(201).json({ success: true, data: certificate });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all certificates (with pagination & search)
// @route   GET /api/certificates
// @access  Private
const getCertificates = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = { isDeleted: false };
    
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { certificateId: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const certificates = await Certificate.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Certificate.countDocuments(query);

    res.json({
      success: true,
      data: certificates,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single certificate by DB ID
// @route   GET /api/certificates/:id
// @access  Private
const getCertificateById = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate || certificate.isDeleted) {
      res.status(404);
      throw new Error('Certificate not found');
    }
    res.json({ success: true, data: certificate });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke certificate
// @route   POST /api/certificates/:id/revoke
// @access  Private (Admin/HR)
const revokeCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate || certificate.isDeleted) {
      res.status(404);
      throw new Error('Certificate not found');
    }

    certificate.status = 'Revoked';
    await certificate.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'Revoked Certificate',
      details: `Revoked ID: ${certificate.certificateId}`
    });

    res.json({ success: true, data: certificate });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft delete certificate
// @route   DELETE /api/certificates/:id
// @access  Private (Admin/HR)
const deleteCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      res.status(404);
      throw new Error('Certificate not found');
    }

    certificate.isDeleted = true;
    certificate.deletedAt = new Date();
    certificate.deletedBy = req.user._id;
    await certificate.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'Deleted Certificate',
      details: `Deleted ID: ${certificate.certificateId}`
    });

    res.json({ success: true, message: 'Certificate deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete certificates permanently
// @route   DELETE /api/certificates/bulk
// @access  Private (Admin/HR)
const bulkDeleteCertificates = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No certificate IDs provided' });
    }

    const result = await Certificate.deleteMany({ _id: { $in: ids } });

    await ActivityLog.create({
      user: req.user._id,
      action: 'Bulk Deleted Certificates',
      details: `Permanently deleted ${result.deletedCount} certificates.`
    });

    res.json({ success: true, message: `Successfully deleted ${result.deletedCount} certificates` });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addCertificate,
  getCertificates,
  getCertificateById,
  revokeCertificate,
  deleteCertificate,
  bulkDeleteCertificates
};
