# ML Training Automation - Setup Complete ✅

## Summary

ML training has been successfully integrated into your automation infrastructure:

1. ✅ **Scheduler Script Created** - `scripts/cron/ml-training-scheduler.js`
2. ✅ **PM2 Configuration Added** - `ecosystem.config.js`
3. ✅ **Autopilot Integration** - Added to `scripts/core/hot-match-autopilot.js`
4. ✅ **NPM Scripts Added** - Easy commands for running

## Files Created/Modified

### 1. Scheduler Script
- **File**: `scripts/cron/ml-training-scheduler.js`
- **Purpose**: Standalone scheduler using node-cron
- **Usage**: 
  - `npm run ml:train:scheduler` - Run once
  - `npm run ml:train:daemon` - Run continuously

### 2. PM2 Configuration
- **File**: `ecosystem.config.js` (root)
- **Added**: `ml-training-scheduler` process
- **Schedule**: Daily at 3 AM (configurable via `ML_TRAINING_SCHEDULE` env var)

### 3. Autopilot Integration
- **File**: `scripts/core/hot-match-autopilot.js`
- **Added**: `runMLTraining()` function
- **Added**: ML training to daemon loop (daily, 3-4 AM)
- **Interval**: 24 hours

### 4. NPM Scripts
- **Added to `package.json`**:
  - `npm run ml:train` - Run training once
  - `npm run ml:train:scheduler` - Run via scheduler once
  - `npm run ml:train:daemon` - Run scheduler in daemon mode

## Usage Options

### Option 1: Standalone Scheduler (Recommended for Production)
```bash
# Start as PM2 process
pm2 start ecosystem.config.js --only ml-training-scheduler

# Or start directly
npm run ml:train:daemon
```

### Option 2: Via Autopilot (Integrated)
```bash
# ML training runs automatically as part of autopilot
pm2 start scripts/core/hot-match-autopilot.js --name autopilot -- --daemon
```

### Option 3: Manual Run
```bash
# Run training once
npm run ml:train
```

## Schedule Configuration

### Default Schedule
- **Frequency**: Daily at 3 AM
- **Configurable**: Set `ML_TRAINING_SCHEDULE` environment variable

### Common Schedules

| Schedule | Cron Expression | Use Case |
|----------|----------------|----------|
| Daily 3 AM | `0 3 * * *` | Default (recommended) |
| Twice Daily | `0 3,15 * * *` | Higher frequency |
| Every 6 Hours | `0 */6 * * *` | Very frequent |
| Weekly | `0 0 * * 0` | Low frequency |

### Setting Custom Schedule

**PM2 (ecosystem.config.js)**:
```javascript
env: {
  ML_TRAINING_SCHEDULE: '0 */6 * * *'  // Every 6 hours
}
```

**Direct Run**:
```bash
ML_TRAINING_SCHEDULE="0 */6 * * *" npm run ml:train:daemon
```

**Autopilot**: Edit `CONFIG.ML_TRAINING_INTERVAL` in `hot-match-autopilot.js`

## Monitoring

### Check Status
```bash
# PM2
pm2 list
pm2 logs ml-training-scheduler

# Autopilot
pm2 logs autopilot | grep "ML TRAINING"
```

### View Training Results
- Check `ml_recommendations` table in database
- View ML Dashboard: `/admin/ml-dashboard`

## Next Steps

1. **Test the scheduler**:
   ```bash
   npm run ml:train:scheduler
   ```

2. **Start with PM2** (production):
   ```bash
   pm2 start ecosystem.config.js --only ml-training-scheduler
   pm2 save
   ```

3. **Or use autopilot** (integrated approach):
   ```bash
   pm2 start scripts/core/hot-match-autopilot.js --name autopilot -- --daemon
   ```

4. **Monitor first runs** to ensure everything works correctly

## Notes

- Training runs automatically once match feedback data is available
- Recommendations only created when there are actual weight changes
- All runs are logged for monitoring
- Training runs in background, doesn't block other processes
