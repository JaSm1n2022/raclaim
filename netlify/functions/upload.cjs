const pdfParse = require('pdf-parse');
const parser = require('../../api/utils/helperImsParser.cjs');

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
    // Get content type
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];

    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
      };
    }

    // Extract boundary from content-type header
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No boundary found in Content-Type' })
      };
    }

    const boundary = boundaryMatch[1];

    // Parse the body - it comes as base64 when binary
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

    // Simple multipart parser for single file upload
    const parts = bodyBuffer.toString('binary').split('--' + boundary);

    let fileBuffer = null;
    let originalFilename = 'Unknown';

    // Find the file part
    for (const part of parts) {
      if (part.includes('Content-Type: application/pdf') || part.includes('filename=')) {
        // Extract filename
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          originalFilename = filenameMatch[1];
        }

        // Extract file data - everything after the double CRLF
        const dataStart = part.indexOf('\r\n\r\n');
        if (dataStart !== -1) {
          const dataEnd = part.lastIndexOf('\r\n');
          const binaryData = part.substring(dataStart + 4, dataEnd > dataStart ? dataEnd : part.length);
          fileBuffer = Buffer.from(binaryData, 'binary');
          break;
        }
      }
    }

    if (!fileBuffer) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No PDF file found in upload' })
      };
    }

    console.log('PDF file received:', originalFilename, 'Size:', fileBuffer.length, 'bytes');

    // Parse PDF to text
    const pdfData = await pdfParse(fileBuffer);
    const pdfText = pdfData.text;

    console.log('PDF parsed successfully, text length:', pdfText.length);

    // Parse claim data
    const medicaidMemberClaimPaidServiceInfo = parser.getMedicaidMemberPaid(pdfText);
    const medicaidMemberClaimDeniedServiceInfo = parser.getMedicaidMemberDenied(pdfText);
    const medicareMemberClaimPaidServiceInfo = parser.getMedicareMemberPaid(pdfText);
    const medicareMemberClaimDeniedServiceInfo = parser.getMedicareMemberDenied(pdfText);
    const adjustment = parser.getAdjustment(pdfText);
    const remittanceSummary = parser.getRemittanceSummary(pdfText);

    // Calculate summaries
    const medicaidPaidSummary = parser.captureReport(
      pdfText,
      'TOTAL PROFESSIONAL SERVICE CLAIMS PAID:',
      '1REPORT:',
      1
    );
    const medicaidDeniedSummary = parser.captureReport(
      pdfText,
      'TOTAL PROFESSIONAL SERVICE CLAIMS DENIED:',
      '1REPORT:',
      1
    );
    const medicarePaidSummary = parser.captureReport(
      pdfText,
      'TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS PAID:',
      '1REPORT:',
      1
    );
    const medicareDeniedSummary = parser.captureReport(
      pdfText,
      'TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED:',
      '1REPORT:',
      1
    );
    const adjustmentSummary = parser.captureReport(
      pdfText,
      'TOTAL PROFESSIONAL SERVICE CLAIMS ADJ:',
      '1REPORT:',
      1
    );
    const netPaymentData = parser.captureReport(pdfText, 'NET PAYMENT', '1REPORT:', 1);

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
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to process PDF',
        details: error.message
      })
    };
  }
};
