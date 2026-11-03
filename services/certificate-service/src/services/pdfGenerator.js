const PDFDocument = require('pdfkit');

const generateCertificatePDF = (certData) => new Promise((resolve, reject) => {
  try {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 36, bottom: 36, left: 50, right: 50 },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width;
    const height = doc.page.height;
    const title = String(certData.certificateTitle || 'Certificate of Achievement').trim();

    doc.rect(20, 20, width - 40, height - 40).lineWidth(2.5).strokeColor('#1a2633').stroke();
    doc.rect(30, 30, width - 60, height - 60).lineWidth(0.8).strokeColor('#536577').stroke();

    if (certData.institutionLogoBuffer) {
      try {
        doc.image(certData.institutionLogoBuffer, 58, 46, { fit: [76, 76], align: 'center', valign: 'center' });
      } catch (logoError) {
        console.warn('Could not embed university logo in PDF:', logoError.message);
      }
    }

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#24384b')
      .text(certData.institutionName || 'Issuing institution', 150, 65, { width: width - 205, align: 'center' });
    doc.moveTo(80, 132).lineTo(width - 80, 132).lineWidth(1.4).strokeColor('#0f7184').stroke();

    doc.font('Helvetica-Bold').fontSize(title.length > 38 ? 25 : 32).fillColor('#172738')
      .text(title, 70, 150, { width: width - 140, height: 45, align: 'center', ellipsis: true });
    doc.font('Helvetica').fontSize(14).fillColor('#475563')
      .text('This credential is awarded to', 70, 211, { width: width - 140, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(String(certData.studentName || '').length > 38 ? 22 : 28).fillColor('#172738')
      .text(certData.studentName || '', 70, 237, { width: width - 140, height: 42, align: 'center', ellipsis: true });
    doc.font('Helvetica').fontSize(14).fillColor('#475563')
      .text('for', 70, 286, { width: width - 140, align: 'center' });
    const qualification = String(certData.courseName || '');
    doc.font('Helvetica-Bold').fontSize(qualification.length > 72 ? 17 : 21).fillColor('#205c79')
      .text(qualification, 72, 309, { width: width - 144, height: 48, align: 'center', ellipsis: true });

    let creditsY = 365;
    if (certData.criteria) {
      doc.font('Helvetica').fontSize(9).fillColor('#687583')
        .text(`Criteria: ${certData.criteria}`, 100, 358, {
          width: width - 200, height: 30, align: 'center', ellipsis: true,
        });
      creditsY = 397;
    }
    if (certData.grade) {
      doc.font('Helvetica').fontSize(12).fillColor('#475563')
        .text(`Result: ${certData.grade}`, 70, creditsY, { width: width - 140, align: 'center' });
      creditsY += 20;
    }
    if (certData.teacherName) {
      const teacherLine = certData.teacherTitle
        ? `Presented by ${certData.teacherName} - ${certData.teacherTitle}`
        : `Presented by ${certData.teacherName}`;
      doc.font('Helvetica').fontSize(10).fillColor('#5d6873')
        .text(teacherLine, 70, creditsY, { width: width - 140, align: 'center', ellipsis: true });
      creditsY += 18;
    }
    const sponsors = Array.isArray(certData.sponsors) ? certData.sponsors.filter(Boolean) : [];
    if (sponsors.length) {
      doc.font('Helvetica').fontSize(10).fillColor('#5d6873')
        .text(`With support from ${sponsors.join(', ')}`, 100, creditsY, { width: width - 200, align: 'center', ellipsis: true });
      creditsY += 18;
    }

    const issueDate = new Date(certData.issueDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
    doc.font('Helvetica').fontSize(10).fillColor('#596674')
      .text(`Issued ${issueDate}`, 82, 455);
    if (certData.validUntil) {
      const validUntil = new Date(certData.validUntil).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      });
      doc.text(`Valid through ${validUntil}`, 82, 474);
    }
    doc.text(`Record ID: ${certData.certificateId}`, 82, certData.validUntil ? 493 : 474, { width: 440, ellipsis: true });

    if (certData.qrCode) {
      try {
        const qrBuffer = Buffer.from(certData.qrCode.replace(/^data:image\/png;base64,/, ''), 'base64');
        doc.image(qrBuffer, width - 172, 430, { width: 78, height: 78 });
        doc.font('Helvetica').fontSize(8).fillColor('#687583')
          .text('Scan to verify', width - 180, 510, { width: 94, align: 'center' });
      } catch (qrError) {
        console.warn('Could not embed QR code in PDF:', qrError.message);
      }
    }

    doc.moveTo(80, height - 69).lineTo(width - 80, height - 69).lineWidth(1.2).strokeColor('#0f7184').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#73808b')
      .text("Scan the QR code to check this credential's current verification status.", 70, height - 57, {
        width: width - 140, align: 'center',
      });
    doc.end();
  } catch (error) {
    reject(error);
  }
});

module.exports = { generateCertificatePDF };
