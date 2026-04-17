import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
MODEL = os.getenv("PROPOSAL_MODEL", "gpt-4o")
# Vision / multimodal calls use a separate model because some text-only
# aliases (e.g. gpt-4.1) do not accept image inputs.
VISION_MODEL = os.getenv("VISION_MODEL", "gpt-4o")
SESSIONS_DIR = Path(os.getenv("SESSIONS_DIR", ROOT / "sessions")).expanduser().resolve()
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Concurrency cap when generating sections in parallel.
SECTION_CONCURRENCY = int(os.getenv("SECTION_CONCURRENCY", "4"))

SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
