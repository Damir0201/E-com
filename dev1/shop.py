from fastapi import HTTPException
from dev1.auth import AdminDep, UserDep
from dev1.main import app, SessionDep, StaticFiles
from dev1.db import engine
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from dev1.tables import *
from dev1.schemas import *
from fastapi.responses import FileResponse

@app.get("/")
async def read_index():
    return FileResponse("dev1/static/index.html")


app.mount("/static", StaticFiles(directory="dev1/static"), name="static")

@app.post('/setup_db', response_model=None)
async def setup_db(admin: User=AdminDep):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    return {"message": "Database reset successfully"}

@app.get("/categories/")
async def get_all_categories(db: SessionDep):
    query = select(Category).order_by(Category.id)
    categories = await db.scalars(query)
    return categories.all()

@app.post("/categories/")
async def create_category(category: CategoryCreateSchema, db: SessionDep, admin: User = AdminDep):
    query = select(Category).where(Category.name == category.name)
    result = await db.execute(query)
    existing_category = result.scalars().first()

    if existing_category:
        raise HTTPException(status_code=400, detail="Category already exist")

    new_category = Category(name=category.name)
    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)
    return new_category

@app.delete("/categories/{category_id}")
async def delete_category(category_id: int, db: SessionDep, admin: User=AdminDep):
    query = select(Category).where(Category.id==category_id)
    res= await db.execute(query)
    existing_category=res.scalars().first()
    if not existing_category:
        raise HTTPException(status_code=404, detail="Incorrect category id")
    await db.delete(existing_category)
    await db.commit()
    return "Category deleted by admin"

@app.get("/products/")
async def get_all_products(db: SessionDep,search: str | None = None, limit: int=10, offset: int=0):
    query = select(Product)
    if search:
        query = query.where(or_(Product.title.ilike(f"%{search}%"), Product.description.ilike(f"%{search}%")))
    query=query.order_by(Product.id).limit(limit).offset(offset)
    products = await db.scalars(query)
    return products.all()

@app.post("/products/")
async def create_product(product: ProductCreateSchema, db: SessionDep, admin: User = AdminDep):
    query=select(Product).where(Product.title == product.title)
    result = await db.execute(query)
    existing_product = result.scalars().first()

    if existing_product:
        raise HTTPException(status_code=400, detail="Product already exist")
    new_product=Product(title=product.title, description=product.description, category_id=product.category_id, price=product.price, stock=product.stock, image_url=product.image_url)
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    return new_product

@app.put("/products/{product_id}")
async def product_update(product_id: int, product_update: ProductUpdateSchema, db: SessionDep, admin: User = AdminDep):
    query = select(Product).where(Product.id == product_id)
    res = await db.execute(query)
    existing_product = res.scalars().first()

    if not existing_product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product_update.category_id is not None:
        cat_query = select(Category).where(Category.id == product_update.category_id)
        cat_res = await db.execute(cat_query)
        if not cat_res.scalars().first():
            raise HTTPException(status_code=400, detail="Specified category does not exist")

    update_data = product_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(existing_product, field, value)

    await db.commit()
    await db.refresh(existing_product)

    return existing_product
@app.delete("/products/{product_id}")
async def product_delete(product_id: int, db: SessionDep, admin: User = AdminDep):
    query = select(Product).where(Product.id==product_id)
    res = await db.execute(query)
    existing_product = res.scalars().first()

    if not existing_product:
        raise HTTPException(status_code=404, detail="Incorrect product id")

    await db.delete(existing_product)
    await db.commit()
    return "Product deleted"

@app.post("/cart/add", response_model=CartItemSchema)
async def add_to_cart(add_item: CartItemAddSchema, db: SessionDep, user_id: int = UserDep):
    product = await db.scalar(select(Product).where(Product.id==add_item.product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    query = select(CartItem).options(selectinload(CartItem.product)).where((CartItem.product_id==add_item.product_id)&(CartItem.user_id==user_id))
    result = await db.execute(query)
    existing_cart_item= result.scalars().first()

    if existing_cart_item:
        existing_cart_item.quantity+=add_item.quantity
        await db.commit()

        updated_item = await db.scalar(
            select(CartItem)
            .options(selectinload(CartItem.product))
            .where(CartItem.id == existing_cart_item.id)
        )
        return updated_item

    new_cart_item = CartItem(
        user_id=user_id,
        product_id=add_item.product_id,
        quantity=add_item.quantity
    )
    db.add(new_cart_item)
    await db.commit()
    created_item = await db.scalar(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.id == new_cart_item.id)
    )
    return created_item
@app.get("/cart/")
async def get_cart(db: SessionDep, user_id: int = UserDep):
    query=select(CartItem).options(selectinload(CartItem.product)).where(CartItem.user_id==user_id).order_by(CartItem.id)
    result=await db.scalars(query)
    return result.all()

@app.delete("/cart/{item_id}")
async def delete_from_cart(item_id: int, db:SessionDep, user_id: int = UserDep):
    query = select(CartItem).where((CartItem.id==item_id)&(CartItem.user_id==user_id))
    result = await db.execute(query)
    existing_item= result.scalars().first()
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(existing_item)
    await db.commit()
    return "Item deleted successfully"

@app.patch("/cart/{item_id}")
async def update_quantity(item_id: int, body: CartItemUpdateSchema, db:SessionDep, user_id: int = UserDep):
    query = select(CartItem).options(selectinload(CartItem.product)).where((CartItem.id==item_id) & (CartItem.user_id==user_id))
    res = await db.execute(query)
    cart_item = res.scalars().first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="Incorrect item id")

    if body.quantity <= 0:
        await db.delete(cart_item)
        await db.commit()
        raise HTTPException(status_code=400, detail="Quantity cannot be less or equal to 0. Item removed from cart")

    product = cart_item.product
    if body.quantity>product.stock:
        raise HTTPException(status_code=400, detail=f"Not enough products. Maximum right now {product.stock}")

    cart_item.quantity=body.quantity
    await db.commit()
    updated_item = await db.scalar(select(CartItem).options(selectinload(CartItem.product)).where(CartItem.id==cart_item.id))
    return updated_item


@app.post("/orders/", response_model=OrderSchema)
async def create_order(db: SessionDep, user_id: int = UserDep):
    query=select(CartItem).options(selectinload(CartItem.product)).where(CartItem.user_id==user_id)
    result = await db.execute(query)
    cart_items=result.scalars().all()
    if not cart_items:
        raise HTTPException(status_code=404, detail="Cart is empty")

    total_price=0.0
    order_items_to_create=[]
    for cart_item in cart_items:
        product = await db.scalar(select(Product).where(Product.id==cart_item.product_id))
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        if product.stock < cart_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for product '{product.title}'. Available: {product.stock}, requested: {cart_item.quantity}"
            )
        item_total=float(product.price)*cart_item.quantity
        total_price += item_total

        order_items_to_create.append({
            "product":product,
            "product_id": product.id,
            "quantity": cart_item.quantity,
            "price": float(product.price)
        })
    new_order = Order(
        user_id=user_id,
        status="pending",
        total_price=total_price
    )
    db.add(new_order)
    await db.flush()

    for item_data in order_items_to_create:
        order_item=OrderItem(
            order_id=new_order.id,
            product_id=item_data["product_id"],
            quantity=item_data["quantity"],
            price=item_data["price"]
        )
        db.add(order_item)
        product = item_data["product"]
        product.stock -= item_data["quantity"]

    for cart_item in cart_items:
        await db.delete(cart_item)
    await db.commit()
    created_order = await db.scalar(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == new_order.id)
    )
    return created_order

@app.get("/orders/", response_model=list[OrderSchema])
async def get_user_orders(db: SessionDep, user_id: int = UserDep):
    query = select(Order).options(selectinload(Order.items)).where(Order.user_id == user_id).order_by(Order.id.desc())
    result = await db.scalars(query)
    return result.all()