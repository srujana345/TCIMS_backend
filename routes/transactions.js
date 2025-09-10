const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

/** Helper: get user id from token payload (supports id or userId) */
function currentUserId(req) {
  return (req.user && (req.user.id ?? req.user.userId)) ?? null;
}

/** Helper: toInt */
const toInt = (v) => (v === undefined || v === null ? null : Number(v));

/** ------------------------------
 *  Create Transaction
 *  Admin + Manager: IN or OUT
 *  Staff: OUT only
 * -------------------------------- */
router.post("/", authenticate, authorize(["ADMIN", "MANAGER", "STAFF"]), async (req, res) => {
  try {
    const { type, quantity, productId, supplierId } = req.body;

    if (!["IN", "OUT"].includes(type)) {
      return res.status(400).json({ message: "Invalid type. Must be IN or OUT" });
    }

    // who is making this transaction?
    const uid = currentUserId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized: token missing user id" });

    // Staff restriction
    if (req.user.role === "STAFF" && type !== "OUT") {
      return res.status(403).json({ message: "Staff can only perform OUT transactions" });
    }

    const qty = toInt(quantity);
    const pid = toInt(productId);
    const sid = toInt(supplierId);

    if (!pid || !qty || qty <= 0) {
      return res.status(400).json({ message: "productId and positive quantity are required" });
    }

    const product = await prisma.product.findUnique({ where: { id: pid } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    let supplier = null;
    if (sid) {
      supplier = await prisma.supplier.findUnique({ where: { id: sid } });
      if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    }

    // For OUT, ensure enough stock
    if (type === "OUT" && product.stock < qty) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${product.stock}` });
    }

    // Create transaction + update stock atomically
    const created = await prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.create({
        data: {
          type,
          quantity: qty,
          productId: pid,
          supplierId: sid ?? null,
          userId: Number(uid),
        },
        include: { product: true, supplier: true, user: true },
      });

      if (type === "IN") {
        await tx.product.update({
          where: { id: pid },
          data: { stock: { increment: qty } },
        });
      } else {
        await tx.product.update({
          where: { id: pid },
          data: { stock: { decrement: qty } },
        });
      }

      return trx;
    });

    res.status(201).json({ message: "Transaction created", transaction: created });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ message: error.message });
  }
});

/** --------------------------------
 *  Get transactions for a supplier
 *  (place BEFORE /:id to avoid route clash)
 * --------------------------------- */
router.get("/supplier/:supplierId/history", authenticate, async (req, res) => {
  try {
    const supplierId = toInt(req.params.supplierId);
    const transactions = await prisma.transaction.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      include: { product: true, user: true },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** ------------------------------
 *  Get all transactions (all roles)
 *  Optional filter: ?supplierId=#
 * -------------------------------- */
router.get("/", authenticate, async (req, res) => {
  try {
    const sid = toInt(req.query.supplierId);
    const where = sid ? { supplierId: sid } : {};

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { product: true, user: true, supplier: true },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** ------------------------------
 *  Get single transaction (all roles)
 * -------------------------------- */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { product: true, user: true, supplier: true },
    });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** ------------------------------
 *  Update transaction
 *  Admin + Manager only
 *  (reconciles stock if qty/type/product changes)
 * -------------------------------- */
router.put("/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Transaction not found" });

    const { type, quantity, productId, supplierId } = req.body;

    const newType = type ?? existing.type;
    const newQty = toInt(quantity ?? existing.quantity);
    const newPid = toInt(productId ?? existing.productId);
    const newSid = supplierId !== undefined ? toInt(supplierId) : existing.supplierId;

    if (!["IN", "OUT"].includes(newType)) {
      return res.status(400).json({ message: "Invalid type. Must be IN or OUT" });
    }

    // Validate product/supplier
    const newProduct = await prisma.product.findUnique({ where: { id: newPid } });
    if (!newProduct) return res.status(404).json({ message: "Product not found" });
    if (newSid) {
      const s = await prisma.supplier.findUnique({ where: { id: newSid } });
      if (!s) return res.status(404).json({ message: "Supplier not found" });
    }

    // Reconcile stock differences atomically
    const updated = await prisma.$transaction(async (tx) => {
      // Undo old effect
      if (existing.type === "IN") {
        await tx.product.update({ where: { id: existing.productId }, data: { stock: { decrement: existing.quantity } } });
      } else {
        await tx.product.update({ where: { id: existing.productId }, data: { stock: { increment: existing.quantity } } });
      }

      // Apply new effect
      if (newType === "OUT") {
        const prodNow = await tx.product.findUnique({ where: { id: newPid } });
        if (prodNow.stock < newQty) {
          throw new Error(`Insufficient stock for update. Available: ${prodNow.stock}`);
        }
      }

      const trx = await tx.transaction.update({
        where: { id },
        data: {
          type: newType,
          quantity: newQty,
          productId: newPid,
          supplierId: newSid ?? null,
          userId: Number(currentUserId(req) ?? existing.userId), // keep old if none
        },
        include: { product: true, user: true, supplier: true },
      });

      if (newType === "IN") {
        await tx.product.update({ where: { id: newPid }, data: { stock: { increment: newQty } } });
      } else {
        await tx.product.update({ where: { id: newPid }, data: { stock: { decrement: newQty } } });
      }

      return trx;
    });

    res.json({ message: "Transaction updated", transaction: updated });
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({ message: error.message });
  }
});

/** ------------------------------
 *  Delete transaction (Admin only)
 *  Revert its stock effect
 * -------------------------------- */
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Transaction not found" });

    await prisma.$transaction(async (tx) => {
      // Revert stock
      if (existing.type === "IN") {
        await tx.product.update({ where: { id: existing.productId }, data: { stock: { decrement: existing.quantity } } });
      } else {
        await tx.product.update({ where: { id: existing.productId }, data: { stock: { increment: existing.quantity } } });
      }
      await tx.transaction.delete({ where: { id } });
    });

    res.json({ message: "Transaction deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
