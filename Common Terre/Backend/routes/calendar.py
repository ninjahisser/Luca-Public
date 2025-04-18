from fastapi import APIRouter, HTTPException, Header
from models.calendar_item import CalendarItem
from utils.calendar_utils import get_calendar_items, add_calendar_item, delete_calendar_item, lock_calendar, get_lock_state

router = APIRouter()

@router.post("/")
def add_item(item: CalendarItem):
    return add_calendar_item(item)

@router.get("/{year}/{month}")
def get_items(year: int, month: int):
    return get_calendar_items(year, month)

@router.delete("/{item_id}")
def delete_item(item_id: int, x_user_email: str = Header(...)):
    return delete_calendar_item(item_id, x_user_email)

@router.post("/lock")
def lock_calendar_route(x_user_email: str = Header(...)):
    return lock_calendar(x_user_email)

@router.get("/get_lock")
def get_lock_state_route():
    return get_lock_state()

from fastapi import APIRouter

router = APIRouter()

@router.get("/events")
def get_events():
    return [
        {"title": "Weder", "date": "2025-03-29"},
        {"title": "Verftuin Workshop", "date": "2025-04-05"},
        {"title": "Biodynamische Tuin", "date": "2025-04-12"},
        {"title": "Co-creatie Dag", "date": "2025-04-19"}
    ]

