import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrder, categoriesFor, formatMoney, summarizeOrders } from "../public/store.mjs";

test("calculates cart lines and item count", () => {
  const order = calculateOrder({ "chicken-rice": 1, tea: 2 });

  assert.equal(order.count, 3);
  assert.equal(order.subtotal, 350);
  assert.equal(order.discount, 0);
  assert.equal(order.total, 350);
});

test("applies the full-order discount", () => {
  const order = calculateOrder({ "beef-bowl": 2 });

  assert.equal(order.subtotal, 520);
  assert.equal(order.discount, 50);
  assert.equal(order.total, 470);
});

test("formats prices", () => {
  const order = calculateOrder({ fries: 1 });

  assert.equal(order.total, 80);
  assert.equal(formatMoney(order.total), "NT$80");
});

test("calculates an edited custom menu and its categories", () => {
  const customMenu = [{ id: "noodle", name: "乾麵", category: "麵食", price: 55, emoji: "🍜", description: "" }];
  const order = calculateOrder({ noodle: 2 }, customMenu);

  assert.deepEqual(categoriesFor(customMenu), ["全部", "麵食"]);
  assert.equal(order.total, 110);
});

test("summarizes today's completed orders and popular items", () => {
  const report = summarizeOrders([
    {
      day: "2026-05-27",
      count: 3,
      total: 350,
      items: [{ name: "乾麵", emoji: "🍜", quantity: 2, lineTotal: 110 }]
    },
    {
      day: "2026-05-27",
      count: 1,
      total: 65,
      items: [{ name: "冰茶", emoji: "🥤", quantity: 1, lineTotal: 65 }]
    },
    { day: "2026-05-26", count: 9, total: 999, items: [] }
  ], "2026-05-27");

  assert.equal(report.orders, 2);
  assert.equal(report.servings, 4);
  assert.equal(report.sales, 415);
  assert.equal(report.items[0].name, "乾麵");
  assert.equal(report.items[0].quantity, 2);
});
