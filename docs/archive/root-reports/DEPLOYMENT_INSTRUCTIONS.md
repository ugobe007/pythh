# Deployment Instructions for [pyth] ai

## Quick Deploy

Run the automated deployment script:

```bash
./deploy-to-fly.sh
```

This script will:
1. Build the app (`npm run build`)
2. Stage all changes (`git add -A`)
3. Commit with a descriptive message
4. Push to the repository
5. Deploy to Fly.io (`flyctl deploy --remote-only`)

---

## Manual Deployment

If you prefer to deploy manually:

### 1. Build the App
```bash
npm run build
```

Verify the build:
```bash
ls -la dist/
```

### 2. Commit Changes
```bash
git add -A
git commit -m "Deploy [pyth] ai updates: rebrand, admin guide, UI improvements"
git push
```

### 3. Deploy to Fly.io
```bash
flyctl deploy --remote-only
```

---

## Verify Deployment

After deployment:

1. **Check Status**:
   ```bash
   flyctl status
   ```

2. **View Logs**:
   ```bash
   flyctl logs
   ```

3. **Open in Browser**:
   ```bash
   flyctl open
   ```

Or visit: `https://hot-honey.fly.dev` (or your configured domain)

---

## Important Notes

### Build Requirements
- The Dockerfile expects a pre-built `dist/` folder
- Make sure `npm run build` completes successfully before deploying
- Environment variables (VITE_SUPABASE_URL, etc.) should be set as Fly.io secrets

### Fly.io Secrets
If you need to update environment variables:

```bash
flyctl secrets set VITE_SUPABASE_URL=your_url
flyctl secrets set VITE_SUPABASE_ANON_KEY=your_key
```

### Auto-Deployment
If GitHub Actions is configured, pushing to `main` branch will automatically deploy. Check `.github/workflows/fly-deploy.yml` for configuration.

---

## Troubleshooting

### Build Fails
- Check Node.js version matches package.json
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript/linting errors

### Deployment Fails
- Check Fly.io status: `flyctl status`
- View logs: `flyctl logs`
- Verify Dockerfile and fly.toml are correct
- Ensure dist/ folder exists and has content

### App Not Loading
- Check if app is running: `flyctl status`
- Verify environment variables are set: `flyctl secrets list`
- Check nginx configuration in nginx.conf
- View real-time logs: `flyctl logs --follow`

---

## For Andy - Access Information

Once deployed, Andy can access:

1. **Main Landing Page**: `https://hot-honey.fly.dev`
2. **Admin Dashboard**: `https://hot-honey.fly.dev/admin/dashboard`
3. **GOD Settings**: `https://hot-honey.fly.dev/admin/god-settings`
4. **ML Dashboard**: `https://hot-honey.fly.dev/admin/ml-dashboard`
5. **Industry Rankings**: `https://hot-honey.fly.dev/admin/industry-rankings`

**Note**: Andy will need to be logged in as an admin user to access admin pages.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `flyctl status` | Check app status and URL |
| `flyctl logs` | View application logs |
| `flyctl open` | Open app in browser |
| `flyctl secrets list` | View environment variables |
| `flyctl secrets set KEY=value` | Set environment variable |
| `flyctl deploy` | Deploy app |
| `flyctl deploy --remote-only` | Deploy without local Docker |

---

**Ready to deploy? Run `./deploy-to-fly.sh` and follow the prompts!** 🚀
