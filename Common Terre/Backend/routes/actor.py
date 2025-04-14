from fastapi import APIRouter, HTTPException, Form, UploadFile
from typing import List
from pydantic import BaseModel
import os
import json

router = APIRouter()

# Ensure the actors folder exists
ACTORS_FOLDER = "actors"
os.makedirs(ACTORS_FOLDER, exist_ok=True)

# Load actors from the main actors.json file if it exists
ACTORS_FILE = os.path.join(ACTORS_FOLDER, "actors.json")
if os.path.exists(ACTORS_FILE):
    with open(ACTORS_FILE, "r") as f:
        actors = json.load(f)
else:
    actors = []

# Pydantic model for actor
class Actor(BaseModel):
    id: int
    name: str
    description: str = ""
    order: str = "IMAGE, DESCRIPTION, EMPTY_SPACE"
    categories: List[str]
    audio: str = None  # Path to the uploaded audio file
    x_position: float = 50.0  # Default to 50% (center)
    y_position: float = 50.0  # Default to 50% (center)

@router.get("/")
def get_actors():
    for actor in actors:
        if actor.get("audio"):
            # Normalize the audio path to use forward slashes
            actor["audio"] = actor["audio"].replace("\\", "/")
            # Ensure the path is prefixed with the correct static URL
            if not actor["audio"].startswith("http://127.0.0.1:8000/static/"):
                actor["audio"] = f"http://127.0.0.1:8000/static/{actor['audio']}"
    return actors

def save_actors_to_file():
    # Save a summary of all actors to the main actors.json file
    actor_summaries = [{"id": actor["id"], "name": actor["name"]} for actor in actors]
    with open(ACTORS_FILE, "w") as f:
        json.dump(actor_summaries, f, indent=4)

@router.post("/")
def add_actor(actor: dict):
    actor['id'] = len(actors) + 1

    # Create a folder for the actor
    actor_folder = os.path.join(ACTORS_FOLDER, f"actor_{actor['id']}")
    os.makedirs(actor_folder, exist_ok=True)

    # Save actor data to a JSON file in the actor's folder
    actor_file = os.path.join(actor_folder, "data.json")
    with open(actor_file, "w") as f:
        json.dump(actor, f, indent=4)

    # Add actor to the in-memory list
    actors.append(actor)
    save_actors_to_file()  # Save the list of actors to the main actors.json file
    return actor

@router.put("/{actor_id}")
async def update_actor(
    actor_id: int,
    name: str = Form(...),
    description: str = Form(...),
    order: str = Form(...),
    categories: str = Form(...),
    x_position: float = Form(...),
    y_position: float = Form(...),
    audio: UploadFile = None
):
    for actor in actors:
        if actor["id"] == actor_id:
            actor["name"] = name
            actor["description"] = description
            actor["order"] = order
            actor["categories"] = eval(categories)  # Convert JSON string to list
            actor["x_position"] = x_position
            actor["y_position"] = y_position

            # Create or ensure the actor's folder exists
            actor_folder = os.path.join(ACTORS_FOLDER, f"actor_{actor_id}")
            os.makedirs(actor_folder, exist_ok=True)

            # Save audio file in the actor's folder
            if audio:
                audio_path = os.path.join(actor_folder, audio.filename)
                with open(audio_path, "wb") as f:
                    f.write(await audio.read())
                actor["audio"] = audio_path

            # Save updated actor data to the actor's folder
            actor_file = os.path.join(actor_folder, "data.json")
            with open(actor_file, "w") as f:
                json.dump(actor, f, indent=4)

            save_actors_to_file()  # Save the list of actors to the main actors.json file
            return {"message": "Actor updated successfully"}
    raise HTTPException(status_code=404, detail="Actor not found")

from fastapi.staticfiles import StaticFiles

from fastapi import FastAPI
from routes import calendar, developer, actor

app = FastAPI()

# Include your routers
app.include_router(calendar.router)
app.include_router(developer.router)
app.include_router(actor.router)

# Mount the actors folder for static files
app.mount("/static/actors", StaticFiles(directory="actors"), name="static-actors")

from shutil import rmtree  # Import for deleting directories

@router.delete("/{actor_id}")
def delete_actor(actor_id: int):
    global actors
    for actor in actors:
        if actor["id"] == actor_id:
            # Remove the actor's folder
            actor_folder = os.path.join(ACTORS_FOLDER, f"actor_{actor_id}")
            if os.path.exists(actor_folder):
                rmtree(actor_folder)  # Delete the folder and its contents

            # Remove the actor from the list
            actors = [a for a in actors if a["id"] != actor_id]

            # Save the updated list of actors
            save_actors_to_file()
            return {"message": "Actor deleted successfully"}

    raise HTTPException(status_code=404, detail="Actor not found")