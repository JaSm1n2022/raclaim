# Netlify Deployment Guide for MyBillingRA

This guide will help you deploy your MyBillingRA application to Netlify.

## Prerequisites

1. A GitHub account
2. A Netlify account (free tier works fine)
3. Your code pushed to a GitHub repository

## Deployment Steps

### 1. Push Your Code to GitHub

If you haven't already, initialize and push your code to GitHub:

```bash
git add .
git commit -m "Prepare for Netlify deployment"
git push origin main
```

### 2. Connect to Netlify

1. Go to [Netlify](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Choose "GitHub" as your Git provider
4. Authorize Netlify to access your GitHub account
5. Select your `raclaim` repository

### 3. Configure Build Settings

Netlify should auto-detect the settings from `netlify.toml`, but verify these settings:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Functions directory:** `netlify/functions`

### 4. Deploy

1. Click "Deploy site"
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, Netlify will provide you with a URL like: `https://your-app-name.netlify.app`

### 5. Custom Domain (Optional)

If you want to use a custom domain:

1. Go to "Domain settings" in your Netlify dashboard
2. Click "Add custom domain"
3. Follow the instructions to configure your DNS settings

## Configuration Files

The following files have been configured for Netlify deployment:

### `netlify.toml`
This file tells Netlify how to build and deploy your app:
- Build command: `npm run build`
- Output directory: `dist`
- API routes are redirected to serverless functions
- SPA routing is handled correctly

### `netlify/functions/upload.js`
This is a serverless function that replaces your Koa backend API. It handles:
- PDF file uploads
- PDF parsing
- Claim data extraction

## How It Works

### Local Development
- Run `npm run dev:all` to start both frontend (Vite) and backend (Koa) servers
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

### Production (Netlify)
- Frontend is served as static files from the `dist` folder
- API endpoints (`/api/*`) are handled by Netlify Functions
- All requests are routed through `/.netlify/functions/upload`

## Testing Your Deployment

After deployment:

1. Visit your Netlify URL
2. Log in with any email address
3. Navigate to "RA Report"
4. Upload a test PDF file
5. Verify that the PDF is processed correctly
6. Check that you can download Excel files and print PDF reports

## Troubleshooting

### Build Fails
- Check the Netlify build logs for errors
- Ensure all dependencies are in `package.json`
- Verify that `npm run build` works locally

### API Not Working
- Check the Netlify Function logs
- Verify that the file upload size is within Netlify's limits (10MB default)
- Make sure CORS is configured correctly in the function

### Environment Variables
If you need environment variables:
1. Go to Site settings → Build & deploy → Environment
2. Add your variables
3. Redeploy your site

## File Upload Limits

Netlify Functions have the following limits:
- **Free tier:** 125,000 requests/month, 100 hours runtime
- **Max file size:** 10MB (configurable in the function)
- **Timeout:** 10 seconds (can be increased on paid plans)

If you need to handle larger files, consider upgrading to a paid Netlify plan or using a different file storage solution.

## Support

For issues with:
- **Netlify deployment:** Check [Netlify Docs](https://docs.netlify.com/)
- **Application bugs:** Create an issue in your GitHub repository

## Local Development vs Production

| Feature | Local (`npm run dev:all`) | Production (Netlify) |
|---------|---------------------------|----------------------|
| Frontend | Vite dev server | Static files |
| Backend | Koa server (Node.js) | Serverless functions |
| API URL | http://localhost:3000/api | /.netlify/functions |
| Hot reload | Yes | No (requires redeploy) |

## Continuous Deployment

Netlify automatically redeploys your site when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Netlify will detect the push and start a new build automatically.

## Cost

- **Free tier includes:**
  - 100 GB bandwidth/month
  - 300 build minutes/month
  - Automatic HTTPS
  - Continuous deployment
  - Serverless functions

This should be more than enough for personal use or small teams.
