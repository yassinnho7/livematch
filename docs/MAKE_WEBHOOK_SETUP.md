# 🔗 Make.com Webhook Setup Guide

This guide explains how to configure Make.com to automatically post match notifications to Facebook when new matches are detected.

## 📋 Overview

The system sends match data via webhook to Make.com, which then:
1. Receives the match payload (JSON)
2. Formats it for Facebook
3. Posts to your Facebook Page with the generated poster image

## 🛠️ Make.com Scenario Setup

### Step 1: Create a New Scenario

1. Go to [Make.com](https://www.make.com) and log in
2. Click **"Create a new scenario"**
3. Name it: `LiveMatch Auto-Poster`

### Step 2: Add Webhook Trigger

1. Click the **+** button to add a module
2. Search for **"Webhooks"**
3. Select **"Custom webhook"**
4. Click **"Create a webhook"**
5. Name it: `LiveMatch Notifications`
6. Click **"Save"**
7. **Copy the webhook URL** (it will look like: `https://hook.eu1.make.com/xxxxxxxxxxxxx`)

### Step 3: Configure Data Structure

The webhook will receive the following JSON payload:

```json
{
  "id": "match_12345",
  "title": "🔥 مباراة حاسمة: Real Madrid 🆚 Barcelona",
  "league": "La Liga",
  "time": "20:00",
  "link": "https://your-site.pages.dev/watch.html?match=12345",
  "message": "🌟 مباراة اليوم المباشرة\n\n🆚 Real Madrid ضد Barcelona\n\n🚩 البطولة: La Liga\n⏳ التوقيت: 20:00 GMT\n🖥️ الجودة: Full HD\n\n🔗 رابط البث: https://your-site.pages.dev/watch.html?match=12345\n\n⚽ لا تفوت الإثارة، تابع الصفحة لمباريات الغد!",
  "photo": "https://your-site.pages.dev/posters/12345.jpg"
}
```

### Step 4: Add Facebook Module

1. Click the **+** button after the webhook
2. Search for **"Facebook Pages"**
3. Select **"Create a Post"**
4. Connect your Facebook account and select your page
5. Configure the post:
   - **Message**: Map to `{{message}}` from webhook
   - **Link**: Map to `{{link}}` from webhook
   - **Photo URL**: Map to `{{photo}}` from webhook

### Step 5: Add Error Handling (Optional but Recommended)

1. Right-click on the Facebook module
2. Select **"Add error handler"**
3. Add a **"Ignore"** module to prevent scenario failures

### Step 6: Test the Webhook

1. Click **"Run once"** in Make.com
2. The scenario will wait for data
3. Run this command locally to test:

```bash
# Windows PowerShell
$env:MAKE_WEBHOOK_URL="YOUR_WEBHOOK_URL_HERE"
node scrapers/notify_webhook.js
```

4. Check Make.com - you should see the data received
5. Check your Facebook page - the post should appear

## 🔐 GitHub Secrets Configuration

Add the webhook URL to your GitHub repository secrets:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `MAKE_WEBHOOK_URL`
5. Value: Paste your Make.com webhook URL
6. Click **"Add secret"**

## 📊 Payload Fields Explained

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | String | Unique match identifier | `"match_12345"` |
| `title` | String | Match title in Arabic | `"🔥 مباراة حاسمة: Real Madrid 🆚 Barcelona"` |
| `league` | String | League/competition name | `"La Liga"` |
| `time` | String | Match time (GMT) | `"20:00"` |
| `link` | String | Direct link to watch page | `"https://site.com/watch.html?match=12345"` |
| `message` | String | Full formatted message for Facebook | See example above |
| `photo` | String | URL to generated poster image | `"https://site.com/posters/12345.jpg"` |

## ⚙️ Advanced Configuration

### Quiet Hours

The notification script automatically skips sending webhooks between **4 AM - 9 AM GMT** to save Make.com operations. You can modify this in `scrapers/notify_webhook.js`:

```javascript
// Line 23-27
const gmtHour = new Date().getUTCHours();
if (gmtHour >= 4 && gmtHour < 9) {
    console.log(`🕒 Quiet hours. Skipping webhook.`);
    return;
}
```

### Notification Window

Matches are notified within a **30-minute window** (±30 mins from start time):

```javascript
// Line 49
const isSoon = timeUntilStart > -1800 && timeUntilStart < 1800;
```

### Duplicate Prevention

The system tracks sent notifications in `sent_notifications.json` to prevent duplicate posts.

## 🐛 Troubleshooting

### Webhook Not Receiving Data

1. **Check GitHub Actions logs**: Go to Actions tab → Latest workflow run
2. **Verify secret is set**: Settings → Secrets → Check `MAKE_WEBHOOK_URL` exists
3. **Test locally**: Run `node scrapers/notify_webhook.js` with env var set

### Facebook Post Fails

1. **Check permissions**: Ensure Facebook app has `pages_manage_posts` permission
2. **Verify page access**: Make sure the connected account can post to the page
3. **Image URL**: Ensure poster URLs are publicly accessible (not localhost)

### No Matches Being Notified

1. **Check timing**: Notifications only sent within 30-min window
2. **Check quiet hours**: No notifications 4-9 AM GMT
3. **Check history**: Match may already be in `sent_notifications.json`

## 📈 Make.com Operations Usage

- **Free tier**: 1,000 operations/month
- **Each notification**: ~2 operations (webhook + Facebook post)
- **With quiet hours**: ~500 notifications/month possible
- **Recommended**: Pro plan for high-traffic pages

## 🔄 Workflow Integration

The webhook is automatically called by GitHub Actions every 7 minutes:

```yaml
- name: Notify Webhook (Make.com)
  env:
    MAKE_WEBHOOK_URL: ${{ secrets.MAKE_WEBHOOK_URL }}
  run: |
    node scrapers/notify_webhook.js
```

## ✅ Verification Checklist

- [ ] Make.com scenario created
- [ ] Webhook URL copied
- [ ] Facebook module configured
- [ ] GitHub secret `MAKE_WEBHOOK_URL` added
- [ ] Test webhook successful
- [ ] Facebook post appeared
- [ ] Error handling configured
- [ ] Scenario activated (turned ON)

## 📞 Support

If you encounter issues:
1. Check Make.com execution history for errors
2. Review GitHub Actions logs
3. Verify all secrets are correctly set
4. Ensure poster images are publicly accessible
