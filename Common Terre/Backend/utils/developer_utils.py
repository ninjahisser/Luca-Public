import json
from pathlib import Path

DEVELOPERS_FILE = Path("developers.json")
if not DEVELOPERS_FILE.exists():
    DEVELOPERS_FILE.write_text(json.dumps({"developers": ["developer1@example.com", "developer2@example.com"]}, indent=4))

def is_developer(email: str):
    with DEVELOPERS_FILE.open("r") as file:
        developers = json.load(file).get("developers", [])
        return email in developers