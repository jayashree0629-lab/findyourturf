const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const connectDB = require("./config/db");
const seedAdmin = require("./config/seedAdmin");
const seedTurfs = require("./config/seedTurfs");
const seedAddons = require("./config/seedAddons");

const app = express();
const server = http.createServer(app);

const localOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://192.168.1.2:5173",
  "http://192.168.1.2:5174",
];

const configuredOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...localOrigins, ...configuredOrigins])];

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Dynamically allow any localhost or LAN dev server port
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    return true;
  }

  return false;
}

// Marker so the error handler below can tell a CORS rejection apart from any
// other error, without inspecting the (browser-supplied, spoofable) message.
class CorsOriginError extends Error {
  constructor(origin) {
    super(`CORS blocked origin: ${origin}`);
    this.name = "CorsOriginError";
    this.origin = origin;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new CorsOriginError(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

// Safe, non-sensitive request log: method + path + origin + whether CORS
// allowed it. No headers, bodies, tokens or credentials are ever logged.
// Cheap enough to leave on permanently — it's the only visibility Render's
// dashboard gives you into "which origin got rejected and when".
app.use((req, res, next) => {
  const origin = req.headers.origin || "(no origin)";
  const allowed = isAllowedOrigin(req.headers.origin);
  console.log(`[req] ${req.method} ${req.path} | origin=${origin} | corsAllowed=${allowed}`);
  next();
});

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked socket origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.set("io", io);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Turf Hub Backend Running",
  });
});

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const eventRoutes = require("./routes/eventRoutes");
app.use("/api/events", eventRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

const registrationRoutes = require("./routes/registrationRoutes");
app.use("/api/registrations", registrationRoutes);

const turfRoutes = require("./routes/turfRoutes");
app.use("/api/turfs", turfRoutes);

const bookingRoutes = require("./routes/bookingRoutes");
app.use("/api/bookings", bookingRoutes);

const addonRoutes = require("./routes/addonRoutes");
app.use("/api/addons", addonRoutes);

const visitorRoutes = require("./routes/visitorRoutes");
app.use("/api/visitors", visitorRoutes);

const tournamentRoutes = require("./routes/tournamentRoutes");
app.use("/api/tournaments", tournamentRoutes);

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

const liveMatchRoutes = require("./routes/liveMatchRoutes");
app.use("/api/live-matches", liveMatchRoutes);

// 404 for unknown API paths — keeps the response JSON instead of Express's
// default HTML page, matching every other route in this app.
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// Central error handler (must be defined last, with all 4 params, for
// Express to treat it as one). A rejected CORS origin — the `cors` package
// calls next(err) internally when its origin callback receives an Error —
// previously fell through to Express's default HTML 500 page with no CORS
// headers, which is indistinguishable from a real server crash both to
// curl/log output and, from the browser, to any other "Failed to fetch".
// This turns that into a clean, correctly-coded JSON response instead.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof CorsOriginError) {
    console.log(`[cors] rejected origin=${err.origin} on ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: "This origin is not allowed to access the API. Add it to CLIENT_ORIGINS."
    });
  }

  console.error("Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Something went wrong." });
});

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use by another process.`);
    console.error(`👉 To terminate the process on Windows: netstat -ano | findstr :${PORT} and taskkill /PID <PID> /F`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", err.message);
    process.exit(1);
  }
});

async function startServer() {
  try {
    await connectDB();
    await seedAdmin();
    await seedTurfs();
    await seedAddons();

    server.listen(PORT, "0.0.0.0", () => {
      console.log("----------------------------------");
      console.log("🚀 TURF HUB BACKEND");
      console.log("----------------------------------");
      console.log(`✅ Server: http://localhost:${PORT}`);
      console.log(`✅ Socket.IO: http://localhost:${PORT}`);
      console.log("✅ MongoDB connected");
      console.log("----------------------------------");
    });
  } catch (error) {
    console.error("❌ Failed to start server:");
    console.error(error.message);

    process.exit(1);
  }
}

startServer();
