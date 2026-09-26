// ────────────────────────────────────────────────────────────────
// FashionReport 雲端同步層
//
// 設計原則（吸取前一版工具的教訓）：
// 1. 不用「自己產生的隨機裝置 ID」當帳號密碼 —— 改用 Firebase Authentication
//    的 Google 登入，帳號身分由 Google/Firebase 簽發，無法偽造、可跨裝置使用。
// 2. Firestore 安全規則（見專案根目錄 firestore.rules）只允許
//    request.auth.uid 等於文件路徑上的 uid 的人讀寫自己的資料，
//    不是任何人都能讀寫任意使用者的資料。
// 3. apiKey 這類設定值公開沒關係（Firebase Web 設定本來就設計成可公開），
//    真正的存取控制永遠是 Firestore Rules，不是這組 config。
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

let currentUser = null;
let unsubscribeSnapshot = null;
let onRemoteRecordsCb = null;
let onAuthChangeCb = null;

function userDocRef(uid) {
  return doc(db, 'users', uid);
}

function subscribeRecords(uid) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = onSnapshot(
    userDocRef(uid),
    snap => {
      if (snap.exists()) {
        const data = snap.data();
        onRemoteRecordsCb?.(Array.isArray(data.records) ? data.records : []);
      } else {
        onRemoteRecordsCb?.(null); // 雲端尚無這個使用者的資料
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
  if (user) subscribeRecords(user.uid);
  onAuthChangeCb?.(user);
});

async function pushRecords(records) {
  if (!currentUser) throw new Error('尚未登入，無法寫入雲端');
  await setDoc(userDocRef(currentUser.uid), {
    records,
    updatedAt: Date.now(),
  });
}

window.FashionCloud = {
  signIn() {
    return signInWithPopup(auth, provider).catch(err => {
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
  onRemoteUpdate(cb) { onRemoteRecordsCb = cb; },
  onAuthChange(cb) { onAuthChangeCb = cb; cb(currentUser); },
  _onError: null,
};

window.dispatchEvent(new CustomEvent('fashionCloudReady'));
