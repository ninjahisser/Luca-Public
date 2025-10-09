from pathlib import Path
from datetime import datetime
import json
from fastapi import HTTPException

# Import the is_developer function
from utils.config_utils import CONFIG_FILE
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

def delete_calendar_item(item_id: int, x_user_name: str):
    print("Attempting to delete calendar item")
    is_dev = is_developer(x_user_name)

    # Iterate only over valid calendar files
    for file_path in CALENDAR_DIR.glob("*.json"):
        # Skip non-calendar files like "calendar_lock.json"
        if file_path.name == "calendar_lock.json":
            continue

        with file_path.open("r") as file:
            try:
                calendar_items = json.load(file)
                print(f"Loaded items from {file_path}: {calendar_items}")  # Debugging
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="Failed to parse calendar data.")

        # Ensure all items are dictionaries
        valid_items = []
        for item in calendar_items:
            if isinstance(item, dict):
                valid_items.append(item)
            else:
                print(f"Invalid item found in {file_path}: {item}")

        # Update the calendar_items list to only include valid dictionaries
        calendar_items = valid_items

        # Check if the item exists
        item_exists = any(item["id"] == item_id for item in calendar_items)
        print(f"Item with ID {item_id} exists: {item_exists}")  # Debugging

        # If the item exists, filter items based on user permissions
        if item_exists:
            print("Poster name = " + item["poster_name"])
            print("User name = " + x_user_name)
            if not is_dev:
                updated_items = [
                    item for item in calendar_items
                    if not (item["id"] == item_id and item["poster_name"] == x_user_name)
                ]
            else:
                updated_items = [item for item in calendar_items if item["id"] != item_id]

            # Check if any items were removed
            if len(updated_items) != len(calendar_items):
                if updated_items:
                    with file_path.open("w") as file:
                        json.dump(updated_items, file, indent=4)
                else:
                    file_path.unlink()  # Delete the file if no items remain
                print(f"Calendar item with ID {item_id} deleted successfully.")
                return {"message": f"Calendar item with ID {item_id} deleted successfully."}

    # If no matching item was found in any file
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
    """
    Retrieve the lock state from the config.json file.
    Returns:
        bool: True if the calendar is locked, False otherwise.
    """
    try:
        with CONFIG_FILE.open("r") as file:
            config = json.load(file)
        print(f"Config file contents: {config}")
        locked = config.get("lock_calendar", False)
        print(f"locked: {locked}")
        return bool(locked)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Config file is not a valid JSON file.")