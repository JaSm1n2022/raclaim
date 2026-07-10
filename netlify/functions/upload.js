const pdfParse = require('pdf-parse');
const parser = require('../../api/utils/helperImsParser.cjs');
const multipart = require('parse-multipart-data');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the multipart form data
    const boundary = multipart.getBoundary(event.headers['content-type']);
    const parts = multipart.parse(Buffer.from(event.body, 'base64'), boundary);

    // Find the file part
    const filePart = parts.find(part => part.name === 'file');

    if (!filePart) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file uploaded' })
      };
    }

    const originalFilename = filePart.filename || 'Unknown';
    const dataBuffer = filePart.data;

    // Parse PDF to text
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    console.log('PDF parsed, extracting claim data from:', originalFilename);

    // Convert to JSON string (as expected by the parser functions)
    const data = JSON.stringify(pdfData);

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
