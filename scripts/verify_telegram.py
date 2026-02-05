import urllib.request
import json
import ssl

token = "YOUR_TELEGRAM_BOT_TOKEN_HERE"
chat_id = "YOUR_CHAT_ID_HERE"
message = "🚀 <b>تجربة بث مباشر ناجحة!</b>\n\nنظام الإشعارات الآلي يعمل الآن.\nرابط الموقع: https://livematch-991.pages.dev"

url = f"https://api.telegram.org/bot{token}/sendPhoto"
payload = {
    "chat_id": chat_id,
    "photo": "https://raw.githubusercontent.com/yassinnho7/livematch/main/public/assets/backgrounds/stadium_night.png",
    "caption": message,
    "parse_mode": "HTML"
}

data = json.dumps(payload).encode('utf-8')
context = ssl._create_unverified_context()

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

print(f"Sending test Telegram message to: {chat_id}")
try:
    with urllib.request.urlopen(req, context=context) as response:
        status = response.getcode()
        body = response.read().decode('utf-8')
        print(f"Status Code: {status}")
        print(f"Response Body: {body}")
except Exception as e:
    print(f"Error: {e}")
