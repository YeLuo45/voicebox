"""FastAPI dependencies for the V0 mobile-pair auth model.

Two dependencies are exposed:

* ``require_loopback`` — reject calls that don't originate from a loopback
  address. Used to gate desktop-only admin endpoints (pair init, devices
  list, revoke). Loopback callers stay unauthenticated everywhere else
  too — the desktop app talks to its own backend over 127.0.0.1.

* ``require_paired_device`` — validate ``Authorization: Bearer <token>``
  against the ``paired_devices`` table. Used to identify paired mobile
  callers and bumps ``last_seen_at`` on success.

Phase 2 will layer XChaCha20-Poly1305 payload encryption on top of the
bearer (see ``mobile/PLAN.md``); the bearer stays the identity primitive.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import PairedDevice, get_db
from ..services import pairing as pairing_service

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})


def require_loopback(request: Request) -> None:
    """Reject calls from non-loopback addresses."""
    client = request.client
    host = client.host if client else None
    if host not in LOOPBACK_HOSTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Loopback only",
        )


def _extract_bearer(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def require_paired_device(
    request: Request,
    db: Session = Depends(get_db),
) -> PairedDevice:
    """Resolve the PairedDevice authenticated by the request bearer."""
    bearer = _extract_bearer(request)
    if not bearer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    device = pairing_service.authenticate_bearer(db, bearer)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return device


def require_bearer_or_loopback(
    request: Request,
    db: Session = Depends(get_db),
) -> None:
    """Loopback callers pass without auth; everyone else needs a paired bearer.

    Applied as a router-level dependency on user-data endpoints so the
    desktop UI (which talks over 127.0.0.1) keeps its current friction-free
    access while LAN-reachable callers must be a paired mobile device.

    The pre-pair endpoints (``POST /pair/complete``) and the desktop-only
    admin endpoints (``POST /pair/init``, ``GET /devices``) intentionally
    stay outside this gate — they have their own dependencies.
    """
    client = request.client
    host = client.host if client else None
    if host in LOOPBACK_HOSTS:
        return
    bearer = _extract_bearer(request)
    if not bearer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    device = pairing_service.authenticate_bearer(db, bearer)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
