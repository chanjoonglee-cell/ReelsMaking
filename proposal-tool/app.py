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
    uvicorn.run("backend.main:app", host=config.HOST, port=config.PORT, reload=False)
