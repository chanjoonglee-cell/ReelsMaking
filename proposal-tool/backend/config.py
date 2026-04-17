import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("PROPOSAL_MODEL", "claude-opus-4-7")
SESSIONS_DIR = Path(os.getenv("SESSIONS_DIR", ROOT / "sessions")).expanduser().resolve()
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Concurrency cap when generating sections in parallel.
SECTION_CONCURRENCY = int(os.getenv("SECTION_CONCURRENCY", "4"))

SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
