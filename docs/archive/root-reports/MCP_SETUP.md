# MCP Server Setup Guide

This guide explains how to configure and use the Model Context Protocol (MCP) servers for Hot Honey.

## Available MCP Servers

### 1. Resend (Email Service)
- **Purpose**: Send emails via Resend API
- **Status**: Already integrated in project (`resend` package installed)
- **Configuration**: Requires `RESEND_API_KEY` environment variable

### 2. TestSprite (Testing Tool)
- **Purpose**: Automated testing and quality assurance
- **Status**: Needs API key configuration
- **Configuration**: Requires `TESTSPRITE_API_KEY` environment variable

## Setup Instructions

### Step 1: Get API Keys

#### Resend API Key
1. Go to https://resend.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `re_`)

#### TestSprite API Key
1. Go to https://testsprite.com/ (or check their documentation)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Resend Email Service
RESEND_API_KEY=re_your_resend_api_key_here

# TestSprite Testing Service
TESTSPRITE_API_KEY=your_testsprite_api_key_here
```

### Step 3: Configure Cursor IDE MCP

The MCP configuration file is located at `~/.cursor/mcp.json`. Update it with your API keys:

```json
{
  "mcpServers": {
    "Resend": {
      "name": "Resend",
      "url": "https://resend.com/docs/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_RESEND_API_KEY"
      }
    },
    "TestSprite": {
      "command": "npx @testsprite/testsprite-mcp@latest",
      "env": {
        "API_KEY": "YOUR_TESTSPRITE_API_KEY"
      },
      "args": []
    }
  }
}
```

**Note**: Replace `YOUR_RESEND_API_KEY` and `YOUR_TESTSPRITE_API_KEY` with your actual keys.

### Step 4: Restart Cursor IDE

After updating the MCP configuration, restart Cursor IDE for changes to take effect.

## Usage

### Resend MCP Server

The Resend MCP server allows you to:
- Send emails directly from Cursor IDE
- Test email templates
- Check email delivery status

**Example Usage in Cursor:**
```
@Resend send email to user@example.com with subject "Welcome" and body "Hello!"
```

### TestSprite MCP Server

The TestSprite MCP server allows you to:
- Run automated tests
- Generate test reports
- Check code quality

**Example Usage in Cursor:**
```
@TestSprite run tests for MatchingEngine component
```

## Current Project Integration

### Resend Integration

The project already uses Resend in several places:
- `server/services/emailNotifications.ts` - Admin notifications
- `server/services/dailyReport.ts` - Daily reports
- `server/services/email.service.ts` - General email service

**Current Usage:**
```typescript
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
```

### TestSprite Integration

TestSprite can be used to:
- Test the matching engine
- Validate API endpoints
- Check frontend components
- Run integration tests

## Troubleshooting

### MCP Server Not Working

1. **Check API Keys**: Ensure keys are correctly set in both `.env` and `~/.cursor/mcp.json`
2. **Restart Cursor**: MCP servers require IDE restart to load new configuration
3. **Check Logs**: Look for MCP-related errors in Cursor's developer console

### Resend Not Sending Emails

1. Verify `RESEND_API_KEY` is set in `.env`
2. Check Resend dashboard for API usage and errors
3. Ensure domain is verified in Resend (for production)

### TestSprite Not Running

1. Verify `TESTSPRITE_API_KEY` is set
2. Check TestSprite documentation for latest setup instructions
3. Ensure `npx @testsprite/testsprite-mcp@latest` is accessible

## Security Notes

- **Never commit API keys** to version control
- Use `.env` file (already in `.gitignore`)
- Rotate API keys regularly
- Use environment-specific keys (dev/staging/prod)

## Next Steps

1. ✅ Add API keys to `.env` file
2. ✅ Update `~/.cursor/mcp.json` with API keys
3. ✅ Restart Cursor IDE
4. ✅ Test MCP server functionality
5. ✅ Integrate TestSprite for automated testing

## Resources

- [Resend Documentation](https://resend.com/docs)
- [TestSprite Documentation](https://testsprite.com/docs)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)


