from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from dev1.db import get_session
from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles

app=FastAPI()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
app.mount("/static", StaticFiles(directory="dev1/static"), name="static")

import dev1.shop
