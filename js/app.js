const STORAGE_KEY = "ff14-fashion-report-v2";
let records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

const SLOTS = [
  { key:"head", label:"頭" },
  { key:"body", label:"身" },
  { key:"hand", label:"手" },
  { key:"leg",  label:"腿" },
  { key:"foot", label:"腳" },
  { key:"ear",  label:"耳" },
  { key:"neck", label:"項" },
  { key:"wrist",label:"鐲" },
  { key:"ring", label:"指" },
  { key:"dye",  label:"染" },
];

// ── 雲端同步狀態 UI ──
function setSyncStatus(cls, text) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.className = "sync-status" + (cls ? " " + cls : "");
  el.textContent = text || "";
}

function updateAuthUI(user) {
  const statusEl = document.getElementById("authStatus");
  const inBtn = document.getElementById("btnSignIn");
  const outBtn = document.getElementById("btnSignOut");
  if (!statusEl || !inBtn || !outBtn) return;
  if (user) {
    statusEl.textContent = `已登入：${user.displayName || user.email || user.uid.slice(0,8)}（雲端同步中）`;
    inBtn.style.display = "none";
    outBtn.style.display = "";
  } else {
    statusEl.textContent = "未登入（資料僅存在本機瀏覽器）";
    inBtn.style.display = "";
    outBtn.style.display = "none";
    setSyncStatus("", "");
  }
}

// 雲端資料變動時（登入當下的第一筆快照、或其他共編者寫入後）套用到畫面
// data 格式：{ records, updatedAt, updatedBy } 或 null（共用文件還沒建立過）
function handleRemoteRecords(data) {
  if (data === null) {
    // 共用文件還沒有任何資料：把目前本機資料視為初始值，推一份上去
    if (records.length) {
      window.FashionCloud.pushRecords(records).catch(err => {
        setSyncStatus("error", "❌ 初始上傳失敗：" + (err?.message || err));
      });
    }
    return;
  }
  records = data.records;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();
  const who = data.updatedBy ? `（最後編輯：${data.updatedBy}）` : "";
  setSyncStatus("ok", `✅ 已同步${who}`);
}

// ── 儲存：本機 localStorage 一律先寫入（離線也能用），登入時再同步推上雲端 ──
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  if (window.FashionCloud?.isSignedIn?.()) {
    setSyncStatus("busy", "⏳ 同步中…");
    window.FashionCloud.pushRecords(records)
      .then(() => setSyncStatus("ok", "✅ 已同步"))
      .catch(err => setSyncStatus("error", "❌ 同步失敗：" + (err?.message || err)));
  }
}

window.addEventListener("fashionCloudReady", () => {
  window.FashionCloud.onAuthChange(updateAuthUI);
  window.FashionCloud.onRemoteUpdate(handleRemoteRecords);
  window.FashionCloud._onError = (err) => setSyncStatus("error", "❌ " + (err?.message || err));
});

// ── Build slot form ──
function buildSlotsForm() {
  const container = document.getElementById("slotsForm");
  container.innerHTML = "";
  SLOTS.forEach(({ key, label }) => {
    const wrapper = document.createElement("div");
    wrapper.id = `slot-wrapper-${key}`;
    wrapper.appendChild(makeSlotRow(label, key, true));
    container.appendChild(wrapper);
  });
}

function makeSlotRow(label, key, isFirst) {
  const row = document.createElement("div");
  row.className = "slot-row" + (isFirst ? "" : " extra");

  const lbl = document.createElement("span");
  lbl.className = "slot-label";
  lbl.textContent = label;

  const nameIn = document.createElement("input");
  nameIn.type = "text";
  nameIn.placeholder = "裝備名稱";
  nameIn.dataset.field = "name";

  const howIn = document.createElement("textarea");
  howIn.placeholder = "取得方式";
  howIn.dataset.field = "how";
  howIn.rows = 1;
  howIn.style.cssText = "resize:vertical; min-height:2rem; overflow-y:hidden;";

  const btn = document.createElement("button");
  btn.type = "button";
  if (isFirst) {
    btn.className = "btn-add-row";
    btn.textContent = "＋";
    btn.title = "新增一列";
    btn.onclick = () => {
      const wrapper = document.getElementById(`slot-wrapper-${key}`);
      wrapper.appendChild(makeSlotRow(label, key, false));
    };
  } else {
    btn.className = "btn-del-row";
    btn.textContent = "✕";
    btn.title = "刪除此列";
    btn.onclick = () => row.remove();
  }

  row.append(lbl, nameIn, howIn, btn);
  return row;
}

function readSlots() {
  const result = {};
  SLOTS.forEach(({ key }) => {
    const wrapper = document.getElementById(`slot-wrapper-${key}`);
    result[key] = [...wrapper.querySelectorAll(".slot-row")].map(row => ({
      name: row.querySelector('[data-field="name"]').value.trim(),
      how:  row.querySelector('[data-field="how"]').value.trim(),
    })).filter(e => e.name || e.how);
  });
  return result;
}

// ── Drag ──
let dragSrc = null, dragAllowed = false;
function initDrag(el, id) {
  el.setAttribute("draggable", "true");
  const handle = el.querySelector(".record-drag");
  if (handle) {
    handle.addEventListener("mousedown", () => { dragAllowed = true; });
    handle.addEventListener("mouseup",   () => { dragAllowed = false; });
  }
  el.addEventListener("dragstart", e => {
    if (!dragAllowed) { e.preventDefault(); return; }
    dragSrc = el; el.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  });
  el.addEventListener("dragend", () => {
    dragAllowed = false; el.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(n => n.classList.remove("drag-over"));
    dragSrc = null;
  });
  el.addEventListener("dragover", e => {
    e.preventDefault();
    if (dragSrc && dragSrc !== el) el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
  el.addEventListener("drop", e => {
    e.preventDefault(); el.classList.remove("drag-over");
    if (!dragSrc || dragSrc === el) return;
    const si = records.findIndex(r => r.id === parseInt(e.dataTransfer.getData("text/plain")));
    const di = records.findIndex(r => r.id === id);
    if (si === -1 || di === -1) return;
    const [moved] = records.splice(si, 1);
    records.splice(di, 0, moved);
    persist(); render();
  });
}

// ── Add ──
function addRecord() {
  records.unshift({
    id: Date.now(),
    date:  document.getElementById("frDate").value,
    score: document.getElementById("frScore").value,
    theme: document.getElementById("frTheme").value.trim(),
    desc:  document.getElementById("frDesc").value.trim(),
    slots: readSlots(),
    note:  document.getElementById("frNote").value.trim(),
  });
  persist();
  document.getElementById("frTheme").value = "";
  document.getElementById("frDesc").value  = "";
  document.getElementById("frNote").value  = "";
  buildSlotsForm();
  render();
}

// ── Remove ──
function removeRecord(id) {
  records = records.filter(r => r.id !== id);
  persist();
  const container = document.getElementById("recordList");
  const card = [...container.querySelectorAll(".record-card")].find(el =>
    el.querySelector(`.del-btn[onclick="removeRecord(${id})"]`)
  );
  if (card) {
    card.classList.add("removing");
    card.addEventListener("animationend", () => {
      card.remove();
      if (!container.querySelector(".record-card"))
        container.innerHTML = `<div class="list-empty">— 尚無記錄 —</div>`;
    }, { once: true });
  }
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end   = new Date(start.getTime() + 4 * 24 * 3600 * 1000);
  const pad = n => String(n).padStart(2, "0");
  const sy = start.getUTCFullYear(), sm = pad(start.getUTCMonth()+1), sd = pad(start.getUTCDate());
  const ey = end.getUTCFullYear(),   em = pad(end.getUTCMonth()+1),   ed = pad(end.getUTCDate());
  return `${sy}/${sm}/${sd} ~ ${ey}/${em}/${ed} 16:00`;
}
function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Render ──
function render() {
  const container = document.getElementById("recordList");
  if (records.length === 0) {
    container.innerHTML = `<div class="list-empty">— 尚無記錄，請從左側新增，或登入後自動載入雲端資料 —</div>`;
    return;
  }
  container.innerHTML = "";
  records.forEach(r => {
    const div = document.createElement("div");
    div.className = "record-card";

    const badgeClass = r.score==="100" ? "score-100" : r.score==="80" ? "score-80" : "score-other";
    const badgeText  = r.score==="other" ? "其他" : `${r.score} 分`;

    let slotRows = "";
    SLOTS.forEach(({ key, label }) => {
      let arr = r.slots?.[key] || [];
      if (typeof arr === "string") arr = arr ? [{name:arr, how:""}] : [];
      arr.forEach((e, i) => {
        if (!e.name && !e.how) return;
        slotRows += `<tr>
          <td class="slot-lbl">${i===0 ? escHtml(label) : ""}</td>
          <td class="slot-name">${escHtml(e.name)}</td>
          <td class="slot-how">${escHtml(e.how)}</td>
        </tr>`;
      });
    });

    const slotsHtml = slotRows ? `
      <table class="slots-table">
        <thead><tr><th></th><th>裝備</th><th>取得方式</th></tr></thead>
        <tbody>${slotRows}</tbody>
      </table>` : "";

    div.innerHTML = `
      <div class="record-card-header">
        <span class="record-drag" title="拖曳排序">⠿</span>
        <span class="score-badge ${badgeClass}">${badgeText}</span>
        <span class="record-date selectable">${fmtDate(r.date)}</span>
        <button class="del-btn" onclick="removeRecord(${r.id})" title="刪除">✕</button>
      </div>
      ${r.theme ? `<div class="record-block-label">主題</div><div class="record-theme selectable">${escHtml(r.theme)}</div>` : ""}
      ${r.desc  ? `<div class="record-block-label">說明</div><div class="record-desc selectable">${escHtml(r.desc)}</div>` : ""}
      ${slotsHtml}
      ${r.note  ? `<div class="record-note selectable">${escHtml(r.note)}</div>` : ""}
    `;

    container.appendChild(div);
    div.querySelectorAll(".selectable").forEach(el => {
      el.addEventListener("mousedown", e => e.stopPropagation());
      el.addEventListener("dragstart", e => e.preventDefault());
    });
    initDrag(div, r.id);
  });
}

// ── Export / Import ──
function exportData() {
  const blob = new Blob([JSON.stringify({ version:2, exportedAt:new Date().toISOString(), records }, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FF14時尚品鑑_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("✅ 資料已匯出");
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const p = JSON.parse(ev.target.result);
      if (!p.version || !Array.isArray(p.records)) throw new Error();
      records = p.records; persist(); render();
      showToast("✅ 資料匯入成功" + (window.FashionCloud?.isSignedIn?.() ? "，已同步至雲端" : "（僅本機，登入後可同步）"));
    } catch { showToast("❌ 匯入失敗：檔案格式不正確"); }
    e.target.value = "";
  };
  reader.readAsText(file);
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

document.getElementById("frDate").value = new Date().toISOString().slice(0, 10);
buildSlotsForm();
render();
