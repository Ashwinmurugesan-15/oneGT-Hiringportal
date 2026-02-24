"""
routes/email.py
POST /api/email/send
"""
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

router = APIRouter()

EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASS = os.getenv("EMAIL_PASS", "")


@router.post("/email/send")
async def send_email(body: dict):
    to = body.get("to")
    subject = body.get("subject")
    html = body.get("html")

    if not to or not subject or not html:
        raise HTTPException(400, "Missing required fields: to, subject, html")

    # Narrow types from str | None -> str (None case already raised above)
    to = str(to)
    subject = str(subject)
    html = str(html)

    if not EMAIL_USER or not EMAIL_PASS:
        # Mock mode – just log
        print("--- MOCK EMAIL SEND ---")
        print(f"To: {to}")
        print(f"Subject: {subject}")
        print(f"Body: {html}")
        print("-----------------------")
        return {"success": True, "mock": True}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f'"HireFlow Portal" <{EMAIL_USER}>'
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, to, msg.as_string())

        return {"success": True}
    except Exception as exc:
        print(f"Error sending email: {exc}")
        raise HTTPException(500, f"Failed to send email: {exc}")
