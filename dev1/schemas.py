from dev1.auth import BaseModel
from pydantic import ConfigDict
from datetime import datetime

class CategorySchema(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class CategoryCreateSchema(BaseModel):
    name: str

class ProductSchema(BaseModel):
    id: int
    title: str
    description: str | None = None
    price: float
    stock: int
    image_url: str | None = None
    category_id: int
    model_config = ConfigDict(from_attributes=True)

class ProductUpdateSchema(BaseModel):
    title: str | None = None
    description: str | None = None
    price: float | None = None
    stock: int | None = None
    image_url: str | None = None
    category_id: int | None = None
    is_active: bool | None = None

class ProductCreateSchema(BaseModel):
    title: str
    description: str | None = None
    price: float
    stock: int = 0
    image_url: str | None = None
    category_id: int

class CartItemAddSchema(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemSchema(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: ProductSchema
    model_config = ConfigDict(from_attributes=True)


class CartItemUpdateSchema(BaseModel):
    quantity: int

class OrderItemSchema(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float
    model_config = ConfigDict(from_attributes=True)

class OrderSchema(BaseModel):
    id: int
    status: str
    total_price: float
    created_at: datetime
    items: list[OrderItemSchema] = []
    model_config = ConfigDict(from_attributes=True)
