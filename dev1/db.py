from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

engine = create_async_engine('postgresql+asyncpg://admin:647391@localhost:5432/ecom_db', echo=True)

n_session = async_sessionmaker(engine, expire_on_commit=False)

async def get_session():
    async with n_session() as session:
        yield session

