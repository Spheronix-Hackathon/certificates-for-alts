const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Format date as "DD MMM YYYY"
const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
};

const generatePDF = async (certificate, qrImagePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const pdfsDir = path.join(__dirname, '..', 'pdfs');
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }

      const fileName = `${certificate.certificateId}.pdf`;
      const filePath = path.join(pdfsDir, fileName);

      // Template Dimensions (Portrait)
      const canvasWidth = 745;
      const canvasHeight = 1046;

      const doc = new PDFDocument({
        size: [canvasWidth, canvasHeight], // Exact dimensions
        margin: 0
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // 1. Draw Template Image Background
      const localTemplatePath = path.join(__dirname, '..', 'templates', 'template.jpeg');
      const fallbackTemplatePath = path.join(__dirname, '..', '2.png');

      let templateToUse = null;
      if (fs.existsSync(localTemplatePath)) {
        templateToUse = localTemplatePath;
      } else if (fs.existsSync(fallbackTemplatePath)) {
        templateToUse = fallbackTemplatePath;
      }

      if (templateToUse) {
        doc.image(templateToUse, 0, 0, { width: canvasWidth, height: canvasHeight });
      } else {
        // Fallback if no template is found
        doc.rect(20, 20, canvasWidth - 40, canvasHeight - 40).lineWidth(10).stroke('#000');
      }

      // Default styling for dynamic text
      doc.font('Helvetica-Bold');
      doc.fillColor('black');

      // Helper function to safely get text
      const getText = (val) => (val !== undefined && val !== null) ? String(val) : '';

      // Helper to center mixed-font text precisely
      const drawCenteredLine = (segments, y, color = 'black') => {
        let totalWidth = 0;
        segments.forEach(seg => {
          doc.font(seg.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(seg.size || 14);
          totalWidth += doc.widthOfString(seg.text);
        });
        let currentX = (canvasWidth - totalWidth) / 2;
        segments.forEach(seg => {
          doc.font(seg.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(seg.size || 14).fillColor(seg.color || color);
          doc.text(seg.text, currentX, y, { lineBreak: false });
          currentX += doc.widthOfString(seg.text);
        });
      };

      // --- TEXT PLACEMENTS & CORRECTIONS ---
      // We draw 3 large white rectangles to clear the entire center area WITHOUT touching the side badges
      doc.fillColor('white');

      // 1. Clear Top (Logos + Top Header)
      doc.rect(100, 70, 545, 180).fill();

      // 2. Clear Title Area (Between the Gold & Green seals)
      doc.rect(200, 260, 345, 150).fill();

      // 3. Clear Bottom (From "Presented to" all the way down to QR code)
      doc.rect(50, 420, canvasWidth - 100, 380).fill();

      // --- LOGOS PLACEMENT ---
      const templatesDir = path.join(__dirname, '..', 'templates');

      const apscheLogo = path.join(templatesDir, 'apsche-logo.png');
      const govLogo = path.join(templatesDir, 'Gov.ap.png');
      const companyLogo = path.join(templatesDir, 'company logo.jpeg');

      const msmeLogo = path.join(templatesDir, 'msme.png');
      const mcaLogo = path.join(templatesDir, 'mca.png');

      const medalLogo = path.join(templatesDir, 'medal.png');
      const certifiedLogo = path.join(templatesDir, 'certified.jpeg');

      // Clear the old baked-in medals on the left and right (Shifted down/right to cover the remnants)
      doc.fillColor('white');
      doc.rect(40, 260, 160, 180).fill(); // Left medal whiteout
      doc.rect(550, 260, 160, 180).fill(); // Right certified stamp whiteout

      // Top Logos (Shifted down to Y=100)
      if (fs.existsSync(apscheLogo)) {
        doc.image(apscheLogo, 165, 100, { width: 100, height: 100 });
      }
      if (fs.existsSync(govLogo)) {
        doc.image(govLogo, 315, 100, { width: 100, height: 100 });
      }
      if (fs.existsSync(companyLogo)) {
        doc.image(companyLogo, 450, 110, { width: 170 });
      }

      // Left Medal Logo (Shifted down and right)
      if (fs.existsSync(medalLogo)) {
        doc.image(medalLogo, 50, 270, { width: 140 });
      }

      // Right Certified Logo (Shifted higher up)
      if (fs.existsSync(certifiedLogo)) {
        doc.image(certifiedLogo, 580, 310, { width: 60 });
      }

      // Switch back to black for text
      doc.fillColor('black');

      // 1. Top Headers (Shifted down)
      drawCenteredLine([
        { text: 'ANDHRA PRADESH STATE COUNCIL OF HIGHER EDUCATION', bold: true, size: 16 }
      ], 215);
      drawCenteredLine([
        { text: '(A Statutory Body of Government of the Andhra Pradesh)', bold: true, size: 14 }
      ], 240);

      // 2. Main Title (Shifted down)
      drawCenteredLine([
        { text: 'C E R T I F I C A T E', bold: true, size: 42, color: '#7e22ce' }
      ], 320);
      drawCenteredLine([
        { text: 'OF Internship', bold: false, size: 24, color: '#7e22ce' }
      ], 380);

      // 3. Presented To
      drawCenteredLine([
        { text: 'This certificate is proudly presented to:', bold: false, size: 16 }
      ], 455);

      // 4. Student Name & Extended Gold Line
      const studentName = getText(certificate.studentName).toUpperCase();
      drawCenteredLine([
        { text: studentName, bold: true, size: 28 }
      ], 495);

      const nameWidth = doc.font('Helvetica-Bold').fontSize(28).widthOfString(studentName);
      const nameX = (canvasWidth - nameWidth) / 2;
      const linePadding = 40; // Extends line by 40px on both sides
      doc.moveTo(nameX - linePadding, 530).lineTo(nameX + nameWidth + linePadding, 530).lineWidth(2).stroke('#eab308');

      // 5. Descriptive Paragraph
      const regd = getText(certificate.regdNo);
      const college = getText(certificate.college);
      const internship = getText(certificate.internshipType);
      const program = getText(certificate.programName);
      const dates = `${formatDate(certificate.startDate)} to ${formatDate(certificate.endDate)}`;

      drawCenteredLine([
        { text: 'Regd No: ', bold: false, size: 14 },
        { text: regd, bold: true, size: 14 },
        { text: ' of ', bold: false, size: 14 },
        { text: `${college},`, bold: true, size: 14 }
      ], 565);

      drawCenteredLine([
        { text: 'has successfully completed ', bold: false, size: 14 },
        { text: internship, bold: false, size: 14 },
        { text: ' Internship from', bold: false, size: 14 }
      ], 590);

      drawCenteredLine([
        { text: `${dates}. Program on`, bold: false, size: 14 }
      ], 615);

      drawCenteredLine([
        { text: program.toUpperCase(), bold: true, size: 18 }
      ], 640);

      // 6. Bottom Collaboration Text
      drawCenteredLine([
        { text: 'held by ', bold: false, size: 14 },
        { text: 'Spheronix Technology Pvt Ltd ', bold: true, size: 14 },
        { text: 'in Collaboration with', bold: false, size: 14 }
      ], 695);

      drawCenteredLine([
        { text: 'Andhra Pradesh State Council of Higher Education', bold: false, size: 14 }
      ], 720);

      // 7. Bottom Logos (MSME & MCA)
      if (fs.existsSync(msmeLogo)) {
        doc.image(msmeLogo, 235, 750, { width: 110, height: 50 });
      }
      if (fs.existsSync(mcaLogo)) {
        doc.image(mcaLogo, 385, 750, { width: 110, height: 50 });
      }

      // Clear the old baked-in QR code that is slightly off-center
      doc.fillColor('white');
      doc.rect(300, 800, 130, 120).fill();
      doc.fillColor('black');

      // --- QR CODE PLACEMENT ---
      // Shifted left slightly to perfectly match the red marked box position
      const absoluteQrPath = path.join(__dirname, '..', qrImagePath);
      if (fs.existsSync(absoluteQrPath)) {
        doc.image(absoluteQrPath, 320, 815, { width: 70, height: 70 });
      }

      // Certificate ID (Centered exactly underneath the offset QR Code)
      // QR Code is at X=320 with width=70 (center is 355).
      // We create a bounding box centered at 355.
      doc.fillColor('#666666').fontSize(10)
        .text(`ID: ${certificate.certificateId}`, 270, 895, { align: 'center', width: 170 });

      doc.end();

      writeStream.on('finish', () => resolve(`pdfs/${fileName}`));
      writeStream.on('error', (err) => reject(err));

    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generatePDF };
