"""
Generate a Google OAuth2 refresh token for SMTP email access.
Run this script, follow the URL in your browser, authorize, then paste the code.
The refresh token will be printed - add it to your .env as GOOGLE_REFRESH_TOKEN.
"""
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
TOKEN_URI = os.getenv("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token")
AUTH_URI = os.getenv("GOOGLE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth")
SCOPES = "https://mail.google.com/"

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env")
    exit(1)

# Step 1: Generate auth URL
auth_url = (
    f"{AUTH_URI}"
    f"?client_id={CLIENT_ID}"
    f"&redirect_uri=urn:ietf:wg:oauth:2.0:oob"
    f"&response_type=code"
    f"&scope={SCOPES}"
    f"&access_type=offline"
    f"&prompt=consent"
)

print("\n" + "="*60)
print("Open this URL in your browser and authorize:")
print("="*60)
print(auth_url)
print("="*60)

auth_code = input("\nPaste the authorization code here: ").strip()

# Step 2: Exchange code for tokens
import httpx

resp = httpx.post(TOKEN_URI, data={
    "code": auth_code,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
    "grant_type": "authorization_code",
})

if resp.status_code == 200:
    tokens = resp.json()
    refresh_token = tokens.get("refresh_token")
    print("\n" + "="*60)
    print("SUCCESS! Add this to your .env file:")
    print("="*60)
    print(f"GOOGLE_REFRESH_TOKEN={refresh_token}")
    print("="*60)
else:
    print(f"\nERROR: {resp.status_code} - {resp.text}")
