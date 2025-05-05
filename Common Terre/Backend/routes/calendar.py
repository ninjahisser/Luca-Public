from fastapi import APIRouter, HTTPException, Header
from models.calendar_item import CalendarItem
from utils.calendar_utils import get_calendar_items, add_calendar_item, delete_calendar_item, lock_calendar, get_lock_state

router = APIRouter()

@router.post("/post")
def add_item(item: CalendarItem):
    print("adding calendar item");
    # Check if the calendar is locked
    if get_lock_state():
        raise HTTPException(status_code=403, detail="De kalender is vergrendeld!.")
    
    # Proceed to add the calendar item if not locked
    return add_calendar_item(item)

@router.get("/{year}/{month}")
def get_items(year: int, month: int):
    return get_calendar_items(year, month)

@router.delete("/{item_id}")
def delete_item(item_id: int, x_user_name: str = Header(...)):
    return delete_calendar_item(item_id, x_user_name)

@router.post("/lock")
def lock_calendar_route(x_user_email: str = Header(...)):
    return lock_calendar(x_user_email)

@router.get("/get_lock")
def get_lock_state_route():
    return get_lock_state()

from fastapi import APIRouter

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from datetime import datetime
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException


@router.get("/events")
def get_events(year: int = None, month: int = None):
    # Use the current year and month if not provided
    now = datetime.now()
    year = year or now.year
    month = month or now.month

    # Construct the file path based on the year and month
    file_path = Path(f"calendar_data/{year}-{month:02}.json")
    
    # Check if the file exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Events file not found")
    
    # Read and return the events from the file
    with file_path.open() as f:
        events = json.load(f)
    
    # Sort events by date and time
    events.sort(key=lambda event: (event["date"], event["time"]))
    
    # Return only the next 5 events
    return events[:5]