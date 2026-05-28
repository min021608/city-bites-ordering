import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { calculateOrder, defaultMenuItems } from "./public/store.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const PORT = Number(process.env.PORT) || 3000;
const HOSTS = (process.env.HOST || "127.0.0.1,::1")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function todayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("資料太大");
  }
  return body ? JSON.parse(body) : {};
}

function sanitizeMenuItem(item, index) {
  const id = String(item.id || `item-${index}`).trim().slice(0, 80);
  const name = String(item.name || "").trim().slice(0, 80);
  const category = String(item.category || "未分類").trim().slice(0, 40);
  const price = Number(item.price);
  if (!id || !name || !Number.isFinite(price) || price <= 0) {
    throw new Error("菜單資料不完整");
  }
  return {
    id,
    name,
    category,
    price: Math.round(price),
    emoji: String(item.emoji || "🍽️").trim().slice(0, 8),
    description: String(item.description || "").trim().slice(0, 140)
  };
}

export function createDataStore(dataDir = DATA_DIR) {
  const menuPath = join(dataDir, "menu.json");
  const ordersPath = join(dataDir, "orders.json");
  return {
    async readMenu() {
      const menu = await readJson(menuPath, defaultMenuItems);
      return Array.isArray(menu) && menu.length ? menu : defaultMenuItems;
    },
    async writeMenu(menu) {
      const sanitized = menu.map(sanitizeMenuItem);
      await mkdir(dataDir, { recursive: true });
      await writeFile(menuPath, `${JSON.stringify(sanitized, null, 2)}\n`);
      return sanitized;
    },
    async readOrders() {
      const orders = await readJson(ordersPath, []);
      return Array.isArray(orders) ? orders : [];
    },
    async writeOrders(orders) {
      await mkdir(dataDir, { recursive: true });
      await writeFile(ordersPath, `${JSON.stringify(orders, null, 2)}\n`);
      return orders;
    }
  };
}

async function serveFile(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const relativePath = normalize(requested).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]/, "");
  const filePath = join(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function handleApi(request, response, store) {
  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/api/menu" && request.method === "GET") {
    sendJson(response, 200, { menu: await store.readMenu() });
    return true;
  }
  if (url.pathname === "/api/menu" && request.method === "PUT") {
    const body = await readRequestBody(request);
    sendJson(response, 200, { menu: await store.writeMenu(body.menu || []) });
    return true;
  }
  if (url.pathname === "/api/orders" && request.method === "GET") {
    sendJson(response, 200, { orders: await store.readOrders() });
    return true;
  }
  if (url.pathname === "/api/orders" && request.method === "POST") {
    const body = await readRequestBody(request);
    const menu = await store.readMenu();
    const order = calculateOrder(body.cart || {}, body.method || "delivery", menu);
    if (!order.items.length) throw new Error("購物車是空的");
    const createdAt = new Date();
    const savedOrder = {
      number: `CB${String(Date.now()).slice(-6)}`,
      day: todayKey(createdAt),
      createdAt: createdAt.toISOString(),
      customer: String(body.customer || "未填姓名").trim().slice(0, 60),
      phone: String(body.phone || "").trim().slice(0, 40),
      address: String(body.address || "").trim().slice(0, 180),
      note: String(body.note || "").trim().slice(0, 240),
      payment: String(body.payment || "現金付款").trim().slice(0, 40),
      method: body.method === "pickup" ? "pickup" : "delivery",
      count: order.count,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      total: order.total,
      items: order.items.map(({ id, name, emoji, quantity, lineTotal }) => ({
        id, name, emoji, quantity, lineTotal
      }))
    };
    const orders = await store.readOrders();
    orders.unshift(savedOrder);
    await store.writeOrders(orders.slice(0, 500));
    sendJson(response, 201, { order: savedOrder });
    return true;
  }
  if (url.pathname === "/api/orders" && request.method === "DELETE") {
    await store.writeOrders([]);
    sendJson(response, 200, { orders: [] });
    return true;
  }
  return false;
}

export function createAppServer({ dataDir = DATA_DIR } = {}) {
  const store = createDataStore(dataDir);
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        if (await handleApi(request, response, store)) return;
        sendJson(response, 404, { error: "API not found" });
        return;
      }
      await serveFile(url.pathname, response);
    } catch (error) {
      sendJson(response, 400, { error: error.message || "資料處理失敗" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  HOSTS.forEach((host) => {
    createAppServer().listen(PORT, host, () => {
      const label = host.includes(":") ? `[${host}]` : host;
      console.log(`城市食光訂餐網站已啟動：http://${label}:${PORT}`);
    });
  });
}
