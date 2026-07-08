const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const { koaBody } = require('koa-body');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const parser = require('./utils/helperImsParser.cjs');

const app = new Koa();
const router = new Router();

// Middleware
app.use(cors());
app.use(koaBody({
  multipart: true,
  formidable: {
    uploadDir: path.join(__dirname, '../uploads'),
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  }
}));

// Upload and parse PDF endpoint
router.post('/api/upload', async (ctx) => {
  try {
    const file = ctx.request.files?.file;

    if (!file) {
      ctx.status = 400;
      ctx.body = { error: 'No file uploaded' };
      return;
    }

    // Get original filename
    const originalFilename = file.originalFilename || file.newFilename || 'Unknown';

    // Read PDF file
    const dataBuffer = fs.readFileSync(file.filepath);

    // Parse PDF to text
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    console.log('PDF parsed, extracting claim data from:', originalFilename);

    // Convert to JSON string (as expected by the parser functions from med-eft-api)
    const data = JSON.stringify(pdfData);

    // Parse claim data
    const medicaidMemberClaimDeniedServiceInfo = parser.getMedicaidMemberDenied(data) || [];
    const medicareMemberClaimDeniedServiceInfo = parser.getMedicareMemberDenied(data) || [];
    const medicaidMemberClaimPaidServiceInfo = parser.getMedicaidMemberPaid(data) || [];
    const medicareMemberClaimPaidServiceInfo = parser.getMedicareMemberPaid(data) || [];

    // Parse adjustment data
    const adjustmentServiceInfo = parser.getAdjustment(data) || [];

    // Get totals using captureReport
    const medicaidPaid = parser.captureReport(
      data,
      "TOTAL PROFESSIONAL SERVICE CLAIMS PAID:",
      "1REPORT:",
      3
    ) || { amount: 0 };

    const medicaidDenied = parser.captureReport(
      data,
      "TOTAL PROFESSIONAL SERVICE CLAIMS DENIED:",
      "1REPORT:",
      0
    ) || { amount: 0 };

    const medicareDenied = parser.captureReport(
      data,
      "TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED:",
      "1REPORT:",
      8
    ) || { amount: 0 };

    const medicarePaid = parser.captureReport(
      data,
      "TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS PAID:",
      "1REPORT:",
      6
    ) || { amount: 0 };

    const netPayment = parser.captureReport(data, "NET PAYMENT", "1REPORT:", 0) || { amount: 0 };

    const totalNbrClaimPayments = parser.captureReport(
      data,
      "TOTAL CLAIMS PAYMENTS",
      "CLAIMS DENIED",
      0
    ) || { amount: 0 };

    const totalNbrClaimsDenied = parser.captureReport(
      data,
      "CLAIMS DENIED",
      "EARNINGS DATA",
      0
    ) || { amount: 0 };

    const totalNbrAdj = parser.captureReport(
      data,
      "TOTAL PROFESSIONAL SERVICE CLAIMS ADJ:",
      "REPORT",
      1
    ) || { amount: 0 };

    // Get services summary
    const servicesData = parser.getServicesV2(
      medicaidMemberClaimDeniedServiceInfo,
      medicareMemberClaimDeniedServiceInfo,
      medicaidMemberClaimPaidServiceInfo,
      medicareMemberClaimPaidServiceInfo
    );
    const serviceSummary = servicesData?.serviceList || [];

    // Get remittance summary
    const remittance = parser.getRemittanceSummary(data) || {};
    remittance.filename = originalFilename;

    // Calculate total denied amount
    let totalDeniedAmount = 0;
    if (medicaidDenied && medicaidDenied.amount) {
      totalDeniedAmount = parseFloat(medicaidDenied.amount.toString().replace(/,/g, ''));
    }
    if (medicareDenied && medicareDenied.amount) {
      totalDeniedAmount += parseFloat(medicareDenied.amount.toString().replace(/,/g, ''));
    }

    const result = {
      medicaid: {
        paid: medicaidMemberClaimPaidServiceInfo,
        denied: medicaidMemberClaimDeniedServiceInfo,
      },
      medicare: {
        paid: medicareMemberClaimPaidServiceInfo,
        denied: medicareMemberClaimDeniedServiceInfo,
      },
      medicaidSummary: {
        paid: {
          count: parseInt((medicaidPaid.totalCnt || medicaidPaid.amount || 0).toString().replace(/,/g, '')) || medicaidMemberClaimPaidServiceInfo.length,
          amount: (medicaidPaid.amount || '0').toString().replace(/,/g, '')
        },
        denied: {
          count: parseInt((medicaidDenied.totalCnt || 0).toString().replace(/,/g, '')) || medicaidMemberClaimDeniedServiceInfo.length,
          amount: (medicaidDenied.amount || '0').toString().replace(/,/g, '')
        }
      },
      medicareSummary: {
        paid: {
          count: parseInt((medicarePaid.totalCnt || 0).toString().replace(/,/g, '')) || medicareMemberClaimPaidServiceInfo.length,
          amount: (medicarePaid.amount || '0').toString().replace(/,/g, '')
        },
        denied: {
          count: parseInt((medicareDenied.totalCnt || 0).toString().replace(/,/g, '')) || medicareMemberClaimDeniedServiceInfo.length,
          amount: (medicareDenied.amount || '0').toString().replace(/,/g, '')
        }
      },
      adjustments: adjustmentServiceInfo,
      services: serviceSummary,
      remittance,
      netPayment: parseFloat((netPayment.amount || 0).toString().replace(/,/g, '')) || 0,
      deniedAmount: totalDeniedAmount,
      totalNumber: {
        payments: parseInt((totalNbrClaimPayments.amount || 0).toString().replace(/,/g, '')) || 0,
        denied: parseInt((totalNbrClaimsDenied.amount || 0).toString().replace(/,/g, '')) || 0,
        adjustment: parseInt((totalNbrAdj.amount || 0).toString().replace(/,/g, '')) || 0,
      },
    };

    // Clean up uploaded file
    fs.unlinkSync(file.filepath);

    console.log('Claim data extracted successfully');
    ctx.body = result;
  } catch (error) {
    console.error('Error processing PDF:', error);
    ctx.status = 500;
    ctx.body = { error: 'Failed to process PDF', details: error.message, stack: error.stack };
  }
});

// Health check endpoint
router.get('/api/health', (ctx) => {
  ctx.body = { status: 'ok', message: 'RACLAIM API is running' };
});

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RACLAIM API server running on port ${PORT}`);
});
