"""
Authentication API router.
Handles login, logout, and user info endpoints.
"""
import logging
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional

from auth import (
    verify_google_token, 
    create_jwt_token, 
    lookup_user_by_email,
    UserInfo,
    GOOGLE_CLIENT_ID
)
from middleware.auth_middleware import get_current_user, get_user_info
from auth import TokenData

logger = logging.getLogger("chrms.auth")

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    """Request body for Google login."""
    credential: str  # Google ID token


class LoginResponse(BaseModel):
    """Response for successful login."""
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class ConfigResponse(BaseModel):
    """Auth configuration for frontend."""
    google_client_id: str


@router.get("/config", response_model=ConfigResponse)
async def get_auth_config():
    """Get authentication configuration for frontend."""
    return ConfigResponse(google_client_id=GOOGLE_CLIENT_ID)


@router.post("/google", response_model=LoginResponse)
async def login_with_google(request: GoogleLoginRequest):
    """
    Authenticate with Google OAuth.
    Verifies Google token, looks up user in Associates sheet,
    and returns a JWT session token.
    """
    # Verify Google token
    google_user = verify_google_token(request.credential)
    if not google_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    
    if not google_user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified"
        )
    
    email = google_user.get("email")
    logger.info(f"Google login attempt for: {email}")
    
    # Look up user in Associates sheet
    user_data = lookup_user_by_email(email)
    if not user_data:
        logger.warning(f"User not found in Associates: {email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not registered as an associate. Please contact your administrator."
        )
    
    # Create JWT token
    token_payload = {
        "associate_id": user_data["associate_id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "role": user_data["role"]
    }
    access_token = create_jwt_token(token_payload)
    
    # Always set google_picture from Google user info for fallback
    user_data["google_picture"] = google_user.get("picture", "")
    
    # Add Google profile picture to user data if Associate photo is not present
    if not user_data.get("picture"):
        user_data["picture"] = google_user.get("picture", "")
    
    logger.info(f"Login successful for: {email} (role: {user_data['role']})")
    
    return LoginResponse(
        access_token=access_token,
        user=UserInfo(**user_data)
    )


@router.post("/mock", response_model=LoginResponse)
async def login_mock():
    """
    Developer bypass login.
    Returns a JWT for a hardcoded admin user.
    """
    user_data = {
        "associate_id": "DEV-001",
        "email": "dev@example.com",
        "name": "Developer Admin",
        "role": "Admin",
        "department_id": "DEP-001",
        "designation_id": "DES-001",
        "designation": "System Administrator",
        "picture": ""
    }
    
    # Create JWT token
    token_payload = {
        "associate_id": user_data["associate_id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "role": user_data["role"]
    }
    access_token = create_jwt_token(token_payload)
    
    logger.info(f"Mock login successful for: {user_data['email']}")
    
    return LoginResponse(
        access_token=access_token,
        user=UserInfo(**user_data)
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(user_info: UserInfo = Depends(get_user_info)):
    """Get current authenticated user's information."""
    return user_info


@router.post("/logout")
async def logout(current_user: TokenData = Depends(get_current_user)):
    """
    Logout the current user.
    Note: JWT tokens are stateless, so this just confirms the logout.
    Client should discard the token.
    """
    logger.info(f"Logout: {current_user.email}")
    return {"message": "Logged out successfully"}
