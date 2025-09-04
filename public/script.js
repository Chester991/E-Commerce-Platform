let products = [];
let cart = [];
// Use relative URLs so it works both locally and on Render
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function () {
    loadProducts();
    updateCartDisplay();
});

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        products = await response.json();
        displayProducts(products);
    } catch (error) {
        showError('Failed to load products. Make sure the server is running.');
        console.error('Error loading products:', error);
    }
}

function displayProducts(productsToShow) {
    const grid = document.getElementById('productsGrid');

    // If no products, show message
    if (productsToShow.length === 0) {
        grid.innerHTML = '<div class="loading">No products found.</div>';
        return;
    }

    // Clear the grid first
    grid.innerHTML = '';

    // Add each product to the page
    for (let product of productsToShow) {
        const productCard = `
                    <div class="product-card">
                        <div class="product-image">📦</div>
                        <div class="product-name">${product.name}</div>
                        <div class="product-description">${product.description}</div>
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                        
                        ${product.stock === 0 ?
                '<button class="btn" disabled>Out of Stock</button>' :
                `<button class="btn" onclick="addToCart('${product._id}')">Add to Cart</button>`
            }
                        
                        <div class="stock-info">Stock: ${product.stock}</div>
                    </div>
                `;

        grid.innerHTML += productCard;
    }
}
function searchProducts() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = products.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query)
    );
    displayProducts(filtered);
}

async function addToCart(productId) {
    try {
        const product = products.find(p => p._id === productId);
        if (!product || product.stock === 0) return;

        const existingItem = cart.find(item => item.productId === productId);

        if (existingItem) {
            if (existingItem.quantity >= product.stock) {
                showError('Cannot add more items. Not enough stock.');
                return;
            }
            existingItem.quantity += 1;
        } else {
            cart.push({
                productId: productId,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }

        updateCartDisplay();
        showSuccess('Product added to cart!');
    } catch (error) {
        showError('Failed to add product to cart.');
        console.error('Error adding to cart:', error);
    }
}

function updateCartDisplay() {
    const cartCount = document.getElementById('cartCount');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        cartTotal.innerHTML = '';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    </div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity('${item.productId}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity('${item.productId}', 1)">+</button>
                    </div>
                    <button class="remove-item" onclick="removeFromCart('${item.productId}')">Remove</button>
                </div>
            `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.innerHTML = `<strong>Total: $${total.toFixed(2)}</strong>`;
}

function updateQuantity(productId, change) {
    const product = products.find(p => p._id === productId);
    const cartItem = cart.find(item => item.productId === productId);

    if (!cartItem) return;

    const newQuantity = cartItem.quantity + change;

    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    if (newQuantity > product.stock) {
        showError('Cannot add more items. Not enough stock.');
        return;
    }

    cartItem.quantity = newQuantity;
    updateCartDisplay();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    updateCartDisplay();
}

function toggleCart() {
    const modal = document.getElementById('cartModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

async function checkout() {
    if (cart.length === 0) {
        showError('Your cart is empty!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }))
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Checkout failed');
        }

        const order = await response.json();
        cart = [];
        updateCartDisplay();
        toggleCart();
        showSuccess(`Order placed successfully! Order ID: ${order._id}`);
        loadProducts();
    } catch (error) {
        showError('Checkout failed: ' + error.message);
        console.error('Checkout error:', error);
    }
}

document.getElementById('addProductForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value)
    };

    try {
        const response = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add product');
        }

        showSuccess('Product added successfully!');
        document.getElementById('addProductForm').reset();
        loadProducts();
    } catch (error) {
        showError('Failed to add product: ' + error.message);
        console.error('Error adding product:', error);
    }
});

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `<div class="error">${message}</div>`;
    setTimeout(() => {
        errorDiv.innerHTML = '';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.innerHTML = `<div class="success">${message}</div>`;
    setTimeout(() => {
        successDiv.innerHTML = '';
    }, 3000);
}

document.getElementById('cartModal').addEventListener('click', function (e) {
    if (e.target === this) {
        toggleCart();
    }
});