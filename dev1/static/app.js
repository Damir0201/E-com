// --- Состояние приложения ---
let state = {
    categories: [],
    products: [],
    cart: [],
    orders: [],
    selectedCategoryId: null,
    searchQuery: '',
    isAdmin: false,
    isLoggedIn: false,
    editingProductId: null // ID редактируемого товара
};

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    state.isAdmin = localStorage.getItem('is_admin') === 'true';
    state.isLoggedIn = localStorage.getItem('is_logged_in') === 'true';

    updateAuthUI();
    loadCategories();
    loadProducts();
    if (state.isLoggedIn) {
        loadCart();
    }
    lucide.createIcons();
});

// --- Вспомогательный клиент API ---
async function apiFetch(url, options = {}) {
    options.credentials = 'include';
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const errorMsg = data?.detail || 'Произошла ошибка';
        throw new Error(errorMsg);
    }
    return data;
}

// --- Управление UI и Навигация ---
function showSection(sectionName) {
    ['catalog', 'cart', 'orders', 'admin'].forEach(name => {
        const el = document.getElementById(`${name}Section`);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(`${sectionName}Section`);
    if (target) target.classList.remove('hidden');

    if (sectionName === 'cart') loadCart();
    if (sectionName === 'orders') loadOrders();
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-gray-800';
    toast.className = `${bg} text-white px-4 py-2 rounded shadow-lg transition transform duration-300 translate-y-2 opacity-0`;
    toast.innerText = message;

    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateAuthUI() {
    const userMenu = document.getElementById('userMenu');
    const guestMenu = document.getElementById('guestMenu');
    const adminBtn = document.getElementById('adminBtn');

    if (state.isLoggedIn) {
        userMenu.classList.remove('hidden');
        guestMenu.classList.add('hidden');
        if (state.isAdmin) {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }
    } else {
        userMenu.classList.add('hidden');
        guestMenu.classList.remove('hidden');
        adminBtn.classList.add('hidden');
    }
}

// --- Аутентификация ---
async function handleLogin(e) {
    e.preventDefault();
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const res = await apiFetch('/user/login', {
            method: 'POST',
            body: { email, password }
        });

        state.isLoggedIn = true;
        state.isAdmin = res.is_admin;

        localStorage.setItem('is_logged_in', 'true');
        localStorage.setItem('is_admin', res.is_admin ? 'true' : 'false');

        closeModal('loginModal');
        updateAuthUI();
        loadCart();
        loadProducts(); // Обновляем список для отображения кнопок админа
        showToast('Успешный вход!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    try {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

        await apiFetch('/user/registration', {
            method: 'POST',
            body: { username, email, password }
        });

        closeModal('registerModal');
        showToast('Регистрация успешна! Теперь войдите.', 'success');
        openModal('loginModal');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function logout() {
    try {
        await apiFetch('/user/logout', { method: 'POST' });
        state.isLoggedIn = false;
        state.isAdmin = false;
        localStorage.clear();
        updateAuthUI();
        loadProducts();
        showSection('catalog');
        showToast('Вы вышли из системы');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Категории и Товары ---
async function loadCategories() {
    try {
        state.categories = await apiFetch('/categories/');
        renderCategoryFilters();
        renderAdminCategorySelect();
    } catch (err) {
        console.error(err);
    }
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    container.innerHTML = `
        <button onclick="filterCategory(null)" class="cat-btn px-4 py-1.5 rounded-full text-sm font-medium border ${state.selectedCategoryId === null ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}">Все</button>
    ` + state.categories.map(c => `
        <button onclick="filterCategory(${c.id})" class="cat-btn px-4 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap ${state.selectedCategoryId === c.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}">${c.name}</button>
    `).join('');
}

function filterCategory(catId) {
    state.selectedCategoryId = catId;
    renderCategoryFilters();
    renderProducts();
}

async function loadProducts() {
    try {
        let url = '/products/?limit=100';
        if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;
        state.products = await apiFetch(url);
        renderProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

let searchDebounce;
function handleSearch() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        state.searchQuery = document.getElementById('searchInput').value;
        loadProducts();
    }, 300);
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');

    let filtered = state.products;
    if (state.selectedCategoryId !== null) {
        filtered = filtered.filter(p => p.category_id === state.selectedCategoryId);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500">Товары не найдены</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden hover:shadow-md transition">
            <img src="${p.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" class="h-48 w-full object-cover">
            <div class="p-4 flex flex-col flex-grow">
                <h3 class="font-bold text-lg mb-1">${p.title}</h3>
                <p class="text-sm text-gray-600 line-clamp-2 mb-3 flex-grow">${p.description || ''}</p>
                <div class="flex justify-between items-center mt-auto">
                    <div>
                        <span class="text-xl font-bold text-indigo-600">$${p.price}</span>
                        <span class="text-xs text-gray-400 block">В наличии: ${p.stock}</span>
                    </div>
                    <div class="flex gap-1">
                        ${state.isAdmin ? `
                            <button onclick="editProduct(${p.id})" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded" title="Редактировать">
                                <i data-lucide="edit" class="w-5 h-5"></i>
                            </button>
                            <button onclick="deleteProduct(${p.id})" class="p-2 text-red-600 hover:bg-red-50 rounded" title="Удалить">
                                <i data-lucide="trash-2" class="w-5 h-5"></i>
                            </button>
                        ` : ''}
                        <button onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''} class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white p-2 rounded transition">
                            <i data-lucide="shopping-cart" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- Корзина ---
async function loadCart() {
    if (!state.isLoggedIn) return;
    try {
        state.cart = await apiFetch('/cart/');
        renderCart();
    } catch (err) {
        console.error(err);
    }
}

function renderCart() {
    const container = document.getElementById('cartContent');
    const badge = document.getElementById('cartBadge');

    const totalItems = state.cart.reduce((acc, item) => acc + item.quantity, 0);
    if (totalItems > 0) {
        badge.innerText = totalItems;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    if (state.cart.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center py-4">Ваша корзина пуста</p>`;
        return;
    }

    // Исправлена синтаксическая ошибка расчета суммы
    const totalSum = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    container.innerHTML = `
        <div class="divide-y">
            ${state.cart.map(item => `
                <div class="py-4 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <img src="${item.product.image_url || 'https://via.placeholder.com/60'}" class="w-16 h-16 object-cover rounded">
                        <div>
                            <h4 class="font-bold">${item.product.title}</h4> <p class="text-sm text-gray-500">$${item.product.price} ×${item.quantity}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex items-center border rounded">
                            <button onclick="updateCartQty(${item.id},${item.quantity - 1})" class="px-2 py-1 text-gray-600 hover:bg-gray-100">-</button>
                            <span class="px-3 font-medium">${item.quantity}</span>
                            <button onclick="updateCartQty(${item.id},${item.quantity + 1})" class="px-2 py-1 text-gray-600 hover:bg-gray-100">+</button>
                        </div>
                        <button onclick="removeFromCart(${item.id})" class="text-red-500 hover:text-red-700">
                            <i data-lucide="trash" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="border-t pt-4 mt-4 flex justify-between items-center">
            <div>
                <span class="text-gray-600">Итого:</span>
                <span class="text-2xl font-bold ml-2 text-indigo-600">$${totalSum.toFixed(2)}</span>
            </div>
            <button onclick="checkout()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition">Оформить заказ</button>
        </div>
    `;
    lucide.createIcons();
}

async function addToCart(productId) {
    if (!state.isLoggedIn) {
        showToast('Пожалуйста, войдите в аккаунт', 'error');
        openModal('loginModal');
        return;
    }
    try {
        await apiFetch('/cart/add', {
            method: 'POST',
            body: { product_id: productId, quantity: 1 }
        });
        showToast('Товар добавлен в корзину', 'success');
        loadCart();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function updateCartQty(itemId, newQty) {
    try {
        await apiFetch(`/cart/${itemId}`, {
            method: 'PATCH',
            body: { quantity: newQty }
        });
        loadCart();
    } catch (err) {
        showToast(err.message, 'error');
        loadCart();
    }
}

async function removeFromCart(itemId) {
    try {
        await apiFetch(`/cart/${itemId}`, { method: 'DELETE' });
        loadCart();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function checkout() {
    try {
        await apiFetch('/orders/', { method: 'POST' });
        showToast('Заказ успешно оформлен!', 'success');
        loadCart();
        showSection('orders');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Заказы ---
async function loadOrders() {
    try {
        state.orders = await apiFetch('/orders/');
        renderOrders();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderOrders() {
    const container = document.getElementById('ordersList');
    if (state.orders.length === 0) {
        container.innerHTML = `<p class="text-gray-500 py-4">У вас пока нет заказов</p>`;
        return;
    }

    container.innerHTML = state.orders.map(o => `
        <div class="bg-white p-5 rounded-lg border shadow-sm">
            <div class="flex justify-between items-center border-b pb-3 mb-3">
                <div>
                    <span class="font-bold">Заказ #${o.id}</span>
                    <span class="text-xs text-gray-400 block">${new Date(o.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <div class="text-right">
                    <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">${o.status}</span>
                    <span class="font-bold text-indigo-600 block mt-1">$${o.total_price}</span>
                </div>
            </div>
            <div class="space-y-1">
                ${o.items.map(i => `
                    <div class="text-sm flex justify-between text-gray-600">
                        <span>Товар ID #${i.product_id} × ${i.quantity}</span> <span>$${i.price}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// --- Панель Администратора ---
function renderAdminCategorySelect() {
    const select = document.getElementById('prodCategory');
    if (!select) return;
    select.innerHTML = `<option value="">Выберите категорию</option>` + state.categories.map(c => `
        <option value="${c.id}">${c.name}</option>
    `).join('');
}

async function handleCreateCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catName').value;
    try {
        await apiFetch('/categories/', { method: 'POST', body: { name } });
        showToast('Категория создана!', 'success');
        document.getElementById('catName').value = '';
        loadCategories();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Универсальный обработчик формы товара (Создание / Редактирование)
async function handleCreateProduct(e) {
    e.preventDefault();
    const productData = {
        title: document.getElementById('prodTitle').value,
        description: document.getElementById('prodDesc').value || null,
        price: parseFloat(document.getElementById('prodPrice').value),
        stock: parseInt(document.getElementById('prodStock').value),
        image_url: document.getElementById('prodImage').value || null,
        category_id: parseInt(document.getElementById('prodCategory').value)
    };

    try {
        if (state.editingProductId) {
            // Если мы в режиме редактирования — вызываем PUT
            await updateProduct(state.editingProductId, productData);
            resetProductForm();
        } else {
            // Иначе создаем новый продукт
            await apiFetch('/products/', { method: 'POST', body: productData });
            showToast('Товар создан!', 'success');
            document.getElementById('createProductForm').reset();
            loadProducts();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Заполнение формы данными товара и переход в режим редактирования
function editProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    state.editingProductId = productId;

    // Заполняем поля формы
    document.getElementById('prodTitle').value = product.title;
    document.getElementById('prodDesc').value = product.description || '';
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodStock').value = product.stock;
    document.getElementById('prodImage').value = product.image_url || '';
    document.getElementById('prodCategory').value = product.category_id;

    // Меняем текст кнопки формы на "Сохранить изменения"
    const submitBtn = document.querySelector('#createProductForm button[type="submit"]');
    if (submitBtn) submitBtn.innerText = 'Сохранить изменения';

    // Показываем секцию админа
    showSection('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Сброс формы из режима редактирования в режим создания
function resetProductForm() {
    state.editingProductId = null;
    const form = document.getElementById('createProductForm');
    if (form) form.reset();
    const submitBtn = document.querySelector('#createProductForm button[type="submit"]');
    if (submitBtn) submitBtn.innerText = 'Создать товар';
}

async function updateProduct(productId, updatedData) {
    try {
        await apiFetch(`/products/${productId}`, {
            method: 'PUT',
            body: updatedData
        });
        showToast('Товар успешно обновлен!', 'success');
        loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Вы уверены, что хотите удалить товар?')) return;
    try {
        await apiFetch(`/products/${productId}`, { method: 'DELETE' });
        showToast('Товар удален', 'success');
        loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}