import google.genai as genai
import random
import requests
import os
from flask import Flask, request

app = Flask(__name__)

api_keys = [
    "AIzaSyAlDpkpeYccwgB-R8SaA5R1vkJPD1_dg70",
    "AIzaSyB5HP0HeZGeycNw7_LEZUvv03TKVBYqUTw",
    "AIzaSyDUX4JjX-972MENW-LZPrMPzwRXRB3e5SA",
    "AIzaSyBVUXS-f8zvCCOEcWoFLxciPKfCbweyW5E",
    "AIzaSyB17DJ1VkdFWHWoQmb7QW3TqXHsh7653wI",
    "AIzaSyCYbCGSrwZjmOuvp4GnHmkYvcuApamdnPA",
    "AIzaSyB-sB1u7ZV-mUfkqODzj094kI_proUX724"
]

INSTANCE_ID = "instance174706"
TOKEN = "qrn82b1e4nhighdl"

def get_ai_response(user_text):
    selected_key = random.choice(api_keys)
    client = genai.Client(api_key=selected_key)
    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=user_text
        )
        return response.text
    except:
        return "Ka thluak a lum deuh a, nakinah min lo zawt leh rawh."

def send_whatsapp(to, message):
    url = f"https://api.ultramsg.com/{INSTANCE_ID}/messages/chat"
    payload = {"token": TOKEN, "to": to, "body": message}
    headers = {'content-type': 'application/x-www-form-urlencoded'}
    requests.post(url, data=payload, headers=headers)

@app.route('/', methods=['POST', 'GET'])
def whatsapp_webhook():
    if request.method == 'GET':
        return "Bot is Live!", 200
        
    data = request.json
    try:
        if data and 'data' in data:
            msg = data['data'].get('body', '')
            sender = data['data'].get('from', '')
            if msg.lower().startswith("bot"):
                query = msg.replace("bot", "").strip()
                ans = get_ai_response(query)
                send_whatsapp(sender, ans)
    except:
        pass
    return "OK", 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
