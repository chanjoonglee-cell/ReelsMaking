"""Launcher: `python app.py` starts the server and opens the browser."""
import threading
import time
import webbrowser

import uvicorn

from backend import config


def _open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://{config.HOST}:{config.PORT}")


if __name__ == "__main__":
    threading.Thread(target=_open_browser, daemon=True).start()
    # Force pure-Python loop/parser. uvloop+httptools occasionally drops large
    # multipart uploads silently on macOS Apple Silicon (browser sees
    # "Failed to fetch" with no server log). Pure asyncio+h11 is slightly
    # slower but bulletproof for a 1-user local tool.
    uvicorn.run(
        "backend.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        loop="asyncio",
        http="h11",
    )
