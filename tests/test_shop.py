import pytest
from httpx import AsyncClient, ASGITransport
from dev1.main import app
from dev1.auth import UserDep
from dev1.security import security

@pytest.mark.asyncio
async def test_add_to_cart_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/cart/add", json={"product_id":1, "quantity":5})
        assert response.status_code == 401

@pytest.mark.asyncio
async def test_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_response = await ac.post("/user/login", json={"email": "ger@ger.com", "password": "Qwerty2"})
        assert login_response.status_code == 200

@pytest.mark.asyncio
async def test_create_product():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/products/",json={
            "title": "morkovka",
            "price": 5,
            "stock": 10,
            "category_id": 2
        })
        assert response.status_code == 200

@pytest.mark.asyncio
async def test_delete_product():
    app.dependency_overrides[security.access_token_required] = lambda: "testuser123"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.delete("/products/2")
        assert response.status_code == 200


