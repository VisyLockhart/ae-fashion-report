// ────────────────────────────────────────────────────────────────
// FashionReport 雲端同步層（共編模式）
//
// 設計：所有登入者（任何 Google 帳號）讀寫的是同一份共用文件
// shared/fashionReport，不是各自獨立一份。這是刻意選擇的開放式
// 共同編輯設計——任何用 Google 帳號登入的人都能修改或刪除這份
// 共用資料，沒有白名單限制。若之後想收緊存取範圍（例如只給特定
// 幾個信箱），要同時改這裡的資料路徑邏輯，以及 Firestore Console
// 的 firestore.rules。
//
// 身分驗證本身仍然用 Firebase Authentication 的 Google 登入——
// 不是像更早一版工具那樣自己用 Math.random() 產生「裝置 ID」當密碼，
// 身分是 Google/Firebase 簽發、無法偽造的。
// ────────────────────────────────────────────────────────────────

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
// signOut() 只登出這個網站的 Firebase 登入狀態，不會登出瀏覽器裡 Google 本身的
// session；不加這行的話，Google 預設會直接沿用瀏覽器裡現成的帳號、不跳選擇畫面。
// 加上 prompt: 'select_account' 強制每次登入都跳出帳號選擇器，方便切換測試帳號。
provider.setCustomParameters({ prompt: 'select_account' });

const SHARED_DOC_PATH = ['shared', 'fashionReport'];

let currentUser = null;
let unsubscribeSnapshot = null;
let onRemoteUpdateCb = null;
let onAuthChangeCb = null;

function sharedDocRef() {
  return doc(db, ...SHARED_DOC_PATH);
}

function subscribeSharedDoc() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = onSnapshot(
    sharedDocRef(),
    snap => {
      if (snap.exists()) {
        const data = snap.data();
        onRemoteUpdateCb?.({
          records: Array.isArray(data.records) ? data.records : [],
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || null,
        });
      } else {
        onRemoteUpdateCb?.(null); // 共用文件還沒建立過
      }
    },
    err => {
      console.error('Firestore 監聽失敗:', err);
      window.FashionCloud?._onError?.(err);
    }
  );
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  if (user) subscribeSharedDoc();
  onAuthChangeCb?.(user);
});

async function pushRecords(records) {
  if (!currentUser) throw new Error('尚未登入，無法寫入雲端');
  await setDoc(sharedDocRef(), {
    records,
    updatedAt: Date.now(),
    updatedBy: currentUser.displayName || currentUser.email || currentUser.uid,
  });
}

window.FashionCloud = {
  signIn() {
    return signInWithPopup(auth, provider).catch(err => {
      // 使用者自己關掉登入彈窗、或分頁切到背景導致彈窗被系統關掉，
      // 這是很正常的操作，不算錯誤，不用嚇使用者。
      const benign = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
      if (benign.includes(err?.code)) {
        console.info('登入視窗已關閉，未完成登入。');
        return;
      }
      console.error(err);
      window.FashionCloud._onError?.(err);
    });
  },
  signOut() {
    return fbSignOut(auth);
  },
  isSignedIn() { return !!currentUser; },
  get currentUser() { return currentUser; },
  pushRecords,
  onRemoteUpdate(cb) { onRemoteUpdateCb = cb; },
  onAuthChange(cb) { onAuthChangeCb = cb; cb(currentUser); },
  _onError: null,
};

window.dispatchEvent(new CustomEvent('fashionCloudReady'));
