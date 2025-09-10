const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ✅ Create Product (Admin, Manager)
router.post("/", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { name, category, stock, reorderPoint } = req.body;

    const product = await prisma.product.create({
      data: { name, category, stock, reorderPoint }
    });

    res.status(201).json({ message: "Product created", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get All Products (All Roles)
router.get("/", authenticate, async (req, res) => {
  try {
    const { category, stockStatus } = req.query; // optional filters

    let filters = {};
    if (category) filters.category = category;
    if (stockStatus === "low") filters.stock = { lt: prisma.product.fields.reorderPoint }; // simple filter

    const products = await prisma.product.findMany({
      where: filters,
      orderBy: { id: "asc" }
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Update Product (Admin, Manager)
router.put("/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, stock, reorderPoint } = req.body;

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: { name, category, stock, reorderPoint }
    });

    res.json({ message: "Product updated", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Delete Product (Admin only)
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({ where: { id: Number(id) } });

    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 🔎 Search & Filter Products
router.get("/search", authenticate, async (req, res) => {
  try {
    const { name, category, stockStatus } = req.query;

    const filters = {};

    if (name) {
      filters.name = { contains: name, mode: "insensitive" }; // case-insensitive search
    }
    if (category) {
      filters.category = { equals: category, mode: "insensitive" };
    }

    // Stock status filter
    if (stockStatus === "low") {
      filters.stock = { lt: prisma.product.fields.reorderPoint }; // stock < reorderPoint
    } else if (stockStatus === "out") {
      filters.stock = 0;
    }

    const products = await prisma.product.findMany({ where: filters });

    res.json({
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
