import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "../server.mjs";

async function withServer(run) {
  const dataDir = await mkdtemp(join(tmpdir(), "city-bites-"));
  const server = createAppServer({ dataDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { force: true, recursive: true });
  }
}

async function jsonFetch(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  return { response, payload: await response.json() };
}

test("serves menu from the API and persists edited menu", async () => {
  await withServer(async (baseUrl) => {
    const first = await jsonFetch(baseUrl, "/api/menu");
    assert.equal(first.response.status, 200);
    assert.ok(first.payload.menu.length > 0);

    const updatedMenu = [{ id: "noodle", name: "乾麵", category: "麵食", price: 55, emoji: "🍜", description: "測試餐點" }];
    const saved = await jsonFetch(baseUrl, "/api/menu", {
      method: "PUT",
      body: JSON.stringify({ menu: updatedMenu })
    });
    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.payload.menu, updatedMenu);

    const second = await jsonFetch(baseUrl, "/api/menu");
    assert.deepEqual(second.payload.menu, updatedMenu);
  });
});

test("creates server-side orders from cart and clears order history", async () => {
  await withServer(async (baseUrl) => {
    const created = await jsonFetch(baseUrl, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        cart: { "chicken-rice": 1, tea: 2 },
        method: "delivery",
        customer: "測試客人",
        phone: "0912345678"
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.order.customer, "測試客人");
    assert.equal(created.payload.order.total, 399);
    assert.equal(created.payload.order.items.length, 2);

    const orders = await jsonFetch(baseUrl, "/api/orders");
    assert.equal(orders.payload.orders.length, 1);

    const cleared = await jsonFetch(baseUrl, "/api/orders", { method: "DELETE" });
    assert.equal(cleared.response.status, 200);
    assert.deepEqual(cleared.payload.orders, []);
  });
});
