# 🔄 Reset .env File - Bash Commands

## **Option 1: Use the Reset Script (Recommended)**

```bash
# Make script executable and run it
chmod +x reset-env.sh
./reset-env.sh
```

This will:
- ✅ Backup your current `.env` file
- ✅ Create a clean template with correct format
- ✅ Show you what to do next

---

## **Option 2: Manual Reset (Copy/Paste These Commands)**

```bash
# 1. Backup existing .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# 2. Create clean .env template
cat > .env << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=
SUPABASE_SERVICE_KEY=
EOF

# 3. Verify it was created
cat .env

# 4. Now edit and add your credentials
# (use nano, vim, or your preferred editor)
```

---

## **Option 3: One-Line Reset**

```bash
cp .env .env.backup.$(date +%Y%m%d_%H%M%S) && echo "VITE_SUPABASE_URL=
SUPABASE_SERVICE_KEY=" > .env && echo "✅ .env reset! Now edit it and add your credentials."
```

---

## **After Resetting:**

1. **Edit the .env file:**
   ```bash
   nano .env
   # or
   code .env
   # or your preferred editor
   ```

2. **Add your credentials in this format:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Save the file** (Ctrl+X, then Y, then Enter if using nano)

4. **Verify it works:**
   ```bash
   node check-env.js
   ```

5. **Test ML training:**
   ```bash
   node run-ml-training.js
   ```

---

## **Quick Reference:**

```bash
# Reset .env
./reset-env.sh

# Edit .env
nano .env

# Check credentials
node check-env.js

# Run ML training
node run-ml-training.js
```

---

**Important:** 
- ✅ No spaces around `=`
- ✅ No quotes around values
- ✅ One variable per line
- ✅ File must be named `.env` (not `.env.txt`)

