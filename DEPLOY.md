# TripPlanner - Deployment Guide

## Quick Deploy to Netlify via GitHub

### Step 1: Initialize Git Repository (in your terminal)

Open a new terminal (PowerShell or Git Bash) and run:

```bash
cd c:\Data\Projects\TripPlanner
git init
git add .
git commit -m "Initial commit - TripPlanner app"
```

### Step 2: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Create a new repository named `trip-planner` (or your preferred name)
3. **Don't** add README, .gitignore, or license (we already have these)
4. Click **Create repository**

### Step 3: Push to GitHub

Copy the commands from GitHub (they'll look like this):

```bash
git remote add origin https://github.com/YOUR_USERNAME/trip-planner.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy on Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select your `trip-planner` repository
5. Netlify auto-detects settings from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click **"Deploy site"**

### Step 5: Configure Environment Variables (CRITICAL!)

1. In Netlify, go to **Site settings** → **Environment variables**
2. Add these variables from your `.env.local` file:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

3. **Trigger a redeploy** after adding variables:
   - Go to **Deploys** → **Trigger deploy** → **Deploy site**

### Step 6: Custom Domain (Optional)

1. Go to **Domain settings**
2. Add your custom domain or use the free `.netlify.app` subdomain

---

## Troubleshooting

### "Page not found" on refresh
The `netlify.toml` file handles this with redirects. Make sure it's committed.

### Environment variables not working
- Ensure variable names start with `VITE_`
- Redeploy after adding variables

### Build fails
Check the deploy logs in Netlify for specific errors.

---

## Auto-Deploy

Once connected, every push to your `main` branch will automatically trigger a new deployment!

```bash
# Make changes, then:
git add .
git commit -m "Your update message"
git push
```

Netlify will automatically build and deploy your changes.
