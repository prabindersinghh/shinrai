"""Runtime settings, read once from the environment (and an optional .env file)."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SEED_DIR = DATA_DIR / "seed"
CACHE_DIR = DATA_DIR / "cache"
UPLOAD_DIR = DATA_DIR / "uploads"


def _load_dotenv() -> None:
    for candidate in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
        if not candidate.exists():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", "claude-sonnet-5-5")
# Falls back to data.gov.in's published sample key (rate-limited) so LIVE lookups work out of the box.
DATA_GOV_IN_KEY = env("DATA_GOV_IN_KEY") or "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
DATA_GOV_IN_RESOURCE = env("DATA_GOV_IN_RESOURCE", "4dbe5667-7b6b-41d7-82af-211562424d9a")
GST_PROVIDER = env("GST_PROVIDER", "none")
GST_API_KEY = env("GST_API_KEY")
DIRECTOR_PROVIDER = env("DIRECTOR_PROVIDER", "none")
DIRECTOR_API_KEY = env("DIRECTOR_API_KEY")
ADAPTER_MODE_DEFAULT = env("ADAPTER_MODE_DEFAULT", "auto")
THEATER_DELAY_MS = int(env("THEATER_DELAY_MS", "120"))
NODE_DELAY_MS = int(env("NODE_DELAY_MS", "150"))
EDGE_DELAY_MS = int(env("EDGE_DELAY_MS", "70"))
DRAMA_DELAY_MS = int(env("DRAMA_DELAY_MS", "650"))
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173")
DB_PATH = env("SHINRAI_DB", str(BASE_DIR / "shinrai.db"))

for d in (CACHE_DIR, UPLOAD_DIR):
    d.mkdir(parents=True, exist_ok=True)
