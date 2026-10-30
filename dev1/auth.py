from fastapi import HTTPException, Response, Depends
from dev1.security import *
from pydantic import BaseModel, EmailStr, ConfigDict
from dev1.main import SessionDep,app
from sqlalchemy import select
from dev1.tables import User

class UserRegistrationSchema(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(from_attributes=True)

@app.post('/user/registration')
async def registration(user: UserRegistrationSchema, db: SessionDep):
    query = select(User).where((User.email==user.email) | (User.username==user.username))
    result = await db.execute(query)
    existing_users = result.scalars().first()

    if existing_users:
        raise HTTPException(status_code=400, detail="User already exist")


    if not existing_users:
        new_user = User(
            username=user.username,
            email=str(user.email),
            hashed_password=get_password_hash(user.password)
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

@app.post('/user/login')
async def login(cred: UserLogin, response: Response, db: SessionDep):
    exist_user:User | None = await db.scalar(
        select(User).where((User.email==cred.email) | (User.username==cred.email))
    )
    if not exist_user or not verify_password(cred.password, exist_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username/email or password")
    if not exist_user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access_token = security.create_access_token(uid=str(exist_user.id))
    security.set_access_cookies(token=access_token, response=response)

    return{
        "message": "Login success",
        "is_admin": exist_user.is_admin
    }

async def get_current_user_id(payload: dict = Depends(security.access_token_required)) -> int:
    return int(payload.sub)

async def get_current_admin(db: SessionDep, user_id: int = Depends(get_current_user_id)) -> User:
    user = await db.scalar(select(User).where(User.id==user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Don't have enough privileges")
    return user



AdminDep=Depends(get_current_admin)
UserDep=Depends(get_current_user_id)


@app.post("/user/logout")
async def logout(response: Response):
    security.unset_access_cookies(response=response)
    return {"message":"Successfully logged out"}