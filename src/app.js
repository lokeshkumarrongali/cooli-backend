const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// 1. CORS Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://cooli-frontends.vercel.app"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// 2. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Static Uploads (Must be before frontend catch-all)
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// 4. API ROUTES (Crucial: Must be registered before static/frontend routes)
// Debug Route
app.get("/api/test", (req, res) => {
  res.json({ message: "API working correctly" });
});

// Base API route
app.get("/api", (req, res) => {
  res.json({
    status: "API working",
    service: "Cooli Backend"
  });
});

// Main routes under /api/v1
app.use('/api/v1', routes);

// 5. Frontend Fallback (REMOVED: Frontend is hosted on Vercel)
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.originalUrl} not found on this server`
  });
});


// 6. Global Error Handler
app.use(errorHandler);

module.exports = app;

