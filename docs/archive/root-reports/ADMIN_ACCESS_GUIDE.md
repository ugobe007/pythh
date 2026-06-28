# 🔐 Admin Access Guide

## How to Become an Admin

### Step 1: Login with Admin Email
Your email must contain **"admin"** or **"ugobe"** to be recognized as an admin.

**Examples:**
- ✅ `admin@hotmoney.com`
- ✅ `robert@ugobe.com`
- ✅ `adminuser@gmail.com`
- ❌ `robert@gmail.com` (regular user)

### Step 2: Verify Admin Status
After logging in, you should see:
- 🐝 **Mr. Bee Head** icon in your profile button (upper right)
- 🔐 **ADMIN Panel** appears at bottom-right corner of front page

---

## How to Access Admin Dashboard

### Option 1: Via Admin Panel (Recommended)
**Location:** Bottom-right corner of front page (`/home`)

**Links Available:**
- 🔧 **DB Setup** → `/admin/setup`
- ➕ **Add Investor** → `/invite-investor`
- 📋 **Review Queue** → `/admin/review`
- ✏️ **Edit Startups** → `/admin/edit-startups`

### Option 2: Via Floating Navigation
**Location:** Top center of any page (when logged in as admin)

Click **👑 ADMIN** button to reveal dropdown menu:
- 👑 **Admin Dashboard** → `/admin/dashboard`
- 📋 **Review Queue** → `/admin/review`
- ✏️ **Edit Startups** → `/admin/edit-startups`
- 🚀 **Bulk Import** → `/admin/bulk-import`
- ⚙️ **DB Setup** → `/admin/setup`
- 🔍 **Diagnostic** → `/admin/diagnostic`

### Option 3: Direct URL
Navigate to: `http://localhost:5173/admin/dashboard`

---

## Admin Features & Workflow

### 1️⃣ Bulk Upload Workflow
```
Bulk Import → Upload 24 startups
       ↓
Admin Dashboard → See orange alert "🎯 24 Startup(s) Awaiting Review"
       ↓
Edit Startups → Review and Bulk Approve
       ↓
Vote Page → Verify startups are visible
```

### 2️⃣ Edit Startups Page (`/admin/edit-startups`)
**Features:**
- View all startups (Pending, Approved, Rejected)
- Edit individual startups
- Bulk Approve pending startups
- Mark startups "Under Review" to exclude from bulk approval
- Redirects to Admin Dashboard after approval

### 3️⃣ Admin Dashboard (`/admin/dashboard`)
**Shows:**
- 📊 Total Startups count
- ⏳ Pending Startups count (with orange alert)
- ✅ Approved Startups count
- ❌ Rejected Startups count

**Quick Actions:**
- 📝 Edit & Approve Startups
- 🚀 Bulk Import
- 🗳️ Vote Page
- 📥 Submit Startup

---

## Session Persistence

### ✅ YES - Admin stays logged in during inactivity
**How it works:**
- User data stored in `localStorage` (key: `currentUser`)
- Session survives browser refresh
- Session survives computer sleep/restart
- Only cleared by explicit logout or clearing browser data

### 🔓 How to Logout
Click **🚪 Log Out** button (upper right corner)

---

## Visibility Rules

### 🔐 Admin Panel (Bottom-Right)
| Page | Visibility |
|------|-----------|
| Front Page (`/`) | ✅ Shows only if logged in as admin |
| Other Pages | ❌ Not displayed |

### 👑 Admin Dropdown (Top Navigation)
| User Type | Visibility |
|-----------|-----------|
| Admin | ✅ Shows on all pages |
| Regular User | ❌ Hidden |
| Not Logged In | ❌ Hidden |

---

## Testing Admin Access

### Test 1: Verify Admin Panel Only Shows for Admins
1. Logout (if logged in)
2. Go to front page (`/`)
3. ❌ Should NOT see 🔐 ADMIN panel
4. Login with `admin@test.com`
5. ✅ Should SEE 🔐 ADMIN panel

### Test 2: Verify Session Persistence
1. Login as admin
2. Close browser
3. Reopen browser
4. Go to `/admin/dashboard`
5. ✅ Should still be logged in (not redirected to home)

### Test 3: Verify Non-Admin Redirect
1. Login with `user@test.com` (no "admin" in email)
2. Try to visit `/admin/dashboard`
3. ✅ Should redirect to home page (`/`)

---

## Common Issues

### Issue: Admin panel shows even when not logged in
**Solution:** ✅ FIXED - Updated `AdminNav.tsx` to check `user?.isAdmin`

### Issue: Blank page after bulk upload
**Solution:** Navigate to `/admin/edit-startups` to verify uploads saved

### Issue: Can't access admin pages
**Solution:** Ensure your email contains "admin" or "ugobe"

### Issue: Admin dropdown not showing
**Solution:** Verify you're logged in and check `localStorage` for `currentUser`

---

## Code References

### Auth Check Logic
```typescript
// AuthContext.tsx (Line 36)
isAdmin: email.includes('admin') || email.includes('ugobe')
```

### Admin Panel Component
```typescript
// AdminNav.tsx (Line 10)
if (!user?.isAdmin) return null;
```

### Admin Dashboard Auth
```typescript
// AdminDashboard.tsx (Line 29)
if (!user?.isAdmin) {
  navigate('/');
  return;
}
```
