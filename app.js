const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Connect to the database (or create it if it doesn't exist)
const db = new sqlite3.Database('./task_management.db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret';

// Middleware
app.use(bodyParser.json());

// Sample data (replace with your database logic)
let tasks = [];
let idCounter = 1;

// Routes
// Create a new task
app.post('/tasks', (req, res) => {
    const { title, description } = req.body;
    const task = { id: idCounter++, title, description, createdAt: new Date() };
    tasks.push(task);
    res.status(201).json(task);
});

// Retrieve all tasks
app.get('/tasks', (req, res) => {
    res.json(tasks);
});

// Retrieve a specific task by ID
app.get('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(task => task.id === taskId);
    if (!task) {
        return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
});

// Update a specific task by ID
app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const { title, description } = req.body;
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }
    tasks[taskIndex] = { ...tasks[taskIndex], title, description, updatedAt: new Date() };
    res.json(tasks[taskIndex]);
});

// Delete a specific task by ID
app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }
    tasks.splice(taskIndex, 1);
    res.json({ message: 'Task deleted successfully' });
});



// Create Users table
db.run(`CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password_hash TEXT
)`);

// Create Tasks table
db.run(`CREATE TABLE IF NOT EXISTS Tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    status TEXT,
    assignee_id INTEGER,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY(assignee_id) REFERENCES Users(id)
)`);


// Create a new task
app.post('/tasks', (req, res) => {
    const { title, description, status, assignee_id } = req.body;
    const createdAt = new Date();
    const updatedAt = new Date();

    db.run(`INSERT INTO Tasks (title, description, status, assignee_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description, status, assignee_id, createdAt, updatedAt], (err) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            res.status(201).json({ message: 'Task created successfully' });
        });
});

// Retrieve all tasks
app.get('/tasks', (req, res) => {
    db.all(SELECT * FROM Tasks, (err, tasks) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(tasks);
    });
});

// Other routes for updating, deleting, and retrieving individual tasks

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});



// User authentication middleware
const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - Missing token' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
};

// User registration endpoint
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await db.run(INSERT INTO Users(username, password_hash, role) VALUES(?, ?, ?), [username, passwordHash, role]);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// User login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get(SELECT * FROM Users WHERE username = ?, [username]);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized - Invalid username or password' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Unauthorized - Invalid username or password' });
        }
        const token = jwt.sign({ user: { id: user.id, username: user.username, role: user.role } }, JWT_SECRET);
        res.json({ token });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Protected route example
app.get('/tasks', authenticateUser, (req, res) => {
    // Retrieve tasks from the database
    db.all(SELECT * FROM Tasks WHERE assignee_id = ?, [req.user.id], (err, tasks) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(tasks);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});



// Close the database connection
db.close();

// Start the server
app.listen(PORT, () => {
    console.log(Server is running on port ${ PORT });
});
