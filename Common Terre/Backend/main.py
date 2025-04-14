from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import calendar, developer, actor
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