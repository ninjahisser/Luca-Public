from fastapi import APIRouter, HTTPException  # Add HTTPException here
from utils.config_utils import get_config_value, CONFIG_FILE, DEVELOPER_FILE
import json

router = APIRouter()

@router.get("/hoplr-link")
def get_hoplr_link():
    hoplr_link = get_config_value("hopplr_page_link")
    if not hoplr_link:
        return {"error": "Hoplr page link not configured."}
    return {"hoplr_page_link": hoplr_link}

@router.put("/set-hoplr-link")
def set_hoplr_link(data: dict):
    """
    Update the Hoplr link in the config file.
    """
    hoplr_link = data.get("hoplr_page_link")
    if not hoplr_link:
        raise HTTPException(status_code=400, detail="Hoplr link is required.")

    try:
        # Load the existing config
        with CONFIG_FILE.open("r") as file:
            config = json.load(file)

        # Update the Hoplr link
        config["hopplr_page_link"] = hoplr_link

        # Save the updated config
        with CONFIG_FILE.open("w") as file:
            json.dump(config, file, indent=4)

        return {"message": "Hoplr link updated successfully."}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Config file is not a valid JSON file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update Hoplr link: {str(e)}")
    
@router.get("/developers")
def get_developers():
    """
    Retrieve the list of developers.
    """
    try:
        with DEVELOPER_FILE.open("r") as file:
            config = json.load(file)
            print(f"Loaded developers: {config}")  # Debugging
        return {"developers": config.get("developers", [])}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Config file is not a valid JSON file.")

from pydantic import BaseModel

class DeveloperRequest(BaseModel):
    email: str

@router.post("/add-developer")
def add_developer(request: DeveloperRequest):
    """
    Add a new developer to the list.
    """
    email = request.email  # Extract email from the request body
    print(f"Received email to add: {email}")  # Debugging

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    try:
        with DEVELOPER_FILE.open("r") as file:
            data = json.load(file)  # Load the JSON file
            developers = data.get("developers", [])  # Extract the developers list

        if email in developers:
            raise HTTPException(status_code=400, detail="Developer already exists.")

        developers.append(email)  # Add the new developer
        data["developers"] = developers  # Update the JSON structure

        with DEVELOPER_FILE.open("w") as file:
            json.dump(data, file, indent=4)  # Save the updated JSON

        print(f"Updated developers: {developers}")  # Debugging
        return {"message": "Developer added successfully."}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Developers file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Developers file is not a valid JSON file.")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")  # Debugging
        raise HTTPException(status_code=500, detail=f"Failed to add developer: {str(e)}")
    
@router.delete("/developers")
def remove_developer(email: str):
    """
    Remove a developer from the list.
    """
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    try:
        with DEVELOPER_FILE.open("r") as file:
            data = json.load(file)  # Load the JSON file
            developers = data.get("developers", [])  # Extract the developers list

        if email not in developers:
            raise HTTPException(status_code=404, detail="Developer not found.")

        developers.remove(email)  # Remove the developer
        data["developers"] = developers  # Update the JSON structure

        with DEVELOPER_FILE.open("w") as file:
            json.dump(data, file, indent=4)  # Save the updated JSON

        print(f"Updated developers: {developers}")  # Debugging
        return {"message": "Developer removed successfully."}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Developers file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Developers file is not a valid JSON file.")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")  # Debugging
        raise HTTPException(status_code=500, detail=f"Failed to remove developer: {str(e)}")
    
@router.get("/lock-calendar")
def get_lock_calendar():
    """
    Retrieve the current state of the Lock Calendar toggle.
    """
    try:
        with CONFIG_FILE.open("r") as file:
            config = json.load(file)
        return {"lock_calendar": config.get("lock_calendar", False)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Config file is not a valid JSON file.")

@router.put("/toggle-lock-calendar")
def toggle_lock_calendar():
    """
    Toggle the Lock Calendar state in the config file.
    """
    try:
        with CONFIG_FILE.open("r") as file:
            config = json.load(file)

        # Toggle the lock_calendar state
        current_state = config.get("lock_calendar", False)
        config["lock_calendar"] = not current_state

        with CONFIG_FILE.open("w") as file:
            json.dump(config, file, indent=4)

        return {"lock_calendar": config["lock_calendar"]}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Config file is not a valid JSON file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle Lock Calendar: {str(e)}")