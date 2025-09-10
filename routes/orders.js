const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ➕ Create a new Order (Admin + Manager)
router.post("/", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { productId, supplierId, quantity } = req.body;

    const order = await prisma.order.create({
      data: { productId, supplierId, quantity }
    });

    res.status(201).json({ message: "Order created", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 📋 Get all Orders (All roles)
router.get("/", authenticate, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true, supplier: true }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 📋 Get a single Order by ID
router.get("/:id", authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { product: true, supplier: true }
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✏️ Update Order (Admin + Manager)
router.put("/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { status, dueDate } = req.body;

    const existingOrder = await prisma.order.findUnique({
      where: { id: Number(req.params.id) }
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(status && { status }),
        ...(dueDate && { dueDate: new Date(dueDate) }) // 👈 handle dueDate
      },
      include: { product: true, supplier: true }
    });

    // ⚡ Auto-update stock if status changed to COMPLETED
    if (status === "COMPLETED") {
      await prisma.product.update({
        where: { id: order.productId },
        data: { stock: { increment: order.quantity } }
      });
    }

    res.json({ message: "Order updated", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

   
    

// ❌ Delete Order (Admin only)
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Order deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
