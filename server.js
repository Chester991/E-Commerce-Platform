require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('MongoDB connection error', err));

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const orderSchema = new mongoose.Schema({
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: String,
        price: Number,
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    total: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        console.error('Error getting products:', err);
        res.status(500).json({ message: 'Could not load products' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Failed to fetch product' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        if (!name || !description || price == undefined || stock == undefined) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        if (price < 0 || stock < 0) {
            return res.status(400).json({ message: 'Price and stock must be non-negative' });
        }
        const product = new Product({
            name: name,
            description: description,
            price: parseFloat(price),
            stock: parseInt(stock)
        });

        const savedProduct = await product.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        console.log('Error adding Product', error);
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = parseFloat(price);
        if (stock !== undefined) updateData.stock = parseInt(stock);

        const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Failed to update product' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Failed to delete product' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        console.log('Order request received:', req.body);
        const { items } = req.body;
        if (!items || items.length == 0) {
            console.log('Order failed: Cart is empty');
            return res.status(400).json({ message: 'Cart is Empty !' })
        }

        let total = 0;
        const orderItems = [];
        for (let item of items) {
            console.log('Processing item:', item);
            const product = await Product.findById(item.productId);

            if (!product) {
                console.log('Product not found:', item.productId);
                return res.status(400).json({ message: `Product Not Found` });
            }
            if (product.stock < item.quantity) {
                console.log('Insufficient stock for product:', product.name);
                return res.status(400).json({
                    message: `Sorry only ${product.stock} ${product.name} in stock`
                });
            }
            const itemTotal = product.price * item.quantity;
            total += itemTotal;

            orderItems.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }

        console.log('Creating order with items:', orderItems);
        console.log('Order total:', total);

        const order = new Order({
            items: orderItems,
            total: total
        });

        const savedOrder = await order.save();
        console.log('Order saved successfully:', savedOrder._id);

        for (let item of items) {
            const product = await Product.findById(item.productId);
            product.stock = product.stock - item.quantity;
            await product.save();
            console.log('Updated stock for product:', product.name, 'New stock:', product.stock);
        }
        res.status(201).json(savedOrder);
    } catch (err) {
        console.error('Checkout failed:', err);
        res.status(500).json({ message: 'Checkout failed' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (err) {
        console.error('Could not get orders:', err);
        res.status(500).json({ message: 'Could not load orders' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        console.error('Could not find order:', err);
        res.status(500).json({ message: 'Could not load order' });
    }
});

app.get('/api/products/search/:query', async (req, res) => {
    try {
        const searchWord = req.params.query.toLowerCase();
        const allProducts = await Product.find();
        const matchingProducts = [];
        for (let product of allProducts) {
            const productName = product.name.toLowerCase();
            const productDesc = product.description.toLowerCase();
            if (productName.includes(searchWord) || productDesc.includes(searchWord)) {
                matchingProducts.push(product);
            }
        }
        res.json(matchingProducts);
    }
    catch (err) {
        console.error('Could not Search Products', err);
        res.status(500).json({ message: 'Search Failed' });
    }
});

async function sampleData() {
    try {
        const existingProducts = await Product.countDocuments();
        if (existingProducts > 0) {
            console.log('Sample data already exists');
            return;
        }

        const sampleProducts = [
            {
                name: 'Wireless Headphones',
                description: 'High-quality bluetooth headphones with noise cancellation',
                price: 99.99,
                stock: 50
            },
            {
                name: 'Smart Watch',
                description: 'Feature-rich smartwatch with health monitoring',
                price: 199.99,
                stock: 30
            },
            {
                name: 'Laptop Stand',
                description: 'Adjustable aluminum laptop stand for better ergonomics',
                price: 49.99,
                stock: 25
            },
            {
                name: 'USB-C Hub',
                description: 'Multi-port USB-C hub with HDMI, USB 3.0, and charging',
                price: 39.99,
                stock: 40
            },
            {
                name: 'Mechanical Keyboard',
                description: 'RGB mechanical keyboard with blue switches',
                price: 129.99,
                stock: 20
            },
            {
                name: 'Wireless Mouse',
                description: 'Ergonomic wireless mouse with precision tracking',
                price: 29.99,
                stock: 60
            }
        ];

        await Product.insertMany(sampleProducts);
        console.log('Sample data inserted successfully');
    } catch (error) {
        console.log('Error initializing Data:', error);
    }
};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await sampleData();
})