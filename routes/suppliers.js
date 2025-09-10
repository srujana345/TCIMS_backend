const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ✅ Add Supplier (Admin + Manager)
router.post("/", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { name, contact, email, address } = req.body;
    const supplier = await prisma.supplier.create({
      data: { name, contact, email, address }
    });
    res.status(201).json({ message: "Supplier created", supplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get All Suppliers (All roles)
router.get("/", authenticate, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: "asc" }
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get a Supplier by ID (All roles)
router.get("/:id", authenticate, async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(req.params.id) }
    });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Update Supplier (Admin + Manager)
router.put("/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, email, address } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: { name, contact, email, address }
    });
    res.json({ message: "Supplier updated", supplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Delete Supplier (Admin only)
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.supplier.delete({ where: { id: Number(id) } });
    res.json({ message: "Supplier deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get all transactions (order history) for a supplier (All roles)
router.get("/:id/transactions", authenticate, async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const transactions = await prisma.transaction.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      include: { product: true, user: true }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// ✅ Supplier Status (stock summary + order history)
router.get("/:id/status", authenticate, async (req, res) => {
  try {
    const supplierId = Number(req.params.id);

    // Find supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { products: true }
    });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    // Fetch all transactions for this supplier
    const transactions = await prisma.transaction.findMany({
      where: { supplierId },
      include: { product: true }
    });

    // Calculate totals
    let totalSupplied = 0;
    let totalUsed = 0;
    transactions.forEach(tx => {
      if (tx.type === "IN") totalSupplied += tx.quantity;
      if (tx.type === "OUT") totalUsed += tx.quantity;
    });

    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contact: supplier.contact,
        email: supplier.email,
        address: supplier.address
      },
      totals: {
        totalSupplied,
        totalUsed,
        currentStock: totalSupplied - totalUsed
      },
      transactions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
