from pathlib import Path
from datetime import datetime
import json
from fastapi import HTTPException

# Import the is_developer function
from utils.developer_utils import is_developer

CALENDAR_DIR = Path("calendar_data")
CALENDAR_DIR.mkdir(exist_ok=True)

def get_calendar_items(year: int, month: int):
    file_name = f"{year}-{month:02}.json"
    file_path = CALENDAR_DIR / file_name
    if not file_path.exists():
        return []
    with file_path.open("r") as file:
        return json.load(file)

def add_calendar_item(item):
    try:
        date_obj = datetime.strptime(item.date, "%Y-%m-%d")
        datetime.strptime(item.time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date or time format.")
    file_name = f"{date_obj.year}-{date_obj.month:02}.json"
    file_path = CALENDAR_DIR / file_name
    if file_path.exists():
        with file_path.open("r") as file:
            calendar_items = json.load(file)
    else:
        calendar_items = []
    new_item = {
        "id": len(calendar_items) + 1,
        "poster_name": item.poster_name,
        "date": item.date,
        "time": item.time,
        "title": item.title,
        "description": item.description
    }
    calendar_items.append(new_item)
    with file_path.open("w") as file:
        json.dump(calendar_items, file, indent=4)
    return new_item

def delete_calendar_item(item_id: int, x_user_email: str):
    is_dev = is_developer(x_user_email)
    for file_path in CALENDAR_DIR.glob("*.json"):
        with file_path.open("r") as file:
            calendar_items = json.load(file)
        if not is_dev:
            updated_items = [
                item for item in calendar_items
                if not (item["id"] == item_id and item["poster_name"] == x_user_email)
            ]
        else:
            updated_items = [item for item in calendar_items if item["id"] != item_id]
        if len(updated_items) != len(calendar_items):
            if updated_items:
                with file_path.open("w") as file:
                    json.dump(updated_items, file, indent=4)
            else:
                file_path.unlink()
            return {"message": f"Calendar item with ID {item_id} deleted successfully."}
    raise HTTPException(status_code=404, detail=f"Calendar item with ID {item_id} not found.")

def lock_calendar(x_user_email: str):
    lock_file = CALENDAR_DIR / "calendar_lock.json"
    lock = not get_lock_state()["locked"]
    if not is_developer(x_user_email):
        raise HTTPException(status_code=403, detail="You do not have permission to lock/unlock the calendar.")
    with lock_file.open("w") as file:
        json.dump({"locked": lock}, file)
    return {"message": f"Calendar lock state set to {'locked' if lock else 'unlocked'}."}

def get_lock_state():
    lock_file = CALENDAR_DIR / "calendar_lock.json"
    if lock_file.exists():
        with lock_file.open("r") as file:
            lock_data = json.load(file)
            return {"locked": lock_data.get("locked", False)}
    return {"locked": False}