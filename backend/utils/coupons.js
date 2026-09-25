const Coupon = require("../models/Coupon");

class CouponError extends Error {
    constructor(message) {
        super(message);
        this.name = "CouponError";
        this.status = 400;
    }
}

function normaliseCode(code) {
    return String(code || "").replace(/\s+/g, "").toUpperCase();
}

function discountFor(coupon, subtotal) {
    let discount =
        coupon.type === "PERCENT"
            ? Math.floor((subtotal * coupon.value) / 100)
            : Math.floor(coupon.value);
    if (coupon.type === "PERCENT" && coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
    }
    // Never discount below ₹0.
    return Math.max(0, Math.min(discount, subtotal));
}

// Throws CouponError with a player-friendly message if the code can't be used.
async function validateCoupon({ code, phone, subtotal }) {
    const clean = normaliseCode(code);
    if (!clean) throw new CouponError("Enter a coupon code.");

    const coupon = await Coupon.findOne({ code: clean });
    if (!coupon || !coupon.active) throw new CouponError("This coupon code isn't valid.");
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
        throw new CouponError("This coupon has expired.");
    }
    if (coupon.phone && coupon.phone !== phone) {
        throw new CouponError("This coupon belongs to a different mobile number.");
    }
    if (coupon.usedBy.includes(phone)) {
        throw new CouponError("You've already used this coupon.");
    }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        throw new CouponError("This coupon has been fully redeemed.");
    }
    if (subtotal < coupon.minOrder) {
        throw new CouponError(`This coupon needs a booking of at least ₹${coupon.minOrder}.`);
    }

    const discount = discountFor(coupon, subtotal);
    if (discount <= 0) throw new CouponError("This coupon doesn't apply to this booking.");

    return { coupon, discount };
}

// Atomically marks a coupon as used by `phone`. Returns false if someone else
// got there first (so two simultaneous checkouts can't both redeem it).
async function consumeCoupon(coupon, phone) {
    const updated = await Coupon.findOneAndUpdate(
        {
            _id: coupon._id,
            active: true,
            usedBy: { $ne: phone },
            $or: [{ maxUses: 0 }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }]
        },
        { $inc: { usedCount: 1 }, $push: { usedBy: phone } },
        { new: true }
    );
    return Boolean(updated);
}

async function releaseCoupon(coupon, phone) {
    await Coupon.updateOne(
        { _id: coupon._id, usedBy: phone },
        { $inc: { usedCount: -1 }, $pull: { usedBy: phone } }
    );
}

function generateCode(prefix) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return `${prefix}-${s}`;
}

async function createUniqueCoupon(prefix, fields) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            return await Coupon.create({ ...fields, code: generateCode(prefix) });
        } catch (err) {
            if (err.code !== 11000) throw err;
        }
    }
    throw new Error("Could not generate a unique coupon code.");
}

module.exports = {
    CouponError,
    normaliseCode,
    discountFor,
    validateCoupon,
    consumeCoupon,
    releaseCoupon,
    createUniqueCoupon
};
