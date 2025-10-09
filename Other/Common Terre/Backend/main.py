from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import calendar, developer, actor, config_routes
from fastapi.staticfiles import StaticFiles

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
app.include_router(config_routes.router, prefix="/config", tags=["Config"])  # Mount the config router

# Mount static files under a different prefix
app.mount("/static/actors", StaticFiles(directory="actors"), name="static-actors")

from fastapi.staticfiles import StaticFiles

app.mount("/static/actors", StaticFiles(directory="actors"), name="static-actors")

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class ContentTypeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Check if the request is for a .wav file
        if request.url.path.endswith(".wav"):
            response.headers["Content-Type"] = "audio/wav"
        return response

app.add_middleware(ContentTypeMiddleware)

from fastapi import FastAPI
from routes.calendar import router as calendar_router

app.include_router(calendar_router, prefix="/calendar")
app.include_router(actor.router, prefix="/actors", tags=["Actor"])
app.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])

app.mount("/static/actors", StaticFiles(directory="actors"), name="static-actors")