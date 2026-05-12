import google.genai as genai
import random
import requests
import os
from flask import Flask, request

# LINE 6 HI EN RAWH: __name__ (underscore pahnih) a awm ngei ngei tur a ni
app = Flask(__name__)

# 1. API Keys 7
api_keys = [
    "AIzaSyAlDpkpeYccwgB-R8SaA5R1vkJPD1_dg70",
    "AIzaSyB5HP0HeZGeycNw7_LEZUvv03TKVBYqUTw",
    "AIzaSyDUX4JjX-972MENW-LZPrMPzwRXRB3e5SA",
    "AIzaSyBVUXS-f8zvCCOEcWoFLxciPKfCbweyW5E",
    "AIzaSyB17DJ1VkdFWHWoQmb7QW3TqXHsh7653wI",
    "AIzaSyCYbCGSrwZjmOuvp4GnHmkYvcuApamdnPA",
    "AIzaSyB-sB1u7ZV-mUfkqODzj094kI_proUX724"
]

# 2. UltraMsg Details
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
    except Exception as e:
        return "Tlem han nghak lawk rawh u, ka thluak a lum deuh a nih hi!"

def send_whatsapp(to, message):
    url = f"https://api.ultramsg.com/{INSTANCE_ID}/messages/chat"
    payload = {"token": TOKEN, "to": to, "body": message}
    headers = {'content-type': 'application/x-www-form-urlencoded'}
    requests.post(url, data=payload, headers=headers)

@app.route('/', methods=['POST'])
def whatsapp_webhook():
    # Hemi hian UltraMsg atanga message lo lut a man (catch) thin
    data = request.json
    try:
        message_text = data['data']['body']
        sender_id = data['data']['from']
        
        if message_text.lower().startswith("bot"):
            query = message_text.replace("bot", "").strip()
            ai_chhanna = get_ai_response(query)
            send_whatsapp(sender_id, ai_chhanna)
    except:
        pass
    return "OK", 200

if __name__ == "__main__":
    # Render port setup
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
