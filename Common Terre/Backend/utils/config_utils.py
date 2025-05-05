import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent.parent / "config.json"
DEVELOPER_FILE = Path(__file__).parent.parent / "developers.json"

def get_config_value(key: str):
    try:
        with CONFIG_FILE.open("r") as file:
            config = json.load(file)
        return config.get(key)
    except FileNotFoundError:
        raise FileNotFoundError(f"Config file not found at {CONFIG_FILE}")
    except json.JSONDecodeError:
        raise ValueError(f"Config file at {CONFIG_FILE} is not a valid JSON file.")
    
from fastapi import APIRouter
from utils.config_utils import get_config_value

router = APIRouter()

@router.get("/hoplr-link")
def get_hoplr_link():
    hoplr_link = get_config_value("hopplr_page_link")
    if not hoplr_link:
        return {"error": "Hoplr page link not configured."}
    return {"hoplr_page_link": hoplr_link}

