# SmileNest — Premium Photobooth Experience

SmileNest is a timeless, premium web-based photobooth experience. Designed with a gorgeous, high-end retro aesthetic, it features real-time film filters, custom frames, multi-capture photo strips, animated GIFs, boomerangs, and instant sharing. It also includes a comprehensive administrator dashboard with real-time analytics.

---

## 📷 Features

- **Dynamic Interactive Camera**: Real-time webcam capture with shutter and wind sound effects.
- **Film Simulation Filters**: Professional-grade filters mimicking classic film stocks (e.g., Kodak Gold, Portra, Fuji Chrome, Tri-X B&W).
- **Multiple Formats**:
  - **Single Photo**: A single premium snapshot.
  - **Photo Strip**: A classic 4-photo vertical strip.
  - **GIF**: A custom animated loop compiled client-side.
  - **Boomerang**: A back-and-forth mini video loop.
- **Instant QR Sharing**: Instantly generate QR codes for visitors to view and download their captures.
- **Admin Dashboard**:
  - Real-time analytics tracking visitor telemetry (device, browser, country, sessions).
  - Metrics tracking photo type popularity, filter preference, frame popularity, and downloads.
  - Interactive charts utilizing Recharts.
- **Highly Secure Admin Access**: Secure Edge middleware checking signed sessions and whitelisted admin IDs before granting dashboard access.

---

## 🛠️ Technology Stack

- **Frontend**: [Next.js](https://nextjs.org/) (App Router with custom Node-based Edge Proxy/Middleware), React, Lucide Icons, Recharts.
- **Styling & Animations**: Vanilla CSS custom variables, Framer Motion for elegant spring physics.
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Row-Level Security policies, and Realtime subscriptions).
- **Media Compilation**: Client-side canvas manipulation and GIF rendering.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed.

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Database Setup
Initialize the tables by running the instructions and schema in `schema.sql` in your Supabase SQL Editor.

### 5. Running Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## ☁️ Deployment

This project is fully ready for deployment on [Vercel](https://vercel.com). Make sure to configure the same environment variables listed in `.env.local` inside your Vercel project settings.
