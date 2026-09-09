"""Prototype JWT authentication and permission dependencies."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import get_settings
from .rbac import ROLES, has_permission

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(subject: str, role: str, state: Optional[str] = None, district: Optional[str] = None) -> str:
    settings = get_settings()
    expires = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_ttl_minutes)
    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "state": state,
        "district": district,
        "exp": expires,
        "iss": "bhoomilens",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm], issuer="bhoomilens")
    except jwt.PyJWTError as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": "Authentication token is invalid or expired."},
        ) from exc


async def current_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": "Provide a bearer token issued by /auth/token."},
        )
    claims = decode_token(credentials.credentials)
    if claims.get("role") not in ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "unknown_role", "message": "The token carries an unknown role."},
        )
    return claims


def require(permission: str):
    """FastAPI dependency factory enforcing a single named permission."""

    async def dependency(principal: Dict[str, Any] = Depends(current_principal)) -> Dict[str, Any]:
        if not has_permission(principal["role"], permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "permission_denied",
                    "message": f"Role '{principal['role']}' does not carry the '{permission}' permission.",
                },
            )
        return principal

    return dependency
