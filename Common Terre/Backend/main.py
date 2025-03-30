from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import json
from pathlib import Path

app = FastAPI()

# Directory to store calendar items
CALENDAR_DIR = Path("calendar_data")
CALENDAR_DIR.mkdir(exist_ok=True)

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

    return calendar_items