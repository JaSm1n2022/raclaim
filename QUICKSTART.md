# RACLAIM - Quick Start Guide

## What is RACLAIM?

RACLAIM is a full-stack application that consolidates the functionality of **med-eft** (frontend) and **med-eft-api** (backend) into a single, modern project. It allows you to:

1. Upload RA (Remittance Advice) claim PDF files via drag & drop
2. Automatically parse and extract claim data
3. Display results in organized tables
4. Export data to Excel format

## Project Structure

```
raclaim/
├── api/                          # Backend (Node.js + Koa)
│   ├── index.js                 # API server with PDF upload endpoint
│   └── utils/                   # Parsing utilities from med-eft-api
│       ├── helperImsParser.js   # Complex PDF parsing logic
│       └── constants.js         # EOB codes, service codes, etc.
│
├── src/                         # Frontend (React + TypeScript + Vite)
│   ├── components/
│   │   ├── FileUpload.tsx      # Drag & drop upload component
│   │   └── ClaimResults.tsx    # Display and export results
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── App.tsx                 # Main app component
│   └── main.tsx                # React entry point
│
├── uploads/                     # Temporary PDF storage
├── package.json                # Single package.json for both frontend & backend
└── README.md                   # Full documentation
```

## Key Features Compared to Original Projects

### From med-eft (Frontend)
- ✅ File upload functionality (upgraded to drag & drop)
- ✅ Display parsed data in tables
- ✅ Excel export capability
- ✨ **NEW**: Modern React + TypeScript instead of old React with Redux
- ✨ **NEW**: Drag & drop interface using react-dropzone
- ✨ **NEW**: Tailwind CSS for modern UI
- ✨ **NEW**: Real-time toast notifications

### From med-eft-api (Backend)
- ✅ PDF parsing using pdf-parse
- ✅ Medicaid/Medicare claim extraction
- ✅ Service code parsing
- ✅ EOB code lookups
- ✨ **NEW**: Modern Koa framework (@koa/router instead of deprecated koa-router)
- ✨ **NEW**: Simplified API structure
- ✨ **NEW**: Better error handling

## How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Servers

**Option A: Run both frontend and backend together (recommended)**
```bash
npm run dev:all
```

**Option B: Run separately**

Terminal 1 (Frontend):
```bash
npm run dev
```

Terminal 2 (Backend):
```bash
npm run dev:api
```

### 3. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## How to Use

1. Open http://localhost:5173 in your browser
2. Drag and drop your RA claim PDF file (or click to browse)
3. Click "Convert to Excel" button
4. View the parsed results in tables:
   - Medicaid Paid Claims
   - Medicaid Denied Claims
   - Medicare Paid Claims
   - Medicare Denied Claims
   - Services Summary
5. Download individual tables or all data as Excel files

## API Endpoints

### POST /api/upload
Upload and process RA claim PDF file

**Request:**
- Content-Type: multipart/form-data
- Field: `file` (PDF file)

**Response:**
```json
{
  "medicaid": {
    "paid": [...],
    "denied": [...]
  },
  "medicare": {
    "paid": [...],
    "denied": [...]
  },
  "services": [...],
  "remittance": {...},
  "netPayment": 0,
  "deniedAmount": 0,
  "totalNumber": {
    "payments": 0,
    "denied": 0,
    "adjustment": 0
  }
}
```

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "RACLAIM API is running"
}
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Styling
- **react-dropzone** - Drag & drop
- **xlsx** - Excel generation
- **axios** - HTTP client
- **react-hot-toast** - Notifications
- **lucide-react** - Icons

### Backend
- **Node.js** - Runtime
- **Koa** - Web framework
- **@koa/router** - Routing
- **pdf-parse** - PDF text extraction
- **koa-body** - File upload handling
- **@koa/cors** - CORS support

## Build for Production

```bash
# Build frontend
npm run build

# Preview production build
npm run preview
```

The production files will be in the `dist/` directory.

## Differences from Original Projects

| Feature | med-eft | med-eft-api | RACLAIM |
|---------|---------|-------------|---------|
| Framework | React 17 | Node.js/Koa | React 18 + Node.js/Koa |
| State Management | Redux + Saga | N/A | React Hooks |
| Styling | Material-UI | N/A | Tailwind CSS |
| Language | JavaScript | JavaScript | TypeScript (frontend) |
| Build Tool | Webpack | N/A | Vite |
| File Upload | Standard input | File path | Drag & drop |
| Excel Export | Manual | N/A | Automatic |
| Project Structure | Separate repos | Separate repos | Monorepo |

## Next Steps

1. Test with your RA claim PDFs
2. Customize the UI as needed
3. Add authentication if required
4. Deploy to production

## Troubleshooting

**Port already in use:**
```bash
# Change ports in package.json or .env
PORT=3001 npm run dev:api
```

**Dependencies issues:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**TypeScript errors:**
```bash
npm run typecheck
```

## Support

For issues or questions, refer to the main README.md file.
