"""Load canonical local configuration before any application environment reads."""

from pathlib import Path

from dotenv import load_dotenv

# Source-relative, never CWD-relative. Docker supplies its environment directly
# and does not copy the repository .env into the image; a missing file is safe.
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
