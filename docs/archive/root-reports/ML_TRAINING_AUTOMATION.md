# ML Training Automation Guide

## Overview

ML training can now be automated to run on a schedule. This document explains how to set it up.

## Quick Start

### Option 1: Run Once (Manual)
```bash
npm run ml:train
```

### Option 2: Schedule with Node-Cron (Recommended)
```bash
# Run continuously with daily schedule (3 AM)
npm run ml:train:daemon
```

### Option 3: PM2 (Production)
```bash
# Start as PM2 process
pm2 start scripts/cron/ml-training-scheduler.js --name ml-training -- --daemon

# Save PM2 configuration
pm2 save

# Set PM2 to start on system reboot
pm2 startup
```

## Schedule Configuration

### Default Schedule
- **Default**: Daily at 3 AM (`0 3 * * *`)
- **Configurable**: Set `ML_TRAINING_SCHEDULE` environment variable

### Common Schedules

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Daily 3 AM | `0 3 * * *` | Once per day (default) |
| Twice Daily | `0 3,15 * * *` | 3 AM and 3 PM |
| Every 6 Hours | `0 */6 * * *` | 00:00, 06:00, 12:00, 18:00 |
| Weekly | `0 0 * * 0` | Sunday at midnight |
| Every 12 Hours | `0 */12 * * *` | 00:00 and 12:00 |

### Setting Custom Schedule

**Method 1: Environment Variable**
```bash
export ML_TRAINING_SCHEDULE="0 */6 * * *"  # Every 6 hours
npm run ml:train:daemon
```

**Method 2: .env File**
```bash
# Add to .env file
ML_TRAINING_SCHEDULE=0 */6 * * *
```

## How It Works

1. **Scheduler Script**: `scripts/cron/ml-training-scheduler.js`
   - Uses `node-cron` for scheduling
   - Runs `run-ml-training.js` as a child process
   - Handles errors and logging

2. **Training Script**: `run-ml-training.js`
   - Collects match outcomes
   - Extracts success patterns
   - Generates recommendations
   - Updates algorithm weights

3. **Output**: 
   - Recommendations saved to `ml_recommendations` table
   - Metrics saved to `algorithm_metrics` table
   - Logs output to console

## Monitoring

### Check if Scheduler is Running
```bash
# If using PM2
pm2 list
pm2 logs ml-training

# If using node directly
ps aux | grep ml-training-scheduler
```

### View Training Logs
```bash
# PM2 logs
pm2 logs ml-training --lines 100

# Check last training results
# (Check ml_recommendations table in database)
```

### Manual Run (for testing)
```bash
npm run ml:train
```

## Recommended Schedule

### For Development
- **Schedule**: Daily at 3 AM
- **Reason**: Low traffic time, fresh data daily
- **Command**: `npm run ml:train:daemon`

### For Production
- **Schedule**: Every 6 hours (`0 */6 * * *`)
- **Reason**: More frequent updates, better responsiveness
- **Command**: 
  ```bash
  ML_TRAINING_SCHEDULE="0 */6 * * *" npm run ml:train:daemon
  ```

### For High-Traffic Systems
- **Schedule**: Every 12 hours (`0 */12 * * *`)
- **Reason**: Balance between freshness and resource usage
- **Command**:
  ```bash
  ML_TRAINING_SCHEDULE="0 */12 * * *" npm run ml:train:daemon
  ```

## Troubleshooting

### Training Returns "0 matches"
- **Cause**: No match feedback data available
- **Solution**: Wait for matches to be generated and feedback to be collected
- **Note**: This is normal if you're just starting

### Scheduler Not Running
- **Check**: `ps aux | grep ml-training-scheduler`
- **Restart**: `npm run ml:train:daemon`
- **PM2**: `pm2 restart ml-training`

### Training Takes Too Long
- **Cause**: Large dataset
- **Solution**: Training script already limits to recent data (last week)
- **Note**: Training runs in background, won't block other processes

### Recommendations Not Appearing
- **Check**: Database connection
- **Check**: `ml_recommendations` table exists
- **Check**: Training completed successfully (check logs)
- **Note**: Recommendations only created if there are actual weight changes

## Integration with Existing Automation

The ML training scheduler is independent but can be integrated with your existing automation:

1. **PM2 Ecosystem**: Add to `ecosystem.config.js`
2. **System Cron**: Use system cron instead of node-cron
3. **Automation Engine**: Add as a job to `automation-engine.js`

## Next Steps

1. **Start the scheduler**:
   ```bash
   npm run ml:train:daemon
   ```

2. **Monitor first run**:
   - Check console output
   - Verify recommendations in database
   - Review logs for errors

3. **Adjust schedule** as needed based on your data volume

4. **Set up PM2** for production deployment (recommended)
