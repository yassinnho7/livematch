import urllib.request
import json
import ssl

webhook_url = "YOUR_MAKE_WEBHOOK_URL_HERE"

payload = {
    "id": "verify_test_001",
    "title": "🧪 تجربة النشر المباشر",
    "league": "Test League",
    "time": "NOW",
    "link": "https://github.com/yassinnho7/livematch",
    "message": "🔥 هذا منشور تجريبي للتأكد من نظام النشر التلقائي!\n\nصورة الملعب الليلي: stadium_night.png 🏟️\nتم الارسال بنجاح عبر البرمجية.",
    "photo": "IMAGE_URL_HERE"
}

data = json.dumps(payload).encode('utf-8')

# Create unverified context if needed (though not recommended, helps troubleshoot SSL issues)
context = ssl._create_unverified_context()

req = urllib.request.Request(webhook_url, data=data, headers={'Content-Type': 'application/json'})

print(f"Sending test webhook to: {webhook_url}")
try:
    with urllib.request.urlopen(req, context=context) as response:
        status = response.getcode()
        body = response.read().decode('utf-8')
        print(f"Status Code: {status}")
        print(f"Response Body: {body}")
except Exception as e:
    print(f"Error: {e}")
