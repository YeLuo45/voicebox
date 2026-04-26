"""Mobile device pairing service (V0 — bearer auth, no E2E payload encryption yet).

Flow:
    1. Desktop UI (loopback) calls POST /pair/init → mints a single-use token
       with a 5-minute TTL and returns a ``voicebox://pair?...`` URL.
    2. Mobile scans the QR (or pastes the URL) and POSTs /pair/complete with
       the token + a human-readable device name.
    3. Server validates the token, mints a long-lived bearer, and stores
       only SHA-256(bearer). The bearer plaintext is returned exactly once.
    4. Mobile saves the bearer in SecureStore. Subsequent calls carry
       ``Authorization: Bearer <bearer>``.

The bearer is returned exactly once. Server has no path to recover it; if
the device loses its key the user must re-pair (and revoke the old device
from Settings → Mobile if they want to be tidy).

Phase 2 will layer XChaCha20-Poly1305 payload encryption + HKDF session
keys on top — see ``mobile/PLAN.md`` § Pairing & transport. The bearer
established here is the foundation either way.
"""

import hashlib
import logging
import secrets
import socket
import subprocess
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..database import PairedDevice, PairingToken
from ..models import (
    HostCandidate,
    PairCompleteResponse,
    PairInitResponse,
    PairedDeviceResponse,
)

logger = logging.getLogger(__name__)

PAIRING_TOKEN_TTL = timedelta(minutes=5)
TOKEN_BYTES = 32  # urlsafe-b64 encoded → ~44 chars


def _hash_bearer(bearer: str) -> str:
    return hashlib.sha256(bearer.encode("utf-8")).hexdigest()


def _build_pairing_url(token: str, host: str) -> str:
    # ``host`` should be reachable from the mobile device — LAN IP, Tailscale
    # 100.x address, MagicDNS hostname (e.g. ``mac.tail-xxxx.ts.net:17493``).
    # The desktop UI is responsible for picking the right host; loopback is
    # only useful for curl-driven local testing.
    return f"voicebox://pair?host={host}&token={token}"


def init_pairing_token(db: Session, host: str) -> PairInitResponse:
    """Mint a one-time pairing token. Caller must already be authorized as loopback."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    expires_at = datetime.utcnow() + PAIRING_TOKEN_TTL
    db.add(PairingToken(token=token, expires_at=expires_at))
    db.commit()
    return PairInitResponse(
        token=token,
        expires_at=expires_at,
        pairing_url=_build_pairing_url(token, host),
    )


def complete_pairing(db: Session, token: str, device_name: str) -> PairCompleteResponse:
    """Exchange a pairing token for a long-lived device bearer.

    Raises ValueError on invalid / expired / already-used token.
    """
    row = db.query(PairingToken).filter(PairingToken.token == token).first()
    if row is None:
        raise ValueError("Invalid pairing token")
    if row.used_at is not None:
        raise ValueError("Pairing token already used")
    if row.expires_at < datetime.utcnow():
        raise ValueError("Pairing token expired")

    row.used_at = datetime.utcnow()

    bearer = secrets.token_urlsafe(TOKEN_BYTES)
    device = PairedDevice(
        id=str(uuid.uuid4()),
        name=device_name.strip(),
        bearer_hash=_hash_bearer(bearer),
    )
    db.add(device)
    db.commit()

    logger.info("Paired new device id=%s name=%s", device.id, device.name)

    return PairCompleteResponse(
        device_id=device.id,
        bearer=bearer,
        device_name=device.name,
    )


def authenticate_bearer(db: Session, bearer: str) -> Optional[PairedDevice]:
    """Look up a paired device by bearer. Bumps last_seen_at on success."""
    if not bearer:
        return None
    bearer_hash = _hash_bearer(bearer)
    device = (
        db.query(PairedDevice)
        .filter(PairedDevice.bearer_hash == bearer_hash, PairedDevice.revoked.is_(False))
        .first()
    )
    if device is not None:
        device.last_seen_at = datetime.utcnow()
        db.commit()
    return device


def list_devices(db: Session) -> list[PairedDeviceResponse]:
    """Return all paired devices (revoked included) for the desktop UI."""
    rows = db.query(PairedDevice).order_by(PairedDevice.created_at.desc()).all()
    return [PairedDeviceResponse.model_validate(r) for r in rows]


def revoke_device(db: Session, device_id: str) -> None:
    """Mark a device as revoked. Idempotent on repeat calls."""
    device = db.query(PairedDevice).filter(PairedDevice.id == device_id).first()
    if device is None:
        raise ValueError("Device not found")
    device.revoked = True
    db.commit()
    logger.info("Revoked device id=%s name=%s", device.id, device.name)


# --- Host discovery ---------------------------------------------------------

def _get_lan_ip() -> Optional[str]:
    """Best-effort outbound IPv4 of the host. Uses the UDP-connect trick —
    no packets are actually sent; the kernel just picks the source IP it
    would use to reach 8.8.8.8.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return None


def _get_tailscale_ip() -> Optional[str]:
    """Return the host's Tailscale 100.x address if Tailscale is installed
    and reports one. Returns ``None`` on any failure — Tailscale is optional.

    Tries ``tailscale`` on PATH first, then falls back to the Mac App Store
    install location (the macOS App bundle doesn't symlink onto PATH by
    default, only into the user's shell init via an alias subprocess can't see).
    """
    candidate_binaries = [
        "tailscale",
        "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    ]
    for binary in candidate_binaries:
        try:
            result = subprocess.run(
                [binary, "ip", "--4"],
                capture_output=True,
                text=True,
                timeout=2,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        if result.returncode != 0:
            continue
        ip = result.stdout.strip().splitlines()[0].strip() if result.stdout else ""
        if ip:
            return ip
    return None


def list_host_candidates(port: int) -> list[HostCandidate]:
    """Return suggested host strings the desktop can embed in the QR.

    Order matters — the UI defaults to the first non-loopback entry.
    """
    candidates: list[HostCandidate] = []
    lan_ip = _get_lan_ip()
    if lan_ip and not lan_ip.startswith("127."):
        candidates.append(
            HostCandidate(address=f"{lan_ip}:{port}", label="Local network", kind="lan")
        )
    tailscale_ip = _get_tailscale_ip()
    if tailscale_ip and tailscale_ip != lan_ip:
        candidates.append(
            HostCandidate(address=f"{tailscale_ip}:{port}", label="Tailscale", kind="tailscale")
        )
    candidates.append(
        HostCandidate(address=f"127.0.0.1:{port}", label="Loopback (testing only)", kind="loopback")
    )
    return candidates
