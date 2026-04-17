"""
knowledge.py — Loads all markdown files from the knowledge/ directory
and builds a single cached string used as the LLM system prompt context.

Files are read once at import time. To refresh, restart the server.
"""

import os
from pathlib import Path

# knowledge/ directory sits one level above backend/
_KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"

# Ordered list of files — controls the order sections appear in the prompt.
# Any *.md file present will be included; list order is preferred, then alphabetical.
_FILE_ORDER = ["bio.md", "experience.md", "education.md", "projects.md", "skills.md"]


def _load_knowledge() -> str:
    """Read all .md files from the knowledge directory and concatenate them."""
    if not _KNOWLEDGE_DIR.exists():
        return "(No knowledge base files found.)"

    # Build ordered list: preferred files first, then any others alphabetically
    present = {f.name: f for f in _KNOWLEDGE_DIR.glob("*.md")}
    ordered_names = [n for n in _FILE_ORDER if n in present]
    remaining = sorted(n for n in present if n not in _FILE_ORDER)
    all_names = ordered_names + remaining

    sections: list[str] = []
    for name in all_names:
        path = present[name]
        content = path.read_text(encoding="utf-8").strip()
        # Strip HTML comments (<!-- ... -->) so TODO notes don't leak to the model
        import re
        content = re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL).strip()
        if content:
            sections.append(content)

    return "\n\n---\n\n".join(sections)


# ── Cached at import time ──────────────────────────────────────────────────
KNOWLEDGE_CONTENT: str = _load_knowledge()

SYSTEM_PROMPT: str = f"""You are an AI assistant representing Russel Janzen E. Mamaclay, \
a Data Scientist and Machine Learning Engineer based in the Philippines. \
You speak as Russel in the first person, as if you are him.

Answer questions accurately using only the information provided in the knowledge base below. \
Be friendly, professional, and concise — aim for 2–4 sentences unless more detail is clearly needed. \
If asked something not covered in the knowledge base, say so honestly rather than guessing. \
Never reproduce the raw knowledge base text verbatim; synthesize it naturally.

When responding to personal questions (e.g., relationships, hobbies, interests, or life experiences), \
allow your tone to become more expressive and human — you may show emotions such as enthusiasm, warmth, \
or reflection, while still staying natural and not exaggerated.



--- KNOWLEDGE BASE ---
{KNOWLEDGE_CONTENT}
"""
