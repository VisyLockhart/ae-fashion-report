# FF14 時尚品鑑記錄（FashionReport）

紀錄 FFXIV 每週時尚品鑑作業（主題、得分、裝備來源、備註），純前端網頁，
資料可選擇只存在瀏覽器本機，也可以登入 Google 帳號後同步到雲端（Firebase）。

## 專案結構

```
FashionReport/
├─ index.html            主頁面
├─ css/style.css         樣式
├─ js/
│  ├─ app.js             UI 邏輯（表單、記錄卡片渲染、匯出/匯入）
│  ├─ firebase-sync.js   雲端同步邏輯（登入、讀寫 Firestore）
│  └─ firebase-config.js Firebase 專案設定值（見下方「設定 Firebase」）
├─ firestore.rules       建議的 Firestore 安全規則
└─ .gitignore
```

## 資料儲存方式

- **未登入**：資料只寫在瀏覽器的 `localStorage`，換瀏覽器/清快取就會不見。
- **登入 Google 帳號後**：
  - 每次新增/刪除/排序/匯入都會把整份記錄陣列寫進 Firestore 的
    `users/{你的 Google 帳號 uid}` 這份文件。
  - 換裝置登入同一個 Google 帳號，會自動把雲端資料抓下來覆蓋本機、並持續即時同步。
  - `localStorage` 仍然會保留一份最新快取，離線時可以繼續看/編輯，之後連上網會再同步。

跟前一版工具（用亂數產生「裝置 ID」當密碼）不同，這裡身分驗證交給
Firebase Authentication／Google 帳號負責，沒有人能用猜到的字串冒充你去讀寫你的資料。

## 設定 Firebase（首次使用必做）

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立一個新專案
   （或用既有專案），專案名稱隨意，例如 `fashion-report`。
2. 左側選單 **Build → Authentication** → 「開始使用」→ Sign-in method
   分頁 → 啟用 **Google** 登入方式。
3. 左側選單 **Build → Firestore Database** → 建立資料庫
   （地區建議選 `asia-east1` 台灣近的區域，正式環境模式即可，規則等下換掉）。
4. Firestore 的 **規則（Rules）** 分頁，把整份貼成本專案 `firestore.rules`
   的內容，按「發布」。
5. 左上角齒輪 → **專案設定** → 一般 → 往下捲到「你的應用程式」→
   點 `</>`（新增 Web 應用程式），名稱隨意，**不需要**勾 Firebase Hosting。
   建立後會看到一組設定值，長得像：
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "fashion-report-xxxx.firebaseapp.com",
     projectId: "fashion-report-xxxx",
     storageBucket: "fashion-report-xxxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   把這整組值複製貼到 `js/firebase-config.js` 對應欄位（取代 `YOUR_...` 那些預留字）。
   **這組設定不是密鑰，可以放心一起 commit 進 git、公開在 GitHub 上。**
6. **Authentication → Settings → Authorized domains**：
   加入你之後 GitHub Pages 會用到的網域，例如 `你的帳號.github.io`
   （`localhost` 預設就有，本機測試不用另外加）。

完成以上步驟後，本機用瀏覽器打開 `index.html`（或用任何簡易伺服器，如
`npx serve` / VS Code Live Server）就可以測試登入與同步。

> ⚠️ 直接用 `file://` 開啟 `index.html` 時，部分瀏覽器會擋掉 ES module
> 的 `import`（`firebase-sync.js` 用的是 `type="module"`），
> 建議一律透過 `http://localhost` 這類伺服器方式測試。

## 上架到 GitHub Pages

```bash
git init            # 已在建立專案時完成
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的帳號>/FashionReport.git
git push -u origin main
```

接著到 GitHub repo 的 **Settings → Pages**，Source 選 `main` 分支、根目錄
`/(root)`，存檔後幾分鐘即可透過
`https://<你的帳號>.github.io/FashionReport/` 存取。

記得回到 Firebase Console 的 Authorized domains 確認
`<你的帳號>.github.io` 已加入，否則正式站台上 Google 登入視窗會失敗。

## 已知限制／設計取捨

- 沒有做「多裝置同時編輯」的即時合併機制：目前是「整包記錄陣列覆寫」，
  如果你同時在兩台裝置各自編輯，最後寫入的會蓋掉另一邊，適合單人使用情境。
- 沒有像前一版工具那樣的「房間共編」功能——這需要更完整的資料模型與規則
  設計，之後有需要再另外討論。
