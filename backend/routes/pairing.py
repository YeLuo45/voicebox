"""Mobile device pairing endpoints (V0 — bearer auth)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models
from ..database import PairedDevice, get_db
from ..services import pairing
from ..utils.auth import require_loopback, require_paired_device

router = APIRouter()


@router.post(
    "/pair/init",
    response_model=models.PairInitResponse,
    dependencies=[Depends(require_loopback)],
)
async def pair_init(request: Request, db: Session = Depends(get_db)):
    """Mint a one-time pairing token (loopback callers only).

    Optional ``?host=`` query param overrides what's embedded in the QR's
    pairing URL. The desktop UI should pass whatever address is reachable
    from the mobile device — LAN IP, Tailscale 100.x address, or MagicDNS
    name. Defaults to the request Host header for curl-driven local testing.
    """
    host = request.query_params.get("host") or (
        request.headers.get("host") or "127.0.0.1:17493"
    )
    return pairing.init_pairing_token(db, host=host)


@router.post("/pair/complete", response_model=models.PairCompleteResponse)
async def pair_complete(
    body: models.PairCompleteRequest,
    db: Session = Depends(get_db),
):
    """Exchange a pairing token for a long-lived bearer.

    Open endpoint — possession of the (one-time, short-TTL) token is
    itself the proof of authorization.
    """
    try:
        return pairing.complete_pairing(db, body.token, body.device_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/devices",
    response_model=list[models.PairedDeviceResponse],
    dependencies=[Depends(require_loopback)],
)
async def list_paired_devices(db: Session = Depends(get_db)):
    """List paired devices for the desktop Settings → Mobile pane."""
    return pairing.list_devices(db)


@router.delete(
    "/devices/{device_id}",
    status_code=204,
    dependencies=[Depends(require_loopback)],
)
async def revoke_paired_device(device_id: str, db: Session = Depends(get_db)):
    """Revoke a paired device's bearer."""
    try:
        pairing.revoke_device(db, device_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/me", response_model=models.MeResponse)
async def me(device: PairedDevice = Depends(require_paired_device)):
    """Identity of the bearer-authenticated caller — used by mobile to
    confirm pairing succeeded and the bearer round-trips.
    """
    return models.MeResponse(
        device_id=device.id,
        device_name=device.name,
        last_seen_at=device.last_seen_at,
    )


@router.get(
    "/pair/host-candidates",
    response_model=list[models.HostCandidate],
    dependencies=[Depends(require_loopback)],
)
async def host_candidates(request: Request):
    """Suggested host strings (LAN IP, Tailscale, loopback) for the QR."""
    port = request.url.port or 17493
    return pairing.list_host_candidates(port=port)
