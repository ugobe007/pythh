# Hot Money Honey - Quick Reference Card

## 🚀 Essential URLs

| Purpose | URL | Shortcut |
|---------|-----|----------|
| **Homepage** | http://localhost:5173/ | Home |
| **Investor Directory** | http://localhost:5173/investors | Browse all |
| **Add Investor** | http://localhost:5173/invite-investor | Add new |
| **Edit Investor** | http://localhost:5173/investor/:id/edit | Edit |
| **Upload Startup** | http://localhost:5173/upload | Submit |
| **Database Setup** | http://localhost:5173/setup | Setup |
| **Admin Review** | http://localhost:5173/admin/review | Review |

---

## ⚡ Quick Actions

### Add Investor (2 minutes)
1. Go to `/invite-investor`
2. Enter: Name + Website
3. Click: "✨ Research with AI"
4. Review → Submit
   
### Edit Investor (1 minute)
1. Go to `/investors`
2. Click: "✏️ Edit Profile"
3. Update fields
4. Click: "💾 Save"

### Remove Duplicates (30 seconds)
1. Go to `/setup`
2. Click: "🔍 Check for Duplicates"
3. Click: "🗑️ Remove Duplicates"
4. Confirm

### Upload Startup (3 minutes)
1. Go to `/upload`
2. Choose: Manual Entry
3. Fill form
4. Submit

---

## 🎯 Common Tasks

| Task | Steps | Time |
|------|-------|------|
| **Initial Setup** | Run SQL migrations → Seed data | 5 min |
| **Add 10 Investors** | Use AI research for each | 20 min |
| **Clean Database** | Check & remove duplicates | 2 min |
| **Review Startups** | Go to /admin/review | 5 min |
| **Update Investor** | Edit profile → AI fill → Save | 2 min |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Error loading investor** | Fixed - IDs now support UUIDs |
| **Can't delete duplicates** | Run fix_delete_policy.sql |
| **AI not working** | Check VITE_OPENAI_API_KEY in .env |
| **No investors showing** | Go to /setup → Seed data |
| **Startup upload fails** | Use Manual Entry method |

---

## 📊 Data Fields Reference

### Investor Fields
- **Required:** name, type, website
- **AI Auto-fills:** tagline, description, check_size, stages, sectors, portfolio_count, exits, unicorns, notable_investments
- **Optional:** linkedin, twitter, contact_email, aum, fund_size, geography

### Startup Fields
- **Required:** name
- **Recommended:** description, website, raise_amount, stage
- **Optional:** tagline, linkedin, raise_type, submitter info

---

## 🤖 AI Research Notes

**Accuracy:**
- ✅ **High:** Name, tagline, description, website
- 🟡 **Medium:** Check size, stages, sectors
- ⚠️ **Variable:** Portfolio stats (depends on public data)
- ❌ **Low:** Contact emails (rarely public)

**Best Practice:**
- Always provide website URL
- Add LinkedIn URL for better results
- Review ALL AI data before saving
- Correct any inaccuracies

---

## 🔐 Admin Panel

**Location:** Bottom-right corner (red panel)

**Links:**
- 🔧 DB Setup → `/setup`
- ✚ Add Investor → `/invite-investor`
- 📋 Review Queue → `/admin/review`

**Visible on:** Home, Investors, Setup, Invite pages

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `ADMIN_GUIDE.md` | Complete admin manual |
| `SYSTEM_FLOWS.md` | Visual flow diagrams |
| `QUICK_REFERENCE.md` | This file |
| `/supabase/migrations/` | Database setup SQL |
| `/src/lib/aiResearch.ts` | AI research service |
| `/src/lib/investorService.ts` | Database operations |

---

## 🆘 Emergency Commands

```bash
# Restart dev server
npm run dev

# Check for errors
npm run build

# Kill stuck process
lsof -ti:5173 | xargs kill -9
```

---

## 📞 Support Checklist

Before asking for help:
- [ ] Check browser console (F12)
- [ ] Check database in Supabase dashboard
- [ ] Verify .env file has all keys
- [ ] Try clearing browser cache
- [ ] Check network tab for API errors
- [ ] Review ADMIN_GUIDE.md

---

**Version:** 1.0.0  
**Last Updated:** November 2, 2025  
**System:** Hot Money Honey Platform
