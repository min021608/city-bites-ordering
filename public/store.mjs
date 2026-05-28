export const defaultMenuItems = [
  { id: "chicken-rice", name: "炙燒雞腿香料飯", category: "主餐", price: 220, emoji: "🍛", description: "酥烤雞腿、季節時蔬、香料飯" },
  { id: "beef-bowl", name: "慢燉牛肉溫泉蛋飯", category: "主餐", price: 260, emoji: "🍲", description: "紅酒燉牛肉、溫泉蛋、白飯" },
  { id: "salmon-pasta", name: "香煎鮭魚奶油義麵", category: "主餐", price: 290, emoji: "🍝", description: "鮭魚、菠菜、蒜香奶油醬" },
  { id: "green-salad", name: "酪梨藜麥沙拉", category: "輕食", price: 180, emoji: "🥗", description: "酪梨、藜麥、生菜、柑橘醬" },
  { id: "toast", name: "松露野菇烤吐司", category: "輕食", price: 150, emoji: "🥪", description: "綜合野菇、起司、松露醬" },
  { id: "fries", name: "香料脆薯", category: "點心", price: 80, emoji: "🍟", description: "海鹽香草粉、番茄醬" },
  { id: "wings", name: "蜂蜜辣醬雞翅", category: "點心", price: 130, emoji: "🍗", description: "五支雞翅、蜂蜜微辣醬" },
  { id: "tea", name: "柚香冰茶", category: "飲料", price: 65, emoji: "🍹", description: "柚子果醬、茉莉綠茶" },
  { id: "latte", name: "黑糖鮮奶", category: "飲料", price: 75, emoji: "🥛", description: "黑糖蜜、鮮乳、珍珠" }
];

export function categoriesFor(items) {
  return ["全部", ...new Set(items.map((item) => item.category).filter(Boolean))];
}

export function formatMoney(value) {
  return `NT$${value.toLocaleString("zh-TW")}`;
}

export function calculateOrder(cart, menuItems = defaultMenuItems) {
  const items = Object.entries(cart).flatMap(([id, quantity]) => {
    const item = menuItems.find((entry) => entry.id === id);
    return item && quantity > 0 ? [{ ...item, quantity, lineTotal: item.price * quantity }] : [];
  });
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = subtotal >= 500 ? 50 : 0;
  return { items, count, subtotal, discount, total: subtotal - discount };
}

export function summarizeOrders(orders, day) {
  const todayOrders = orders.filter((order) => order.day === day);
  const itemTotals = new Map();
  todayOrders.forEach((order) => {
    order.items.forEach((item) => {
      const saved = itemTotals.get(item.name) || { name: item.name, emoji: item.emoji, quantity: 0, sales: 0 };
      saved.quantity += item.quantity;
      saved.sales += item.lineTotal;
      itemTotals.set(item.name, saved);
    });
  });
  return {
    orders: todayOrders.length,
    servings: todayOrders.reduce((sum, order) => sum + order.count, 0),
    sales: todayOrders.reduce((sum, order) => sum + order.total, 0),
    items: [...itemTotals.values()].sort((left, right) => right.quantity - left.quantity || right.sales - left.sales)
  };
}
