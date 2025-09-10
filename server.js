const express = require("express");
const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
const cors = require("cors");
const forecastRoutes = require("./routes/forecast");
dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Import Routes
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

const productRoutes = require("./routes/products");
app.use("/products", productRoutes);

const supplierRoutes = require("./routes/suppliers");
app.use("/suppliers", supplierRoutes);

const transactionRoutes = require("./routes/transactions");
app.use("/transactions", transactionRoutes);

const notificationRoutes = require("./routes/notifications");
app.use("/notifications", notificationRoutes);
const orderRoutes = require("./routes/orders");
app.use("/orders", orderRoutes);

// in server.js / app.js

app.use("/forecast", forecastRoutes);


// Default + Health
app.get("/", (req, res) => res.send("TIMS Backend Running 🚀"));
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
