const pdfParse = require('pdf-parse');
const parser = require('../../api/utils/helperImsParser.cjs');
const Busboy = require('@fastify/busboy');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse multipart form data using busboy
    const fileBuffer = await new Promise((resolve, reject) => {
      const busboy = Busboy({
        headers: {
          'content-type': event.headers['content-type'] || event.headers['Content-Type']
        }
      });

      let fileData = null;
      let fileName = 'Unknown';
      const chunks = [];

      busboy.on('file', (fieldname, file, info) => {
        fileName = info.filename;
        console.log('Receiving file:', fileName);

        file.on('data', (data) => {
          chunks.push(data);
        });

        file.on('end', () => {
          fileData = Buffer.concat(chunks);
          console.log('File received, size:', fileData.length, 'bytes');
        });
      });

      busboy.on('error', (error) => {
        console.error('Busboy error:', error);
        reject(error);
      });

      busboy.on('finish', () => {
        if (!fileData) {
          reject(new Error('No file data received'));
        } else {
          resolve({ buffer: fileData, filename: fileName });
        }
      });

      // Write the body to busboy
      const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      busboy.write(bodyBuffer);
      busboy.end();
    });

    if (!fileBuffer || !fileBuffer.buffer) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No PDF file found in upload' })
      };
    }

    const originalFilename = fileBuffer.filename;
    const buffer = fileBuffer.buffer;

    console.log('Processing PDF:', originalFilename);
    console.log('Buffer size:', buffer.length, 'bytes');
    console.log('Buffer is Buffer?', Buffer.isBuffer(buffer));
    console.log('First 20 bytes:', buffer.slice(0, 20).toString('hex'));
    console.log('PDF header check:', buffer.slice(0, 4).toString());

    // Verify PDF header
    if (buffer.slice(0, 4).toString() !== '%PDF') {
      throw new Error('Invalid PDF file - missing PDF header. First bytes: ' + buffer.slice(0, 20).toString('hex'));
    }

    // Parse PDF to text
    console.log('Starting PDF parse...');
    const pdfData = await pdfParse(buffer);
    const pdfText = pdfData.text;

    console.log('PDF parsed successfully, text length:', pdfText.length);

    // Convert to JSON string (as expected by the parser functions from med-eft-api)
    const data = JSON.stringify(pdfData);
    console.log('Data stringified, length:', data.length);

    // Parse claim data with detailed logging
    console.log('Parsing medicaid paid...');
    const medicaidMemberClaimPaidServiceInfo = parser.getMedicaidMemberPaid(data) || [];
    console.log('Medicaid paid parsed:', medicaidMemberClaimPaidServiceInfo.length, 'records');

    console.log('Parsing medicaid denied...');
    const medicaidMemberClaimDeniedServiceInfo = parser.getMedicaidMemberDenied(data) || [];
    console.log('Medicaid denied parsed:', medicaidMemberClaimDeniedServiceInfo.length, 'records');

    console.log('Parsing medicare paid...');
    const medicareMemberClaimPaidServiceInfo = parser.getMedicareMemberPaid(data) || [];
    console.log('Medicare paid parsed:', medicareMemberClaimPaidServiceInfo.length, 'records');

    console.log('Parsing medicare denied...');
    const medicareMemberClaimDeniedServiceInfo = parser.getMedicareMemberDenied(data) || [];
    console.log('Medicare denied parsed:', medicareMemberClaimDeniedServiceInfo.length, 'records');

    console.log('Parsing adjustment...');
    const adjustment = parser.getAdjustment(data) || [];
    console.log('Adjustment parsed:', adjustment.length, 'records');

    console.log('Parsing remittance summary...');
    const remittanceSummary = parser.getRemittanceSummary(data) || {};
    console.log('Remittance summary parsed');

    // Calculate summaries
    const medicaidPaidSummary = parser.captureReport(
      data,
      'TOTAL PROFESSIONAL SERVICE CLAIMS PAID:',
      '1REPORT:',
      1
    );
    const medicaidDeniedSummary = parser.captureReport(
      data,
      'TOTAL PROFESSIONAL SERVICE CLAIMS DENIED:',
      '1REPORT:',
      1
    );
    const medicarePaidSummary = parser.captureReport(
      data,
      'TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS PAID:',
      '1REPORT:',
      1
    );
    const medicareDeniedSummary = parser.captureReport(
      data,
      'TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED:',
      '1REPORT:',
      1
    );
    const adjustmentSummary = parser.captureReport(
      data,
      'TOTAL PROFESSIONAL SERVICE CLAIMS ADJ:',
      '1REPORT:',
      1
    );
    const netPaymentData = parser.captureReport(data, 'NET PAYMENT', '1REPORT:', 1);

    // Calculate totals
    const totalPaid = medicaidMemberClaimPaidServiceInfo.length +
                     medicareMemberClaimPaidServiceInfo.length;
    const totalDenied = medicaidMemberClaimDeniedServiceInfo.length +
                       medicareMemberClaimDeniedServiceInfo.length;

    const medicaidPaidAmount = medicaidMemberClaimPaidServiceInfo
      .reduce((sum, claim) => sum + (parseFloat(claim.srvcPaidAmt) || 0), 0);
    const medicarePaidAmount = medicareMemberClaimPaidServiceInfo
      .reduce((sum, claim) => sum + (parseFloat(claim.srvcPaidAmt) || 0), 0);
    const netPayment = parseFloat(netPaymentData.amount) ||
                      (medicaidPaidAmount + medicarePaidAmount);

    const medicaidDeniedAmount = parseFloat(medicaidDeniedSummary.amount) || 0;
    const medicareDeniedAmount = parseFloat(medicareDeniedSummary.amount) || 0;
    const deniedAmount = medicaidDeniedAmount + medicareDeniedAmount;

    // Get services summary
    const servicesData = parser.getServicesV2(
      medicaidMemberClaimDeniedServiceInfo,
      medicareMemberClaimDeniedServiceInfo,
      medicaidMemberClaimPaidServiceInfo,
      medicareMemberClaimPaidServiceInfo
    );

    // Build response
    const response = {
      medicaid: {
        paid: medicaidMemberClaimPaidServiceInfo,
        denied: medicaidMemberClaimDeniedServiceInfo
      },
      medicare: {
        paid: medicareMemberClaimPaidServiceInfo,
        denied: medicareMemberClaimDeniedServiceInfo
      },
      medicaidSummary: {
        paid: {
          count: medicaidPaidSummary.totalCnt || medicaidMemberClaimPaidServiceInfo.length,
          amount: medicaidPaidSummary.amount || medicaidPaidAmount.toFixed(2)
        },
        denied: {
          count: medicaidDeniedSummary.totalCnt || medicaidMemberClaimDeniedServiceInfo.length,
          amount: medicaidDeniedSummary.amount || '0.00'
        }
      },
      medicareSummary: {
        paid: {
          count: medicarePaidSummary.totalCnt || medicareMemberClaimPaidServiceInfo.length,
          amount: medicarePaidSummary.amount || medicarePaidAmount.toFixed(2)
        },
        denied: {
          count: medicareDeniedSummary.totalCnt || medicareMemberClaimDeniedServiceInfo.length,
          amount: medicareDeniedSummary.amount || '0.00'
        }
      },
      adjustments: adjustment,
      services: servicesData.serviceList,
      remittance: {
        ...remittanceSummary,
        filename: originalFilename
      },
      netPayment,
      deniedAmount,
      totalNumber: {
        payments: totalPaid,
        denied: totalDenied,
        adjustment: adjustmentSummary.totalCnt || adjustment.length
      }
    };

    console.log('Successfully processed PDF');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error processing PDF:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to process PDF',
        details: error.message,
        errorName: error.name,
        stack: error.stack
      })
    };
  }
};
