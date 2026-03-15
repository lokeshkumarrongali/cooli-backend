const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Serve static image uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Middlewares
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://cooli.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health routes
app.get("/", (req, res) => {
  res.send("Cooli Backend API Running 🚀");
});

app.get("/api", (req, res) => {
  res.json({
    status: "API working",
    service: "Cooli Backend"
  });
});

// Routes
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
