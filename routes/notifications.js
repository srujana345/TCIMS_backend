const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ✅ Low Stock Alerts
router.get("/low-stock", authenticate, async (req, res) => {
  try {
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: { lt: prisma.product.fields.reorderPoint }
      }
    });

    res.json({
      count: lowStockProducts.length,
      alerts: lowStockProducts.map(p => ({
        productId: p.id,
        name: p.name,
        stock: p.stock,
        reorderPoint: p.reorderPoint,
        message: `⚠️ Low stock for ${p.name}. Current: ${p.stock}, Reorder Point: ${p.reorderPoint}`
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/overdue-orders", authenticate, async (req, res) => {
  try {
    const overdueOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        dueDate: { lt: new Date() }
      },
      include: { product: true, supplier: true }
    });

    res.json({
      count: overdueOrders.length,
      alerts: overdueOrders.map(o => ({
        orderId: o.id,
        product: o.product.name,
        supplier: o.supplier.name,
        quantity: o.quantity,
        dueDate: o.dueDate,
        message: `⏰ Order #${o.id} for ${o.product.name} is overdue! Due on ${o.dueDate.toDateString()}`
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
