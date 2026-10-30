from passlib.context import CryptContext
from authx import AuthX, AuthXConfig

config = AuthXConfig(
    JWT_SECRET_KEY = "BHFUSGFUFYG8y6381rgui1jbr12h@hjjdaksfbj",
    JWT_ACCESS_COOKIE_NAME = "My_access_token",
    JWT_TOKEN_LOCATION = ["cookies"],
    JWT_COOKIE_CSRF_PROTECT=False,
    JWT_COOKIE_SECURE=False,
    JWT_COOKIE_SAMESITE="lax",
)
security = AuthX(config=config)


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(orig_password: str, hashed_password: str):
    return pwd_context.verify(orig_password, hashed_password)