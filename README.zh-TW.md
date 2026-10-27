# Conduit 繁體中文支援

以官方 **v0.18.3**（`b098291c84ef917c825bf7a4779cad20115ac42a`）為基礎，加入繁體中文介面及英文／繁體中文切換。

原專案：[advenimus/conduit-desktop](https://github.com/advenimus/conduit-desktop)。原 Apache 2.0 授權保留。

## 語言設定

在「設定 → 一般 → 介面語言」選擇跟隨系統、English 或繁體中文（台灣）。儲存後於下次啟動套用，不會因切換語言重載使用中的連線。中文系統預設使用繁體中文。

約 1,880 筆翻譯涵蓋主視窗、設定、連線與憑證表單、保管庫、匯入匯出、備份、同步、工具及桌面選單。未收錄的文字回退為英文。協定與產品名稱、使用者輸入、主機位址、指令、密碼和遠端輸出維持原樣。外部網站、AI 回覆、伺服器錯誤和官方版本說明可能仍為英文。

## 翻譯維護

- `locales/zh-TW.json`：唯一手動維護的詞典，以英文原文作為 key。
- `src/lib/i18n/index.ts`：前端語言解析、回退與參數插值。
- `electron/locales/zh-TW.ts`：由 `npm run i18n:sync` 產生的桌面詞典；不要直接編輯。
- `scripts/i18n/sync.mjs`：同步兩個執行環境的詞典。

新增介面文字時，在對應元件引入 `t()`：

```tsx
import { t } from "./lib/i18n"; // 依元件位置調整路徑
const label = t("Close {name}", { name: sessionName });
```

在詞典加入 `"Close {name}": "關閉 {name}"`，再執行 `npm run i18n:sync`。只對程式定義的介面文案呼叫 `t()`；使用者資料僅透過參數插值傳入，不要將使用者內容當成翻譯 key。

## 建置與驗證

環境需求與原專案相同，詳見 [CONTRIBUTING.md](CONTRIBUTING.md)。macOS 需 ARM64 Node.js 22.12+、npm 及 Xcode Command Line Tools。

```sh
npm ci
npm run build
npm run test -- --run
npm run lint
```

`npm run build` 會先同步詞典。macOS 安裝包的簽署、公證及 FreeRDP 輔助程式需求，請參考原專案的建置說明與 `electron-builder.yml`。

測試涵蓋語系選擇、系統語言偵測、缺字回退、參數插值、使用者資料保留、前端與桌面詞典一致性，以及儲存／取消語言偏好。另已進行中文設定、外觀、SSH 表單和 macOS 桌面啟動的畫面檢查。

此分支未更改保管庫資料格式、加密方式、連線協定或方案限制。要追隨上游較新的版本，需先整合上游變更並重新建置與驗證。
