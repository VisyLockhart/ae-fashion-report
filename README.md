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

## 資料儲存方式（共同編輯模式）

- **未登入**：資料只寫在瀏覽器的 `localStorage`，換瀏覽器/清快取就會不見。
- **登入 Google 帳號後**：
  - 所有登入者讀寫的是**同一份共用文件** `shared/fashionReport`，
    不是每個人各自一份——這是刻意選擇的開放式共編設計。
  - 每次新增/刪除/排序/匯入都會把整份記錄陣列寫進這份共用文件，
    同時附上 `updatedBy`（最後編輯者）。
  - 任何裝置登入任何 Google 帳號，都會立刻抓到同一份最新資料，並持續即時同步。
  - `localStorage` 仍然會保留一份最新快取，離線時可以繼續看/編輯，之後連上網會再同步。

**⚠️ 存取範圍是刻意完全開放的**：任何人只要能用 Google 帳號登入，就能讀寫、
甚至刪除這份共用資料，沒有白名單限制。這跟「身分驗證交給 Google 負責、
沒人能冒充你」是兩件事——冒充問題解決了，但「這個網站本來就設計成任何登入者
都能編輯」是另一個層面的存取控制決定，是你自己選的設計，不是漏洞。
如果之後想收緊（例如只讓特定幾個信箱能編輯），要同時改
`js/firebase-sync.js` 的資料路徑邏輯與 `firestore.rules`。

**⚠️ 沒有多人同時編輯的合併機制**：整份記錄陣列是「整包覆寫」，兩個人幾乎
同時編輯的話，較晚寫入的會蓋掉較早的，不會自動合併或警告衝突。適合「錯開時間
各自新增」的使用情境，不適合真的同時協作編輯同一筆記錄。

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

- 「整包記錄陣列覆寫」沒有合併機制，見上方「資料儲存方式」的警語。
- 存取控制是「任何 Google 帳號都能編輯」，沒有白名單、沒有唯讀模式——
  分享連結出去等於邀請對方一起編輯，不是唯讀分享。
- 如果之後想改成「只有特定 Discord 伺服器身分組才能登入」，需要額外的
  OAuth2 後端 + Firebase Admin 自訂登入憑證，屬於更大的架構調整，
  另外討論。
