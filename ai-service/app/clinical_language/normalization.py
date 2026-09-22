from __future__ import annotations

import re
import unicodedata

# These substitutions normalize discourse/operation shorthand only. They deliberately
# do not expand disease abbreviations or turn Doctor wording into Patient facts.
_OPERATIONAL_SHORTHAND = (
    (re.compile(r"\br/o\b", re.IGNORECASE), "rule out"),
    (re.compile(r"\bw/o\b", re.IGNORECASE), "without"),
    (re.compile(r"(?<!\w)w/(?!\w)", re.IGNORECASE), "with"),
    (re.compile(r"\bprev\b", re.IGNORECASE), "previous"),
    (re.compile(r"\bcmp\b", re.IGNORECASE), "compare"),
    (re.compile(r"\bvs\.?\b", re.IGNORECASE), "versus"),
)


def normalize_doctor_message(message: str) -> str:
    """Return a parsing aid while preserving the original Doctor message separately."""
    normalized = unicodedata.normalize("NFKC", message)
    for pattern, replacement in _OPERATIONAL_SHORTHAND:
        normalized = pattern.sub(replacement, normalized)
    normalized = re.sub(r"[\t\r\f\v]+", " ", normalized)
    normalized = re.sub(r" {2,}", " ", normalized)
    normalized = re.sub(r" *\n *", "\n", normalized)
    return normalized.strip()
