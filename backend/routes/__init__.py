"""Route registration for the voicebox API.

Authentication model
--------------------
Two router groups:

* **Open** — ``health`` (status checks anyone on the LAN may probe) and
  ``pairing`` (pre-pair endpoints + admin endpoints with their own
  loopback-only or token-only gates).

* **Protected** — everything else, gated by ``require_bearer_or_loopback``:
  loopback callers (the desktop app over 127.0.0.1) pass without auth as
  before; LAN/Tailscale callers must present a valid paired-device bearer.
  This is what lets ``just dev`` bind to 0.0.0.0 without exposing user
  data to anyone on the same network.
"""

from fastapi import Depends, FastAPI

from ..utils.auth import require_bearer_or_loopback


def register_routers(app: FastAPI) -> None:
    """Include all domain routers on the application."""
    from .health import router as health_router
    from .profiles import router as profiles_router
    from .channels import router as channels_router
    from .generations import router as generations_router
    from .history import router as history_router
    from .transcription import router as transcription_router
    from .llm import router as llm_router
    from .captures import router as captures_router
    from .stories import router as stories_router
    from .effects import router as effects_router
    from .audio import router as audio_router
    from .models import router as models_router
    from .settings import router as settings_router
    from .tasks import router as tasks_router
    from .cuda import router as cuda_router
    from .speak import router as speak_router
    from .mcp_bindings import router as mcp_bindings_router
    from .events import router as events_router
    from .pairing import router as pairing_router

    # Open — health probes and the pre-pair / admin pairing endpoints.
    app.include_router(health_router)
    app.include_router(pairing_router)

    # Protected — loopback callers pass through; LAN callers need a paired bearer.
    protected = [Depends(require_bearer_or_loopback)]
    app.include_router(profiles_router, dependencies=protected)
    app.include_router(channels_router, dependencies=protected)
    app.include_router(generations_router, dependencies=protected)
    app.include_router(history_router, dependencies=protected)
    app.include_router(transcription_router, dependencies=protected)
    app.include_router(llm_router, dependencies=protected)
    app.include_router(captures_router, dependencies=protected)
    app.include_router(stories_router, dependencies=protected)
    app.include_router(effects_router, dependencies=protected)
    app.include_router(audio_router, dependencies=protected)
    app.include_router(models_router, dependencies=protected)
    app.include_router(settings_router, dependencies=protected)
    app.include_router(tasks_router, dependencies=protected)
    app.include_router(cuda_router, dependencies=protected)
    app.include_router(speak_router, dependencies=protected)
    app.include_router(mcp_bindings_router, dependencies=protected)
    app.include_router(events_router, dependencies=protected)
