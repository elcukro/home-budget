from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from .. import models, database
from pydantic import BaseModel

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

# Pydantic models
class UserBase(BaseModel):
    email: str
    name: str | None = None

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

class SettingsBase(BaseModel):
    language: str
    currency: str
    ai: dict | None = None

class Settings(SettingsBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

@router.get("/me", response_model=User)
def get_current_user(user_id: str = Query(..., description="The ID of the user"), db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Getting user with ID: {user_id}")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        
        if not user:
            print(f"[FastAPI] User not found with ID: {user_id}, creating new user")
            # Create new user
            user = models.User(
                id=user_id,
                email=user_id,  # Using ID as email since we use email as ID
                name=None
            )
            db.add(user)
            try:
                db.commit()
                db.refresh(user)
                print(f"[FastAPI] Created new user: {user}")
                
                # Create default settings for the new user
                settings = models.Settings(
                    user_id=user_id,
                    language="en",
                    currency="USD",
                    ai={"apiKey": None}
                )
                db.add(settings)
                db.commit()
                print(f"[FastAPI] Created default settings for new user")
            except Exception as e:
                db.rollback()
                print(f"[FastAPI] Error creating user: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")
        
        print(f"[FastAPI] Returning user: {user}")
        return user
    except Exception as e:
        print(f"[FastAPI] Error in get_current_user: {str(e)}")
        print(f"[FastAPI] Error type: {type(e)}")
        import traceback
        print(f"[FastAPI] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=User)
def create_user(user: UserBase, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Creating user: {user}")
        db_user = models.User(
            id=user.email,
            email=user.email,
            name=user.name
        )
        db.add(db_user)
        
        # Create default settings for the new user
        settings = models.Settings(
            user_id=user.email,
            language="en",
            currency="USD",
            ai={"apiKey": None}
        )
        db.add(settings)
        
        try:
            db.commit()
            db.refresh(db_user)
            print(f"[FastAPI] Created user successfully: {db_user}")
            return db_user
        except Exception as e:
            db.rollback()
            print(f"[FastAPI] Error creating user: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")
    except Exception as e:
        print(f"[FastAPI] Error in create_user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{email}/settings", response_model=Settings)
def get_user_settings(email: str, db: Session = Depends(database.get_db)):
    settings = db.query(models.Settings).filter(models.Settings.user_id == email).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/{email}/settings", response_model=Settings)
def update_user_settings(email: str, settings_update: SettingsBase, db: Session = Depends(database.get_db)):
    settings = db.query(models.Settings).filter(models.Settings.user_id == email).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    for key, value in settings_update.dict().items():
        setattr(settings, key, value)
    settings.updated_at = datetime.utcnow()
    
    try:
        db.commit()
        db.refresh(settings)
        return settings
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 