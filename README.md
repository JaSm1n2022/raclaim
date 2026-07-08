# RACLAIM - RA Claim PDF to Excel Converter

A modern web application that automatically converts Remittance Advice (RA) claim PDFs to Excel format. Upload your Medicaid/Medicare RA claim PDFs and instantly get structured Excel files with parsed claim data.

## Features

- **Drag & Drop Upload**: Simple and intuitive file upload interface
- **Automatic PDF Parsing**: Extracts claim data from RA PDFs using advanced parsing algorithms
- **Excel Export**: Automatically generates Excel files with:
  - Medicaid Paid Claims
  - Medicaid Denied Claims
  - Medicare Paid Claims
  - Medicare Denied Claims
  - Services Summary
  - Remittance Summary
- **Real-time Processing**: Instant feedback on upload and processing status
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Project Structure

```
raclaim/
├── api/                    # Backend API (Node.js + Koa)
│   ├── index.js           # Main API server
│   └── utils/             # Parsing utilities
│       ├── helperImsParser.js  # PDF parsing logic
│       └── constants.js   # Service codes, EOB codes, etc.
├── src/                   # Frontend (React + TypeScript)
│   ├── components/        # React components
│   │   ├── FileUpload.tsx
│   │   └── ClaimResults.tsx
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main app component
│   └── main.tsx          # App entry point
├── uploads/              # Temporary upload storage
└── package.json          # Dependencies and scripts
```

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **react-dropzone** - Drag & drop file upload
- **xlsx** - Excel file generation
- **lucide-react** - Icon library
- **react-hot-toast** - Toast notifications

### Backend
- **Node.js** - Runtime environment
- **Koa** - Web framework
- **pdf-parse** - PDF text extraction
- **koa-body** - File upload handling
- **@koa/cors** - CORS support

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
cd /Users/nargelmac/Documents/GitHub/raclaim
```

2. Install dependencies:
```bash
npm install
```

### Development

Run both frontend and backend concurrently:
```bash
npm run dev:all
```

Or run them separately:

**Frontend only** (port 5173):
```bash
npm run dev
```

**Backend API only** (port 3000):
```bash
npm run dev:api
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Building for Production

Build the frontend:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Usage

1. Open the application in your browser
2. Drag and drop your RA claim PDF file (or click to browse)
3. Click "Convert to Excel"
4. View parsed results in tables
5. Download individual Excel files for each section or all data at once

## API Endpoints

### POST /api/upload
Upload and process RA claim PDF file.

**Request:**
- Content-Type: multipart/form-data
- Body: file (PDF)

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
Health check endpoint.

## Project Background

This project consolidates the functionality of two previous projects:
- **med-eft**: Frontend for uploading RA claim PDFs
- **med-eft-api**: Backend API for parsing and converting PDFs

RACLAIM combines both into a single, modern, full-stack application with improved UX and automatic Excel generation.

## License

Private - All rights reserved

## Author

Nargel Velasco
