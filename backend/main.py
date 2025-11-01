# SPDX-License-Identifier: MIT
"""ASGI entrypoint for running the backend with uvicorn."""

import uvicorn


def run() -> None:
    """Convenience runner used by `python -m backend.main`."""
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        factory=False,
    )


if __name__ == "__main__":
    run()
