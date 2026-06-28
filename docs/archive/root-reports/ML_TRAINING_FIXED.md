# ✅ ML Training Script - FIXED

## **Problem:**
- Script couldn't run: "command not found"
- TypeScript syntax errors in JavaScript file

## **Solution:**
✅ Fixed all TypeScript syntax errors  
✅ Script now runs with: `node run-ml-training.js`

## **How to Run:**

### **Option 1: Direct Command**
```bash
node run-ml-training.js
```

### **Option 2: Via Server Endpoint**
- Go to `/admin/ml-dashboard`
- Click "Run Training Cycle" button
- This calls `/api/ml/training/run` which runs the script

### **Option 3: Via npm script (if added)**
```bash
npm run ml:training
```

---

## **Requirements:**

### **Environment Variables:**
Make sure your `.env` file has:
```bash
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

Or:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## **What the Script Does:**

1. ✅ **Collects training data** from match outcomes
2. ✅ **Extracts success patterns** from successful matches
3. ✅ **Analyzes algorithm performance** by GOD score ranges
4. ✅ **Generates recommendations** for weight adjustments
5. ✅ **Tracks performance metrics** over time

---

## **Output:**
The script will:
- Show progress for each step
- Display statistics (matches analyzed, success rates, etc.)
- Save recommendations to `ml_recommendations` table
- Save metrics to `algorithm_metrics` table

---

## **Next Steps:**

1. **Set Environment Variables:**
   - Check your `.env` file
   - Add Supabase credentials if missing

2. **Run the Script:**
   ```bash
   node run-ml-training.js
   ```

3. **View Results:**
   - Go to `/admin/ml-dashboard`
   - See recommendations and metrics

---

## **TypeScript Support:**

If you have `tsx` installed, the script will try to use the full TypeScript service (`mlTrainingService.ts`).  
Otherwise, it uses a direct JavaScript implementation.

To install tsx:
```bash
npm install -D tsx
```

---

**Script is ready to use!** ✅  
Just add your Supabase credentials to `.env` file.

