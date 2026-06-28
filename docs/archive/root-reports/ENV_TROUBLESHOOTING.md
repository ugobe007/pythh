# .env File Troubleshooting 🔧

## Current Issue

The `.env` file is loading but showing **0 variables**. This usually means:

1. **Wrong variable names** - The script looks for specific names
2. **Wrong format** - Quotes, spaces, or special characters
3. **Empty file** - File exists but is empty
4. **Wrong location** - File not in project root

## Required Variables

Your `.env` file MUST have these exact variable names:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
```

## Common Mistakes

### ❌ Wrong: Using anon key
```bash
SUPABASE_ANON_KEY=...  # This won't work!
```

### ✅ Correct: Using service key
```bash
SUPABASE_SERVICE_KEY=...  # This works!
```

### ❌ Wrong: Quotes around values
```bash
VITE_SUPABASE_URL="https://..."
```

### ✅ Correct: No quotes
```bash
VITE_SUPABASE_URL=https://...
```

### ❌ Wrong: Spaces around =
```bash
VITE_SUPABASE_URL = https://...
```

### ✅ Correct: No spaces
```bash
VITE_SUPABASE_URL=https://...
```

## How to Fix

1. **Open your `.env` file** in the project root
2. **Make sure it has these 3 lines** (no quotes, no spaces):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   OPENAI_API_KEY=sk-your-openai-key-here
   ```
3. **Save the file**
4. **Test it**:
   ```bash
   node -e "require('dotenv').config(); console.log('URL:', process.env.VITE_SUPABASE_URL ? 'Found' : 'Missing');"
   ```

## Where to Find Values

- **Supabase URL**: Dashboard → Settings → API → Project URL
- **Service Key**: Dashboard → Settings → API → `service_role` key (NOT anon)
- **OpenAI Key**: https://platform.openai.com/api-keys

## Test Your .env File

Run this to check:
```bash
node -e "require('dotenv').config(); console.log('Variables found:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('OPENAI')).length);"
```

Should show: `Variables found: 3` (or more)





