from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import calendar, developer, actor

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to restrict origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
app.include_router(developer.router, prefix="/developers", tags=["Developer"])
app.include_router(actor.router, prefix="/actors", tags=["Actor"])