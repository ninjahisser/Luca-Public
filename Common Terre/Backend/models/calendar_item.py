from pydantic import BaseModel

class CalendarItem(BaseModel):
    poster_name: str
    date: str
    time: str
    title: str
    description: str