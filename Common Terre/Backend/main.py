from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from datetime import datetime
import json
from pathlib import Path

app = FastAPI()

# Directory to store calendar items
CALENDAR_DIR = Path("calendar_data")
CALENDAR_DIR.mkdir(exist_ok=True)

DEVELOPERS_FILE = Path("developers.json")
if not DEVELOPERS_FILE.exists():
    DEVELOPERS_FILE.write_text(json.dumps({"developers": ["developer1@example.com", "developer2@example.com"]}, indent=4))

# Helper function to check if the user is a developer
def is_developer(email: str):
    """Check if the given email is in the developers list."""
    with DEVELOPERS_FILE.open("r") as file:
        developers = json.load(file).get("developers", [])
        return email in developers
    
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to restrict origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model for adding a calendar item
class CalendarItem(BaseModel):
    poster_name: str
    date: str
    time: str
    title: str
    description: str

@app.post("/calendar")
def add_calendar_item(item: CalendarItem):
    """Add a new calendar item and store it in a file based on the month and year."""
    # Check if the calendar is locked
    lock_file = CALENDAR_DIR / "calendar_lock.json"
    if lock_file.exists():
        with lock_file.open("r") as file:
            lock_data = json.load(file)
            if lock_data.get("locked", False):
                raise HTTPException(status_code=403, detail="The calendar is locked. Events cannot be added.")

    try:
        # Validate date format
        date_obj = datetime.strptime(item.date, "%Y-%m-%d")
        # Validate time format
        datetime.strptime(item.time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date or time format. Use YYYY-MM-DD for date and HH:MM for time.")

    # Determine the file name based on the year and month
    file_name = f"{date_obj.year}-{date_obj.month:02}.json"
    file_path = CALENDAR_DIR / file_name

    # Load existing items from the file, or initialize an empty list if the file doesn't exist
    if file_path.exists():
        with file_path.open("r") as file:
            calendar_items = json.load(file)
    else:
        calendar_items = []

    # Create a new item with an auto-incremented ID
    new_item = {
        "id": len(calendar_items) + 1,
        "poster_name": item.poster_name,
        "date": item.date,
        "time": item.time,
        "title": item.title,
        "description": item.description
    }

    # Append the new item and save back to the file
    calendar_items.append(new_item)
    with file_path.open("w") as file:
        json.dump(calendar_items, file, indent=4)

    return new_item

@app.get("/calendar/{year}/{month}")
def get_calendar_items(year: int, month: int):
    """Fetch all calendar items for a specific month and year."""
    # Determine the file name based on the year and month
    file_name = f"{year}-{month:02}.json"
    file_path = CALENDAR_DIR / file_name

    # Check if the file exists
    if not file_path.exists():
        return []

    # Load and return the calendar items from the file
    with file_path.open("r") as file:
        calendar_items = json.load(file)

    # Ensure the response is always a list
    if not isinstance(calendar_items, list):
        return []

    return calendar_items

@app.delete("/calendar/{item_id}")
def delete_calendar_item(item_id: int, x_user_email: str = Header(...)):
    """Delete a calendar item by its ID. Developers can delete any event."""
    if not x_user_email:
        raise HTTPException(status_code=400, detail="User email is required.")

    # Check if the user is a developer
    is_dev = is_developer(x_user_email)

    # Iterate through all files in the calendar directory
    for file_path in CALENDAR_DIR.glob("*.json"):
        with file_path.open("r") as file:
            calendar_items = json.load(file)

        # If the user is not a developer, only allow deleting their own events
        if not is_dev:
            updated_items = [
                item for item in calendar_items
                if not (item["id"] == item_id and item["poster_name"] == x_user_email)
            ]
        else:
            updated_items = [item for item in calendar_items if item["id"] != item_id]

        # If the length of the list changes, it means the item was found and removed
        if len(updated_items) != len(calendar_items):
            if updated_items:
                # Save the updated list back to the file
                with file_path.open("w") as file:
                    json.dump(updated_items, file, indent=4)
            else:
                # Delete the file if it becomes empty
                file_path.unlink()
            return {"message": f"Calendar item with ID {item_id} deleted successfully."}

    # If no matching item was found in any file
    raise HTTPException(status_code=404, detail=f"Calendar item with ID {item_id} not found.")

from fastapi import Body

from fastapi import Body

@app.post("/calendar/lock")
def lock_calendar(x_user_email: str = Header(...)):
    lock = not get_lock_state()["locked"]
    """Lock or unlock the calendar. Only developers can perform this action."""
    print(f"Received request to {'lock' if lock else 'unlock'} the calendar from {x_user_email}")
    print(f"Lock value received: {lock}")  # Debugging log

    if not is_developer(x_user_email):
        print(f"Unauthorized access attempt by {x_user_email}")
        raise HTTPException(status_code=403, detail="You do not have permission to lock or unlock the calendar.")

    try:
        # Save the lock state to a file
        lock_file = CALENDAR_DIR / "calendar_lock.json"
        with lock_file.open("w") as file:
            json.dump({"locked": lock}, file)
        print(f"Calendar lock state set to {'locked' if lock else 'unlocked'} by {x_user_email}")
        return {"message": f"Calendar lock state set to {'locked' if lock else 'unlocked'}."}
    except Exception as e:
        print(f"Error while locking/unlocking calendar: {e}")
        raise HTTPException(status_code=500, detail="Failed to lock/unlock the calendar.")
    
@app.get("/calendar/get_lock")
def get_lock_state():
    print("getting locked status")
    """Get the current lock state of the calendar."""
    lock_file = CALENDAR_DIR / "calendar_lock.json"
    if lock_file.exists():
        with lock_file.open("r") as file:
            lock_data = json.load(file)
            return {"locked": lock_data.get("locked", False)}
    return {"locked": False}

@app.post("/developers")
def enable_developer_mode(x_user_email: str = Header(...)):
    """Enable Developer Mode if the user's email is in the developers list."""
    if not x_user_email:
        raise HTTPException(status_code=400, detail="User email is required.")

    print("user attempted to gain developer mode:")
    print(x_user_email)

    # Check if the user is a developer
    if is_developer(x_user_email):
        return {"message": "Developer Mode enabled successfully."}
    else:
        raise HTTPException(status_code=403, detail="You are not authorized to enable Developer Mode.")