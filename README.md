# 小馬訂餐平台

這是一個簡易的線上訂餐網站，提供餐點瀏覽、分類與搜尋、購物車、自取結帳、送出訂單，以及集中式訂單統計。

## 啟動

電腦需要 Node.js 18 以上版本。本專案不需另外安裝套件。

```bash
node server.mjs
```

開啟瀏覽器進入 [http://localhost:3000](http://localhost:3000)。

伺服器會將菜單與訂單記錄存在 `data/` 資料夾。這適合小型展示或單機部署；正式營業若需要備份、多人權限或大量訂單，建議改接資料庫。

## 放到公開網站

這個版本已包含後端 API，公開部署時需要使用支援 Node.js 的主機，例如 Render、Railway、Fly.io 或 VPS。

可用方式：

- Render：建立 Web Service，Start command 設為 `node server.mjs`，或直接使用本專案的 `render.yaml`。
- Railway：建立 Node 服務，Start command 設為 `node server.mjs`。
- VPS：安裝 Node.js 後執行 `node server.mjs`，再用網域反向代理到服務埠。

部署設定：

- Build command：留空或不設定
- Start command：`node server.mjs`
- Port：使用平台提供的 `PORT` 環境變數，本程式會自動讀取
- Host：正式部署建議設定環境變數 `HOST=0.0.0.0`

注意：`public/offline.html` 是無後端備用檔，只適合單機展示；若要集中訂單統計，請部署整個 Node 專案。

## 功能

- 查看主餐、輕食、點心及飲料，並依分類或關鍵字篩選。
- 將餐點加入購物車、調整數量。
- 自動計算滿額折扣：滿 `NT$500` 折 `NT$50`。
- 訂購者資訊只需填寫姓名，送出後顯示訂單成立訊息。
- 使用「編輯菜單」自行修改餐點，並由後端保存菜單。
- 送出訂單後由後端集中保存，以「訂單統計」依日期查看每日訂單、營業額、熱銷品項與訂單明細。
- 支援 PWA，可在手機瀏覽器加入主畫面，像 App 一樣開啟。

## 手機安裝

iPhone 使用 Safari 打開網站，按分享按鈕，選「加入主畫面」。

Android 使用 Chrome 打開網站，按右上角選單，選「新增至主畫面」或「安裝應用程式」。

## 測試

```bash
node --test
```
