// util.js

// =================================================================
// 💡 전역 서버 시간 동기화 및 보정을 위한 베이스 구조 정의
// =================================================================
window.serverTimeDiff = window.serverTimeDiff || 0;

/**
 * 💡 사용자의 로컬 PC 컴퓨터 시간이 아닌, 오차가 보정된 '진짜 서버 KST 시간'을 리턴합니다.
 */
function getKSTNow() {
    return new Date(Date.now() + window.serverTimeDiff);
}
window.getKSTNow = getKSTNow;

/**
 * 💡 앱 구동 시 백엔드에게 현재 시간을 물어보고 오차값(ms)을 계산하는 함수
 */
function syncServerTime(callback) {
    getData("/api/server-time", (data) => {
        // 백엔드가 제공한 정밀한 KST 시각 문자열을 날짜 객체로 변환
        const serverTime = new Date(data.server_time.replace(' ', 'T') + '+09:00');
        const localTime = new Date();
        // 서버 시각과 브라우저 시각의 물리적인 차이 저장 (사용자가 컴퓨터 시계 조작 시 방어 목적)
        window.serverTimeDiff = serverTime.getTime() - localTime.getTime();
        console.log(`⏰ 서버 시간 동기화 완료 (오차 보정값: ${window.serverTimeDiff}ms)`);
        if (callback) callback();
    }, () => {
        console.warn("⚠️ 서버 시간 동기화 실패. 로컬 PC 시각으로 구동합니다.");
        window.serverTimeDiff = 0;
        if (callback) callback();
    });
}
window.syncServerTime = syncServerTime;

// =================================================================
// 💡 마감시간 관리를 위한 API 라우트 경로 통합 정의
// config.js에 선언된 API_BASE_URL을 가져와 완성된 경로를 제공합니다.
// =================================================================
const API_ROUTES = {
    DEADLINES: `${API_BASE_URL}/admin/api/deadlines`
};

// ✅ 공통 fetch POST 함수 (스트림 중복 소비 버그 완벽 수정)
function postData(path, data, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(async res => {
        const text = await res.text(); // 스트림을 텍스트로 딱 한 번만 안전하게 읽음
        if (!res.ok) {
            let parsedErr;
            try { parsedErr = JSON.parse(text); } catch(e) { parsedErr = {}; }
            throw new Error(parsedErr.error || `서버 오류 (${res.status})`);
        }
        try { return JSON.parse(text); } catch(e) { return {}; }
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ 요청 실패:", err);
        if (onError) onError(err);
        else showToast("❌ 오류: " + err.message);
    });
}

// ✅ 공통 fetch PUT 함수 (스트림 중복 소비 버그 완벽 수정)
function putData(path, data, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(async res => {
        const text = await res.text(); // 스트림 중복 소비 방지 보정
        if (!res.ok) {
            let parsedErr;
            try { parsedErr = JSON.parse(text); } catch(e) { parsedErr = {}; }
            throw new Error(parsedErr.error || `수정 실패 (${res.status})`);
        }
        try { return JSON.parse(text); } catch(e) { return {}; }
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ PUT 요청 실패:", err);
        if (onError) onError(err);
        else showToast("❌ 수정 오류: " + err.message);
    });
}

// ✅ 공통 Toast 메시지 함수
function showToast(message, duration = 2000) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.className = "toast show";
    setTimeout(() => { toast.className = "toast"; }, duration);
}

// 💡 공통 API 호출용 비동기 함수 (deadline_config.js 연동 규격 호환용)
async function requestApi(url, options = {}) {
    try {
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        const response = await fetch(url, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `서버 에러가 발생했습니다. (Status: ${response.status})`);
        }

        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`[API Error] URL: ${url}`, error);
        throw error;
    }
}

// ✅ DELETE 요청용 함수
function deleteData(path, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url, { method: "DELETE" })
    .then(async res => {
        const text = await res.text();
        if (!res.ok) throw new Error("삭제 실패");
        try { return JSON.parse(text); } catch(e) { return {}; }
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ 삭제 오류:", err);
        if (onError) onError(err);
        else showToast("❌ 삭제 실패: " + err.message);
    });
}

// ✅ GET 요청용 함수
function getData(path, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url)
        .then(async res => {
            const text = await res.text();
            if (!res.ok) {
                if (onError) onError(new Error(text));
                else showToast("❌ 서버 오류: " + text);
                return;
            }
            try {
                const data = JSON.parse(text);
                onSuccess(data);
            } catch (err) {
                if (onError) onError(new Error("JSON 파싱 실패"));
            }
        })
        .catch(err => {
            if (onError) onError(err);
            else showToast("❌ 데이터를 불러오는 중 오류: " + err.message);
        });
}

/**
 * ✅ 관리자 UI 활성화 함수
 */
function applyMenuBoardRoleUI() {
  const isAdmin = isAdminUser();
  const adminBar = document.getElementById("menuBoardAdminBar");

  if (adminBar) {
    if (isAdmin) {
      adminBar.classList.remove("hidden", "ui-hidden"); 
      adminBar.style.setProperty("display", "flex", "important");
    } else {
      adminBar.classList.add("hidden");
      adminBar.style.display = "none";
    }
  }
}

/**
 * ✅ 초기화 함수
 */
function initMenuBoard() {
  applyMenuBoardRoleUI(); 
  if (typeof bindMenuBoardEvents === "function") bindMenuBoardEvents(); 
  renderMenuBoard(); 
}

window.initMenuBoard = initMenuBoard;

/**
 * ✅ 식단표 이미지를 새 창에서 인쇄하는 공통 함수
 */
function printMenuImage(imgSrc) {
  if (!imgSrc) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>식단표 인쇄</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
          img { max-width: 100%; max-height: 95vh; object-fit: contain; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <img src="${imgSrc}" />
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ✅ 날짜 관련 유틸리티 함수들
function normalizeDate(dateStr) {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
}

// ✅ 요일 이름 가져오기
function getWeekdayName(dateStr) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return days[new Date(dateStr).getDay()];
}

// ✅ 이번 주 월요일 ~ 금요일 범위 계산
function getWeekStartAndEnd(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return { start: getKSTDateString(monday), end: getKSTDateString(friday) };
}

// ✅ KST 시간 적용 데이터 포맷 문자열 변환
function getKSTDateString(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const kst = new Date(date.getTime() - tzOffset + (9 * 60 * 60 * 1000));
    return kst.toISOString().slice(0, 10);
}

// ✅ KST 현재 시각 데이터 반환
function getKSTDate() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + (9 * 60 * 60000));
}

/* ==========================================
    🖼️ 식단표 게시판
========================================== */

function isAdminUser() {
  try {
    const user = JSON.parse(sessionStorage.getItem("currentUser") || "null");
    return !!user && String(user.level) === "3";
  } catch (error) { return false; }
}

function resolveMenuImageUrl(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = (typeof API_BASE_URL === "string" ? API_BASE_URL : "").replace(/\/+$/, "");
  return imageUrl.startsWith("/") ? `${base}${imageUrl}` : `${base}/${imageUrl}`;
}

function openMenuImageModal(src, title) {
  if (!src) return;
  let modal = document.getElementById("menuModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "menuModal";
    modal.className = "menu-modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close="1"></div>
    <div class="menu-modal__panel" role="dialog" aria-modal="true">
      <div class="menu-modal__header">
        <div class="menu-modal__title">${title || "식단표"}</div>
        <div class="menu-modal__actions">
          <button type="button" class="action-btn visitor-btn" onclick="printMenuImage('${src}')">🖨️ 인쇄</button>
          <button type="button" class="menu-modal__close" data-close="1">✕</button>
        </div>
      </div>
      <div class="menu-modal__body">
        <img src="${src}" alt="식단표 원본" />
      </div>
    </div>
  `;

  modal.onclick = (e) => { if (e.target.dataset.close) modal.classList.remove("open"); };
  modal.classList.add("open");
}

function createMenuThumb(item, adminMode) {
  const container = document.createElement("div");
  container.className = "menu-item-card"; 

  const button = document.createElement("button");
  button.type = "button";
  button.className = "menu-thumb";
  button.dataset.src = item.image_url || "";
  button.dataset.title = item.title || "식단표";
  button.onclick = () => openMenuImageModal(item.image_url, item.title);

  if (adminMode) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "menu-select";
    checkbox.value = item.id;
    checkbox.onclick = (e) => e.stopPropagation();
    button.appendChild(checkbox);
  }

  const image = document.createElement("img");
  image.src = item.image_url || "";
  image.alt = item.title;

  const caption = document.createElement("div");
  caption.className = "menu-item-title";
  caption.textContent = item.title || "식단표";

  button.appendChild(image);
  button.appendChild(caption);

  const printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.className = "action-btn menu-print-btn";
  printBtn.innerHTML = "🖨️ 바로 인쇄";
  printBtn.onclick = (e) => {
    e.stopPropagation();
    printMenuImage(item.image_url);
  };

  container.appendChild(button);
  container.appendChild(printBtn);
  return container;
}

async function renderMenuBoard() {
  const list = document.getElementById("menuList");
  if (!list) return;
  try {
    list.innerHTML = `<div class="menu-empty">불러오는 중...</div>`;
    const response = await fetch(resolveMenuImageUrl("/api/menu-board"));
    const items = await response.json();
    const adminMode = isAdminUser();
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<div class="menu-empty">등록된 식단표가 없습니다.</div>`;
      return;
    }
    items.forEach(item => {
      item.image_url = resolveMenuImageUrl(item.image_url);
      list.appendChild(createMenuThumb(item, adminMode));
    });
  } catch (error) {
    list.innerHTML = `<div class="menu-empty">데이터를 불러오지 못했습니다.</div>`;
  }
}

function fetchHolidayList(path, onSuccess, onError) {
    getData(path,
        (data) => { if (onSuccess) onSuccess(data); },
        (err) => { 
            console.error("공휴일 불러오기 실패:", err);
            if (onError) onError(err); 
        }
    );
}

async function uploadMenuBoardImage(file) {
  if (!file) throw new Error("업로드할 파일이 없습니다.");

  const defaultTitle = file.name.replace(/\.[^.]+$/, "");
  const title = prompt("식단표 제목을 입력하세요. (예: 3월 3주차 식단표)", defaultTitle);
  if (title === null) return { cancelled: true };

  const formData = new FormData();
  formData.append("image", file);
  formData.append("title", title.trim() || defaultTitle);

  const response = await fetch(resolveMenuImageUrl("/api/menu-board/upload"), {
    method: "POST",
    body: formData
  });

  if (!response.ok) throw new Error("업로드 실패");
  return await response.json();
}

async function deleteMenuBoardItems(ids) {
  const response = await fetch(resolveMenuImageUrl("/api/menu-board/delete"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
  if (!response.ok) throw new Error("삭제 실패");
  return await response.json();
}

async function deleteSelectedMenuBoardItems() {
  const checkedList = Array.from(document.querySelectorAll("#menuList .menu-select:checked"));
  if (checkedList.length === 0) {
    alert("삭제할 게시글을 체크하세요.");
    return;
  }
  if (!confirm(`선택한 ${checkedList.length}개 게시글을 삭제할까요?`)) return;

  const ids = checkedList.map(checkbox => checkbox.value);
  try {
    await deleteMenuBoardItems(ids);
    alert("삭제 완료");
    await renderMenuBoard(); 
  } catch (error) {
    console.error("❌ 식단표 삭제 실패:", error);
    alert(`❌ 식단표 삭제 실패: ${error.message}`);
  }
}

function bindMenuBoardEvents() {
  const uploadBtn = document.getElementById("menuUploadBtn");
  const deleteBtn = document.getElementById("menuDeleteBtn");
  const input = document.getElementById("menuUploadInput");
  const list = document.getElementById("menuList");

  if (uploadBtn && input && !uploadBtn.dataset.bound) {
    uploadBtn.dataset.bound = "1";
    uploadBtn.addEventListener("click", () => {
      if (!isAdminUser()) return alert("관리자만 업로드할 수 있습니다.");
      input.click(); 
    });
  }

  if (input && !input.dataset.bound) {
    input.dataset.bound = "1";
    input.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      try {
        const result = await uploadMenuBoardImage(file);
        if (!result?.cancelled) {
          alert("업로드 완료");
          await renderMenuBoard(); 
        }
      } catch (error) {
        alert(error.message);
      } finally {
        event.target.value = ""; 
      }
    });
  }

  if (deleteBtn && list && !deleteBtn.dataset.bound) {
    deleteBtn.dataset.bound = "1";
    deleteBtn.addEventListener("click", async () => {
      if (!isAdminUser()) return alert("관리자만 삭제할 수 있습니다.");
      const checkedList = Array.from(document.querySelectorAll("#menuList .menu-select:checked"));
      
      if (checkedList.length === 0) {
        alert("삭제할 식단표를 먼저 체크해 주세요.");
        return;
      }
      await deleteSelectedMenuBoardItems();
    });
  }
}

function getCurrentWeekRange() {
    const now = new Date();
    const utcTimestamp = now.getTime(); 
    
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kstTimestamp = utcTimestamp + KST_OFFSET;
    
    const kstDate = new Date(kstTimestamp);
    const day = kstDate.getUTCDay(); 
    
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    const mondayTimestamp = kstTimestamp + (diffToMonday * ONE_DAY);
    const fridayTimestamp = mondayTimestamp + (4 * ONE_DAY);
    
    return {
        start: new Date(mondayTimestamp).toISOString().split('T')[0],
        end: new Date(fridayTimestamp).toISOString().split('T')[0]
    };
}

function formatToKoreanTime(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-"; 

    return date.toLocaleString("ko-KR", { 
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false 
    });
}