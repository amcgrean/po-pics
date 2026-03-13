# PO Check-In — Warehouse PWA

A Progressive Web App for warehouse workers to scan PO barcodes and submit delivery photos. Built with Next.js 14, Supabase, and Cloudflare R2.

## Features

- **Workers**: Scan PO barcode → take photo → submit (3-tap workflow)
- **Supervisors**: Dashboard to review, search, and flag submissions
- **PWA**: Works offline-capable, installable on iOS/Android via "Add to Home Screen"
- **No App Store**: Deploy to Vercel, share the URL

---

## Stack

| Layer | Service |
|-------|---------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| Image Storage | Cloudflare R2 (S3-compatible) |
| Barcode Scanning | html5-qrcode |
| Hosting | Vercel (free tier) |

---

## Setup Guide

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Copy your project URL and keys from **Settings → API**

### 2. Cloudflare R2

1. Go to [Cloudflare dashboard](https://dash.cloudflare.com) → **R2**
2. Create a bucket named `po-checkin-photos`
3. Enable **Public Access** on the bucket (or set up a custom domain)
4. Go to **R2 → Manage R2 API Tokens** → Create token with **Object Read & Write** on your bucket
5. Note your Account ID, Access Key ID, Secret Access Key, and Public Bucket URL

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=po-checkin-photos
R2_PUBLIC_URL=https://pub-xxxx.r2.dev

SETUP_SECRET=change-me-to-something-secret
```

### 4. Create Users via /setup

Navigate to `/setup?secret=YOUR_SETUP_SECRET` after deployment to create users.

Initial users to create (all as `worker` role):

| Username | Display Name |
|----------|-------------|
| jeffw | Jeff W. |
| andrewc | Andrew C. |
| nigelc | Nigel C. |
| bradf | Brad F. |
| mariol | Mario L. |

To add a supervisor, create one user with `role: supervisor`, or create as worker and promote via Supabase dashboard:
```sql
UPDATE profiles SET role = 'supervisor' WHERE username = 'jeffw';
```

Workers log in with: `username` + their password (the email format `username@checkin.internal` is handled automatically).

### 5. Deploy to Vercel

1. Push this repo to GitHub
2. Connect to [Vercel](https://vercel.com) → Import project
3. Add all environment variables in **Vercel → Settings → Environment Variables**
4. Deploy

---

## User Management

The `/setup?secret=YOUR_SETUP_SECRET` page lets you:
- Create new users (no Supabase dashboard access needed)
- View all existing users
- Delete users

Keep your `SETUP_SECRET` private — it's the only protection on this route.

---

## Local Development

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local with your values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
  (auth)/login/         # Login page
  (worker)/             # Worker screens (scan + history)
  (supervisor)/         # Supervisor dashboard
  api/                  # API routes (upload, submissions, setup)
  setup/                # User management UI
components/
  BarcodeScanner.tsx    # html5-qrcode integration
  CameraCapture.tsx     # Camera with iOS fallback
  SubmissionCard.tsx
  StatusBadge.tsx
lib/
  supabase/             # Client, server, middleware helpers
  r2.ts                 # Cloudflare R2 client
  utils.ts
middleware.ts           # Auth + role-based routing
supabase-schema.sql     # Run in Supabase SQL Editor
```

---

## PWA Installation

**iOS Safari**: Tap the Share button → "Add to Home Screen"

**Android Chrome**: Tap the browser menu → "Add to Home Screen" or "Install app"

Once installed, the app runs fullscreen with no browser chrome — feels native.

---

## Barcode Support

The scanner supports all common warehouse barcodes:
- Code 128, Code 39, Code 93
- QR Code
- EAN-13, EAN-8
- UPC-A, UPC-E
- ITF (Interleaved 2 of 5)
