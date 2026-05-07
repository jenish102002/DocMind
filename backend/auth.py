import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from typing import Optional
from datetime import datetime, timedelta, timezone
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests
from dotenv import load_dotenv

# Load env
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-default-key-please-change")
JWT_ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

def create_jwt_token(email: str) -> str:
    """Generate a JWT token for the user valid for 7 days."""
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "sub": email,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[str]:
    """Decode JWT token and return the email if valid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Invalid token")
        return None

def verify_google_token(credential: str) -> Optional[str]:
    """Verify Google OAuth token and return the user's email."""
    try:
        # Specify the CLIENT_ID of the app that accesses the backend:
        idinfo = id_token.verify_oauth2_token(credential, requests.Request(), GOOGLE_CLIENT_ID)
        
        # ID token is valid. Get the user's email.
        email = idinfo.get('email')
        return email
    except ValueError as e:
        # Invalid token
        logger.error(f"Google Token Verification Failed: {e}")
        return None

def generate_otp() -> str:
    """Generate a 6-digit numeric OTP."""
    return str(random.randint(100000, 999999))

def send_otp_email(to_email: str, otp: str) -> bool:
    """Send an OTP email using SMTP. Returns True if successful."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        logger.error("SMTP credentials not configured in .env")
        return False
        
    subject = "Your DocMind Login Code"
    body = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #3b82f6;">Welcome to DocMind</h2>
        <p>Your one-time login code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 4px; color: #1e293b; background: #f1f5f9; padding: 10px; text-align: center; border-radius: 8px;">{otp}</h1>
        <p style="color: #64748b; font-size: 14px;">This code will expire in 5 minutes.</p>
    </div>
    """
    
    msg = MIMEMultipart()
    msg['From'] = f"DocMind Auth <{SMTP_EMAIL}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        logger.info(f"OTP sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False
