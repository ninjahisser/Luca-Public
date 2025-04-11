from fastapi import APIRouter

router = APIRouter()

actors = []

@router.get("/")
def get_actors():
    return actors

@router.post("/")
def add_actor(actor: dict):
    actor['id'] = len(actors) + 1
    actors.append(actor)
    return actor

@router.delete("/{actor_id}")
def delete_actor(actor_id: int):
    global actors
    actors = [actor for actor in actors if actor['id'] != actor_id]
    return {"message": "Actor deleted successfully"}