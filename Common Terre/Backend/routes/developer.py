from fastapi import APIRouter, HTTPException, Header
from utils.developer_utils import is_developer

router = APIRouter()

@router.post("/")
def enable_developer_mode(x_user_email: str = Header(...)):
    if not x_user_email:
        raise HTTPException(status_code=400, detail="User email is required.")
    if is_developer(x_user_email):
        return {"message": "Developer Mode enabled successfully."}
    else:
        raise HTTPException(status_code=403, detail="You are not authorized to enable Developer Mode.")