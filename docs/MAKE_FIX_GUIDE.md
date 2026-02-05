# 🚨 Make.com Scenario Fix - Missing Facebook Module

## Problem Identified

The Make.com scenario investigation revealed that the **Facebook Pages module has been accidentally deleted** from your scenario. The webhook is still active and working, but there's no module to process the data and post to Facebook.

### Evidence from Investigation

![Make.com Diagnosis Recording](file:///C:/Users/uers/.gemini/antigravity/brain/63bf6dec-04cf-4a57-9676-6f4365ff06b1/make_webhook_diagnosis_1770324682259.webp)

**Key Findings:**
- ✅ **Webhook is active**: `https://hook.eu1.make.com/idlpye8lhrearyi2yk7r4k9ygncv09y`
- ❌ **Facebook module is missing**: Only the webhook module is visible in the editor
- 📊 **History shows it worked**: Logs show successful Facebook posts as recently as 6:03 PM today
- ⚠️ **Recent edits**: Changes were made between 8:19 PM - 8:57 PM that may have removed the module

## Quick Fix Steps

### 1. Re-add the Facebook Module

1. **Open your scenario**: [Click here to edit](https://eu1.make.com/917446/scenarios/4294218/edit)
2. **Click the "+" button** next to the webhook module
3. **Search for "Facebook Pages"**
4. **Select "Create a Post"**

### 2. Configure the Facebook Module

Once added, configure it with these mappings:

| Field | Value | How to Map |
|-------|-------|------------|
| **Page** | Select your Facebook page | Choose from dropdown |
| **Message** | `{{1.message}}` | Click field → Select "message" from webhook data |
| **Link** | `{{1.link}}` | Click field → Select "link" from webhook data |
| **Photo URL** | `{{1.photo}}` | Click field → Select "photo" from webhook data |

> **Note**: The `{{1.message}}` notation means "get the 'message' field from module 1 (the webhook)"

### 3. Test the Connection

1. Click **"Run once"** at the bottom
2. The scenario will wait for data
3. Open a new terminal and run:

```powershell
# Test locally (replace with your actual webhook URL)
$env:MAKE_WEBHOOK_URL="https://hook.eu1.make.com/idlpye8lhrearyi2yk7r4k9ygncv09y"
node scrapers/notify_webhook.js
```

4. Check Make.com - you should see the execution complete
5. Check Facebook - the post should appear

### 4. Save and Activate

1. Click **"Save"** (bottom toolbar)
2. Ensure the scenario is **ON** (toggle in top-right)

## Visual Guide

### Current State (Missing Module)
Your scenario currently looks like this:
```
┌──────────────┐
│   Webhook    │
└──────────────┘
```

### Target State (Fixed)
It should look like this:
```
┌──────────────┐     ┌──────────────────┐
│   Webhook    │────▶│ Facebook Pages   │
└──────────────┘     │  Create a Post   │
                     └──────────────────┘
```

## Detailed Configuration

### Webhook Data Structure
The webhook sends this JSON structure:
```json
{
  "id": "match_12345",
  "title": "🔥 مباراة حاسمة: Real Madrid 🆚 Barcelona",
  "league": "La Liga",
  "time": "20:00",
  "link": "https://livematch-991.pages.dev/watch.html?match=12345",
  "message": "🌟 مباراة اليوم المباشرة\n\n🆚 Real Madrid ضد Barcelona...",
  "photo": "https://livematch-991.pages.dev/posters/12345.jpg"
}
```

### Facebook Module Settings

**Connection**: Use your existing Facebook connection (it's still active in your account)

**Post Configuration**:
- **Message Type**: Text with Link
- **Message**: Map to `{{1.message}}` - This contains the full Arabic text with emojis
- **Link**: Map to `{{1.link}}` - Direct link to the watch page
- **Photo URL**: Map to `{{1.photo}}` - URL to the generated poster image

**Advanced Options** (optional):
- **Published**: Yes (post immediately)
- **Scheduled**: Leave empty (post now)

## Troubleshooting

### "Cannot find webhook data"
- Make sure you clicked "Run once" before testing
- The scenario must be waiting for data when you send the webhook

### "Photo not loading"
- Ensure poster images are being generated (check `public/posters/` directory)
- Verify the poster URLs are publicly accessible
- The GitHub workflow now commits posters automatically

### "Permission denied"
- Reconnect your Facebook account in Make.com
- Ensure the page has `pages_manage_posts` permission

## Prevention

To avoid accidentally deleting modules in the future:
1. **Use version control**: Make.com keeps a history of scenario changes
2. **Test before saving**: Always run once before saving major changes
3. **Duplicate scenarios**: Keep a backup copy of working scenarios

## Need More Help?

If you're still having issues:
1. Check the [full setup guide](./MAKE_WEBHOOK_SETUP.md)
2. Review Make.com execution logs for specific errors
3. Verify GitHub secrets are correctly set

---

**Status**: 🔧 Ready to fix - Follow steps above to restore Facebook posting
