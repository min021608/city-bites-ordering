import { calculateOrder, categoriesFor, defaultMenuItems, formatMoney, summarizeOrders } from "./store.mjs";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const savedCart = JSON.parse(localStorage.getItem("city-bites-cart") || "{}");
const savedMenu = JSON.parse(localStorage.getItem("city-bites-menu") || "null");
const savedOrders = JSON.parse(localStorage.getItem("city-bites-orders") || "[]");
const state = {
  cart: savedCart,
  menu: Array.isArray(savedMenu) && savedMenu.length ? savedMenu : structuredClone(defaultMenuItems),
  orders: Array.isArray(savedOrders) ? savedOrders : [],
  category: "全部",
  search: "",
  statsScope: "all",
  statsDay: todayKey()
};
const menuGrid = document.querySelector("#menu-grid");
const cartItems = document.querySelector("#cart-items");
const menuDialog = document.querySelector("#menu-dialog");
const menuEditor = document.querySelector("#menu-editor");
const statsDialog = document.querySelector("#stats-dialog");
const checkoutDialog = document.querySelector("#checkout-dialog");
const successDialog = document.querySelector("#success-dialog");
const checkoutForm = document.querySelector("#checkout-form");

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "伺服器暫時無法處理");
  return payload;
}

function persist() {
  localStorage.setItem("city-bites-cart", JSON.stringify(state.cart));
}

function persistMenu() {
  localStorage.setItem("city-bites-menu", JSON.stringify(state.menu));
}

function persistOrders() {
  localStorage.setItem("city-bites-orders", JSON.stringify(state.orders));
}

function todayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  persist();
  renderCart();
}

function changeQuantity(id, amount) {
  state.cart[id] = (state.cart[id] || 0) + amount;
  if (state.cart[id] <= 0) delete state.cart[id];
  persist();
  renderCart();
}

function visibleItems() {
  const query = state.search.trim().toLowerCase();
  return state.menu.filter((item) => {
    const matchesCategory = state.category === "全部" || item.category === state.category;
    const matchesSearch = !query || `${item.name} ${item.description}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
}

function renderCategories() {
  const categories = categoriesFor(state.menu);
  if (!categories.includes(state.category)) state.category = "全部";
  document.querySelector("#categories").replaceChildren(...categories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category;
    button.className = category === state.category ? "active" : "";
    button.addEventListener("click", () => {
      state.category = category;
      renderCategories();
      renderMenu();
    });
    return button;
  }));
}

function renderMenu() {
  const items = visibleItems();
  if (!items.length) {
    menuGrid.innerHTML = '<p class="empty-results">找不到符合條件的餐點。</p>';
    return;
  }
  menuGrid.replaceChildren(...items.map((item) => {
    const card = document.createElement("article");
    card.className = "food-card";
    const image = document.createElement("div");
    image.className = "food-image";
    const emoji = document.createElement("span");
    emoji.textContent = item.emoji;
    image.append(emoji);
    const copy = document.createElement("div");
    copy.className = "food-copy";
    const category = document.createElement("span");
    category.textContent = item.category;
    const heading = document.createElement("h3");
    heading.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description;
    const actions = document.createElement("div");
    const price = document.createElement("strong");
    price.textContent = formatMoney(item.price);
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `加入 ${item.name}`);
    button.textContent = "+";
    button.addEventListener("click", () => addToCart(item.id));
    actions.append(price, button);
    copy.append(category, heading, description, actions);
    card.append(image, copy);
    return card;
  }));
}

function renderCart() {
  const order = calculateOrder(state.cart, state.menu);
  if (!order.items.length) {
    cartItems.innerHTML = '<div class="empty-cart"><span>🛍️</span><p>購物車是空的<br>挑一份喜歡的餐點吧</p></div>';
  } else {
    cartItems.replaceChildren(...order.items.map((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      const icon = document.createElement("span");
      icon.className = "cart-emoji";
      const iconText = document.createElement("i");
      iconText.textContent = item.emoji;
      icon.append(iconText);
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const price = document.createElement("small");
      price.textContent = formatMoney(item.price);
      details.append(name, price);
      const quantity = document.createElement("div");
      quantity.className = "quantity";
      [-1, 1].forEach((amount, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `${amount < 0 ? "減少" : "增加"} ${item.name}`);
        button.textContent = amount < 0 ? "−" : "+";
        button.addEventListener("click", () => changeQuantity(item.id, amount));
        if (index === 0) {
          const count = document.createElement("span");
          count.textContent = item.quantity;
          quantity.append(button, count);
        } else {
          quantity.append(button);
        }
      });
      row.append(icon, details, quantity);
      return row;
    }));
  }
  document.querySelector("#cart-count").textContent = `${order.count} 項`;
  document.querySelector("#top-cart-count").textContent = order.count;
  document.querySelector("#subtotal").textContent = formatMoney(order.subtotal);
  document.querySelector("#total").textContent = formatMoney(order.total);
  document.querySelector("#dialog-total").textContent = formatMoney(order.total);
  document.querySelector("#checkout").disabled = !order.items.length;
}

function renderFeatured() {
  const item = state.menu[0];
  document.querySelector("#featured-emoji").textContent = item.emoji;
  document.querySelector("#featured-name").textContent = item.name;
  document.querySelector("#featured-description").textContent = item.description;
  document.querySelector("#featured-price").textContent = formatMoney(item.price);
  document.querySelector("#featured-add").onclick = () => addToCart(item.id);
}

function inputField(value, name, type = "text") {
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.value = value;
  input.required = true;
  return input;
}

function renderEditor() {
  menuEditor.replaceChildren(...state.menu.map((item) => {
    const row = document.createElement("div");
    row.className = "edit-row";
    row.dataset.id = item.id;
    const emoji = inputField(item.emoji, "emoji");
    emoji.className = "emoji-input";
    emoji.maxLength = 4;
    const text = document.createElement("div");
    text.append(inputField(item.name, "name"), inputField(item.description, "description"));
    const category = inputField(item.category, "category");
    const price = inputField(item.price, "price", "number");
    price.min = "1";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-item";
    remove.textContent = "刪除";
    remove.addEventListener("click", () => {
      if (state.menu.length === 1) return;
      state.menu = state.menu.filter((entry) => entry.id !== item.id);
      renderEditor();
    });
    row.append(emoji, text, category, price, remove);
    return row;
  }));
}

async function saveEditedMenu() {
  state.menu = [...menuEditor.querySelectorAll(".edit-row")].map((row) => ({
    id: row.dataset.id,
    emoji: row.querySelector('[name="emoji"]').value.trim() || "🍽️",
    name: row.querySelector('[name="name"]').value.trim(),
    description: row.querySelector('[name="description"]').value.trim(),
    category: row.querySelector('[name="category"]').value.trim(),
    price: Number(row.querySelector('[name="price"]').value)
  }));
  try {
    const payload = await apiRequest("/api/menu", {
      method: "PUT",
      body: JSON.stringify({ menu: state.menu })
    });
    state.menu = payload.menu;
    state.online = true;
  } catch {
    state.online = false;
    persistMenu();
  }
  renderFeatured();
  renderCategories();
  renderMenu();
  renderCart();
}

function renderStats() {
  const isAllStats = state.statsScope === "all";
  const selectedDay = state.statsDay || todayKey();
  const report = summarizeOrders(state.orders, isAllStats ? null : selectedDay);
  document.querySelector("#stats-scope").value = state.statsScope;
  document.querySelector("#stats-day").value = selectedDay;
  document.querySelector("#stats-day-field").hidden = isAllStats;
  document.querySelector("#stats-orders-label").textContent = isAllStats ? "總訂單" : "當日訂單";
  document.querySelector("#stats-sales-label").textContent = isAllStats ? "總營業額" : "當日營業額";
  document.querySelector("#popular-title").textContent = isAllStats ? "總熱銷" : "當日熱銷";
  document.querySelector("#history-title").textContent = isAllStats ? "全部訂單" : "當日訂單";
  document.querySelector("#stats-date").textContent =
    `${isAllStats ? "全部累計" : `${selectedDay.replaceAll("-", "/")} 單日統計`}，訂單資料${state.online ? "集中保存在伺服器" : "保存在目前瀏覽器"}`;
  document.querySelector("#stats-orders").textContent = report.orders;
  document.querySelector("#stats-servings").textContent = report.servings;
  document.querySelector("#stats-sales").textContent = formatMoney(report.sales);

  const popularItems = document.querySelector("#popular-items");
  if (!report.items.length) {
    popularItems.innerHTML = `<p class="stats-empty">${isAllStats ? "尚未有完成的訂單。" : "這一天尚未有完成的訂單。"}</p>`;
  } else {
    popularItems.replaceChildren(...report.items.map((item, index) => {
      const row = document.createElement("div");
      row.className = "popular-row";
      const position = document.createElement("strong");
      position.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.textContent = `${item.emoji} ${item.name}`;
      const amount = document.createElement("small");
      amount.textContent = `${item.quantity} 份 / ${formatMoney(item.sales)}`;
      row.append(position, name, amount);
      return row;
    }));
  }

  const orderHistory = document.querySelector("#order-history");
  const selectedOrders = isAllStats ? state.orders : state.orders.filter((order) => order.day === selectedDay);
  if (!selectedOrders.length) {
    orderHistory.innerHTML = `<p class="stats-empty">${isAllStats ? "還沒有訂單明細。" : "這一天還沒有訂單明細。"}</p>`;
    return;
  }
  orderHistory.replaceChildren(...selectedOrders.slice(0, 50).map((order) => {
    const card = document.createElement("div");
    card.className = "history-row";
    const header = document.createElement("div");
    const number = document.createElement("strong");
    number.textContent = order.number;
    const total = document.createElement("strong");
    total.textContent = formatMoney(order.total);
    header.append(number, total);
    const meta = document.createElement("p");
    const time = new Date(order.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    meta.textContent = `${time} | 自取 | ${order.customer}`;
    const items = document.createElement("small");
    items.textContent = order.items.map((item) => `${item.name} x${item.quantity}`).join("、");
    card.append(header, meta, items);
    return card;
  }));
}

document.querySelector("#manage-menu").addEventListener("click", () => {
  renderEditor();
  menuDialog.showModal();
});
document.querySelector("#open-stats").addEventListener("click", () => {
  refreshOrders().finally(renderStats);
  statsDialog.showModal();
});
document.querySelector("[data-close-stats]").addEventListener("click", () => statsDialog.close());
document.querySelector("#stats-scope").addEventListener("change", (event) => {
  state.statsScope = event.target.value === "day" ? "day" : "all";
  renderStats();
});
document.querySelector("#stats-day").addEventListener("change", (event) => {
  state.statsScope = "day";
  state.statsDay = event.target.value || todayKey();
  renderStats();
});
document.querySelector("#clear-orders").addEventListener("click", () => {
  if (!window.confirm("確定清除所有訂單紀錄嗎？")) return;
  clearOrders().finally(renderStats);
});
document.querySelector("[data-close-menu]").addEventListener("click", () => menuDialog.close());
document.querySelector("#add-item").addEventListener("click", () => {
  state.menu.push({
    id: `custom-${Date.now()}`,
    emoji: "🍽️",
    name: "新餐點",
    description: "請輸入餐點說明",
    category: "主餐",
    price: 100
  });
  renderEditor();
});
document.querySelector("#reset-menu").addEventListener("click", () => {
  state.menu = structuredClone(defaultMenuItems);
  renderEditor();
});
document.querySelector("#menu-form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedMenu();
  menuDialog.close();
});
document.querySelector("#search").addEventListener("input", (event) => {
  state.search = event.target.value;
  renderMenu();
});
document.querySelector("#cart-jump").addEventListener("click", () => {
  document.querySelector("#cart").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#checkout").addEventListener("click", () => checkoutDialog.showModal());
document.querySelector("[data-close-checkout]").addEventListener("click", () => checkoutDialog.close());
document.querySelector("#continue").addEventListener("click", () => successDialog.close());
checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitOrder();
});

async function refreshOrders() {
  try {
    const payload = await apiRequest("/api/orders");
    state.orders = payload.orders;
    state.online = true;
  } catch {
    state.online = false;
  }
}

async function clearOrders() {
  try {
    await apiRequest("/api/orders", { method: "DELETE" });
    state.online = true;
  } catch {
    state.online = false;
  }
  state.orders = [];
  persistOrders();
}

function saveLocalOrder(order, number, customerData) {
  const savedOrder = {
    number,
    day: todayKey(),
    createdAt: new Date().toISOString(),
    customer: customerData.customer,
    phone: "",
    note: "",
    payment: "現金付款",
    method: "pickup",
    count: order.count,
    subtotal: order.subtotal,
    discount: 0,
    total: order.total,
    items: order.items.map(({ id, name: itemName, emoji, quantity, lineTotal }) => ({
      id, name: itemName, emoji, quantity, lineTotal
    }))
  };
  state.orders.unshift(savedOrder);
  persistOrders();
  return savedOrder;
}

async function submitOrder() {
  const order = calculateOrder(state.cart, state.menu);
  const customerData = {
    customer: checkoutForm.elements.name.value.trim()
  };
  const number = `CB${String(Date.now()).slice(-6)}`;
  let savedOrder;
  try {
    const payload = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({ cart: state.cart, ...customerData })
    });
    savedOrder = payload.order;
    state.orders.unshift(savedOrder);
    state.online = true;
  } catch {
    savedOrder = saveLocalOrder(order, number, customerData);
    state.online = false;
  }
  document.querySelector("#success-message").textContent =
    `${customerData.customer}，訂單編號 ${savedOrder.number}，共 ${formatMoney(savedOrder.total)}。預計 20 分鐘後可自取。`;
  state.cart = {};
  persist();
  checkoutForm.reset();
  checkoutDialog.close();
  renderCart();
  successDialog.showModal();
}

async function initialize() {
  try {
    const [menuPayload, orderPayload] = await Promise.all([
      apiRequest("/api/menu"),
      apiRequest("/api/orders")
    ]);
    state.menu = menuPayload.menu;
    state.orders = orderPayload.orders;
    state.online = true;
  } catch {
    state.online = false;
  }
  renderFeatured();
  renderCategories();
  renderMenu();
}

initialize();
