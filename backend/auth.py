import secrets
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


USERNAME = "admin"
PASSWORD = "admin123"

sessions = {}

security = HTTPBearer()


def login_user(username, password):

    if username != USERNAME or password != PASSWORD:
        return None

    token = secrets.token_urlsafe(32)

    sessions[token] = {
        "username": username,
        "expires": datetime.now() + timedelta(hours=8)
    }

    return token


def require_login(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    session = sessions.get(token)

    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Please login first."
        )

    if datetime.now() >= session["expires"]:

        sessions.pop(token, None)

        raise HTTPException(
            status_code=401,
            detail="Session expired."
        )

    return session["username"]


def logout_user(token):

    sessions.pop(token, None)