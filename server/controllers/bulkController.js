const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const Certificate = require('../models/Certificate');
const ActivityLog = require('../models/ActivityLog');
const { generateCertificateId } = require('../utils/idGenerator');
const { generateQR } = require('../services/qr.service');
const { generatePDF } = require('../services/pdf.service');

// @desc    Download sample excel for bulk upload
// @route   GET /api/certificates/bulk/sample
// @access  Private (Super Admin, HR Admin)
const downloadSampleExcel = (req, res) => {
  try {
    const workbook = xlsx.utils.book_new();
    
    // Exact columns requested by user
    const headers = [
      'Student Name',
      'Regd No',
      'College Name',
      'Internship Type',
      'Program Name',
      'Start Date',
      'End Date',
      'Issue Date',
      'Email',
      'Phone'
    ];

    const sampleData = [
      headers,
      [
        'Ashashi Kiran',
        '23FHIA3220',
        'Dr. K.V. Subba Reddy Institute of Technology',
        'Short-term',
        'AI-Integrated Full Stack Development',
        '2026-05-04',
        '2026-07-04',
        '2026-07-05',
        'student@email.com',
        '9876543210'
      ]
    ];

    const worksheet = xlsx.utils.aoa_to_sheet(sampleData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Student Name
      { wch: 15 }, // Regd No
      { wch: 45 }, // College
      { wch: 15 }, // Internship
      { wch: 35 }, // Program
      { wch: 12 }, // Start
      { wch: 12 }, // End
      { wch: 12 }, // Issue
      { wch: 25 }, // Email
      { wch: 15 }  // Phone
    ];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Certificates');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Bulk_Certificate_Sample.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating sample excel:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Upload & Validate Excel (Preview)
// @route   POST /api/certificates/bulk/validate
// @access  Private (Super Admin, HR Admin)
const validateBulkUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Extract raw rows
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rawData.length === 0) {
      return res.status(400).json({ success: false, message: 'The uploaded file is empty' });
    }
    // Get all existing regdNos to check for duplicates efficiently
    const existingCertificates = await Certificate.find({ isDeleted: false }).select('regdNo').lean();
    const existingRegdNos = new Set(existingCertificates.map(c => c.regdNo.toLowerCase()));

    const validatedRows = rawData.map((row, index) => {
      // Normalize keys to ignore spaces, dashes, and case differences (e.g., 'Regd No' -> 'regdno', 'Join-date' -> 'joindate')
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        normalizedRow[cleanKey] = row[key];
      });

      const parseString = (val, defaultVal = '') => (val !== undefined && val !== null) ? String(val).trim() : defaultVal;

      const studentName = parseString(normalizedRow['studentname'] || normalizedRow['name'] || normalizedRow['student']);
      const regdNo = parseString(normalizedRow['regdno'] || normalizedRow['registrationno'] || normalizedRow['registrationnumber'] || normalizedRow['rollno'] || normalizedRow['id']);
      const college = parseString(normalizedRow['collegename'] || normalizedRow['college'] || normalizedRow['university'] || normalizedRow['institution'], '-');
      const internshipType = parseString(normalizedRow['internshiptype'] || normalizedRow['type'], 'Short-term');
      const programName = parseString(normalizedRow['programname'] || normalizedRow['domain'] || normalizedRow['program'] || normalizedRow['course']);
      const startDate = normalizedRow['startdate'] || normalizedRow['joindate'] || normalizedRow['fromdate'] || normalizedRow['start'];
      const endDate = normalizedRow['enddate'] || normalizedRow['todate'] || normalizedRow['end'];
      const issueDate = normalizedRow['issuedate'] || normalizedRow['issue'];
      const email = parseString(normalizedRow['email'] || normalizedRow['emailaddress'] || normalizedRow['emailid']);
      const phone = parseString(normalizedRow['phone'] || normalizedRow['phonenumber'] || normalizedRow['mobile'] || normalizedRow['contact']);

      // Check required fields
      let status = 'Ready';
      let error = '';

      if (!studentName) { status = 'Error'; error = 'Student Name Missing'; }
      else if (!regdNo) { status = 'Error'; error = 'Regd No Missing'; }
      else if (!programName) { status = 'Error'; error = 'Program Name/Domain Missing'; }
      else if (!startDate) { status = 'Error'; error = 'Start Date Missing'; }
      else if (!endDate) { status = 'Error'; error = 'End Date Missing'; }

      // Check Duplicates
      if (status === 'Ready' && regdNo && existingRegdNos.has(regdNo.toString().trim().toLowerCase())) {
        status = 'Duplicate';
        error = 'Regd No already exists in database';
      }

      // Add to our duplicate checker for the current batch (in case the excel has the same regdNo twice)
      if (status === 'Ready') {
        const batchRegdNo = regdNo.toString().trim().toLowerCase();
        existingRegdNos.add(batchRegdNo); 
      }

      return {
        rowNumber: index + 2, // Excel rows are 1-indexed, plus 1 for header
        studentName,
        regdNo,
        college,
        internshipType,
        programName,
        startDate,
        endDate,
        issueDate,
        email,
        phone,
        status,
        error
      };
    });

    res.status(200).json({
      success: true,
      data: validatedRows
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, message: 'Error processing file. Please ensure it is a valid Excel document.' });
  }
};

// Helper function to format dates correctly if Excel gives them as numbers (serial dates)
const parseExcelDate = (excelDate) => {
  if (!excelDate) return null;
  if (typeof excelDate === 'number') {
    // Excel date (days since Dec 30, 1899)
    return new Date((excelDate - (25567 + 2)) * 86400 * 1000); 
  }
  return new Date(excelDate);
};

// @desc    Generate Certificates (from validated payload)
// @route   POST /api/certificates/bulk/generate
// @access  Private (Super Admin, HR Admin)
const generateBulkCertificates = async (req, res) => {
  try {
    const { rows } = req.body;
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data provided to generate.' });
    }

    const validRows = rows.filter(r => r.status === 'Ready');
    
    if (validRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid rows to generate.' });
    }

    // 1. Create a batch directory for PDFs
    const batchId = `Batch-${Date.now()}`;
    const dateObj = new Date();
    const publicFolder = path.join(__dirname, '..', 'public');
    const batchFolder = path.join(publicFolder, 'bulk', dateObj.getFullYear().toString(), (dateObj.getMonth() + 1).toString(), batchId);
    
    if (!fs.existsSync(batchFolder)) {
      fs.mkdirSync(batchFolder, { recursive: true });
    }


    let generatedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Filter out initially skipped/duplicate rows to add to the error report
    rows.filter(r => r.status !== 'Ready').forEach(r => {
      errors.push({ ...r, failReason: r.error || 'Skipped in preview' });
    });

    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const chunks = chunkArray(validRows, 20); // Process 20 certificates at a time
    const certificatesToInsert = [];

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (row) => {
        try {
          const certificateId = await generateCertificateId();
          const certificateData = {
            certificateId,
            studentName: row.studentName,
            regdNo: row.regdNo,
            college: row.college,
            internshipType: row.internshipType,
            programName: row.programName,
            startDate: parseExcelDate(row.startDate),
            endDate: parseExcelDate(row.endDate),
            issuedDate: row.issueDate ? parseExcelDate(row.issueDate) : Date.now(),
            email: row.email || '',
            phone: row.phone || '',
            status: 'Verified',
            createdBy: req.user._id
          };

          const frontendUrl = process.env.FRONTEND_URL;
          const verificationUrl = `${frontendUrl}/verify/${certificateId}`;
          certificateData.verificationUrl = verificationUrl;

          const qrPath = await generateQR(certificateId, verificationUrl);
          certificateData.qrPath = qrPath;

          const generatedPdfPath = await generatePDF(certificateData, qrPath);
          certificateData.pdfPath = generatedPdfPath;

          certificatesToInsert.push(certificateData);
          generatedCount++;
        } catch (err) {
          console.error(`Failed to generate for row ${row.rowNumber}:`, err);
          failedCount++;
          errors.push({ ...row, failReason: err.message });
        }
      });
      
      // Wait for the current chunk of 20 to finish before starting the next
      await Promise.all(chunkPromises);
    }

    // 2.5 Batch save to database
    if (certificatesToInsert.length > 0) {
      await Certificate.insertMany(certificatesToInsert);
    }

    // 3. Create ZIP File
    const zipPath = path.join(batchFolder, 'Certificates.zip');
    const output = fs.createWriteStream(zipPath);
    let archive;
    
    // Support for both archiver v7 (function) and v8 (ZipArchive class)
    if (typeof archiver === 'function') {
      archive = archiver('zip', { zlib: { level: 9 } });
    } else {
      archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    }

    // We can't await the close easily inside a loop/handler without a promise wrapper, let's wrap archiver in a promise
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      
      archive.pipe(output);
      
      // Add generated PDFs directly to archive
      certificatesToInsert.forEach(cert => {
        const sourcePdf = path.join(__dirname, '..', cert.pdfPath);
        archive.file(sourcePdf, { name: `${cert.certificateId}.pdf` });
      });
      
      // Create Error Report CSV if needed
      if (errors.length > 0) {
        const csvPath = path.join(batchFolder, 'Error_Report.csv');
        const csvHeaders = 'Row,Student Name,Regd No,Error Reason\n';
        const csvRows = errors.map(e => `${e.rowNumber || ''},"${e.studentName || ''}","${e.regdNo || ''}","${e.failReason || ''}"`).join('\n');
        fs.writeFileSync(csvPath, csvHeaders + csvRows);
        archive.file(csvPath, { name: 'Error_Report.csv' });
      }
      
      archive.finalize();
    });

    // 4. Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'Bulk Generate',
      details: `Bulk generated ${generatedCount} certificates. Skipped/Failed: ${failedCount + (rows.length - validRows.length)}`,
      ipAddress: req.ip
    });

    const relativeZipUrl = `/bulk/${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${batchId}/Certificates.zip`;
    const relativeCsvUrl = errors.length > 0 ? `/bulk/${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${batchId}/Error_Report.csv` : null;

    res.status(200).json({
      success: true,
      data: {
        totalRows: rows.length,
        generated: generatedCount,
        skipped: rows.length - validRows.length,
        failed: failedCount,
        zipUrl: relativeZipUrl,
        csvUrl: relativeCsvUrl
      }
    });

  } catch (error) {
    fs.appendFileSync(path.join(__dirname, '..', 'error.log'), new Date().toISOString() + '\\n' + (error.stack || error) + '\\n\\n');
    console.error('Bulk generation error:', error);
    res.status(500).json({ success: false, message: 'Server Error during bulk generation', error: error.message });
  }
};

module.exports = {
  downloadSampleExcel,
  validateBulkUpload,
  generateBulkCertificates
};
