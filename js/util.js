// ✅ 공통 fetch POST 함수
function postData(path, data, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `서버 오류 (${res.status})`);
        }
        return res.json();
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ 요청 실패:", err);
        if (onError) onError(err);
        else showToast("❌ 오류: " + err.message);
    });
}

// ✅ 공통 PUT 요청 함수
function putData(path, data, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `수정 실패 (${res.status})`);
        }
        return res.json();
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

// ✅ DELETE 요청용 함수
function deleteData(path, onSuccess, onError) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    fetch(url, { method: "DELETE" })
    .then(res => {
        if (!res.ok) throw new Error("삭제 실패");
        return res.json();
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
 * ✅ 누락된 관리자 UI 활성화 함수 복구
 */
function applyMenuBoardRoleUI() {
  const isAdmin = isAdminUser();
  const adminBar = document.getElementById("menuBoardAdminBar");

  if (adminBar) {
    if (isAdmin) {
      // hidden과 ui-hidden을 모두 제거하여 CSS 선택자가 작동하게 함
      adminBar.classList.remove("hidden", "ui-hidden"); 
      adminBar.style.setProperty("display", "flex", "important");
    } else {
      adminBar.classList.add("hidden");
      adminBar.style.display = "none";
    }
  }
}

/**
 * ✅ 누락된 초기화 함수 복구
 */
function initMenuBoard() {
  applyMenuBoardRoleUI(); // 관리자 버튼 노출 여부 결정
  if (typeof bindMenuBoardEvents === "function") bindMenuBoardEvents(); // 이벤트 연결
  renderMenuBoard(); // 목록 불러오기
}

// 외부에서 호출할 수 있도록 window 객체에 등록
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

function getWeekdayName(dateStr) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return days[new Date(dateStr).getDay()];
}

function getWeekStartAndEnd(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return { start: getKSTDateString(monday), end: getKSTDateString(friday) };
}

function getKSTDateString(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const kst = new Date(date.getTime() - tzOffset + (9 * 60 * 60 * 1000));
    return kst.toISOString().slice(0, 10);
}

function getKSTDate() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + (9 * 60 * 60000));
}

/* ==========================================
   🖼️ 식단표 게시판 (Refactored)
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

// ✅ 모달 창 리팩토링: 인쇄 버튼 추가
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

// ✅ 썸네일 생성 리팩토링: 카드 구조 및 인쇄 버튼 삽입
function createMenuThumb(item, adminMode) {
  const container = document.createElement("div");
  container.className = "menu-item-card"; // CSS 스타일링을 위한 래퍼

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

  // 개별 인쇄 버튼 추가
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

// ✅ 식단표 렌더링 (기존 로직 유지)
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


// ✅ 1. 공휴일 리스트 fetch 함수 복구
function fetchHolidayList(path, onSuccess, onError) {
    getData(path,
        (data) => { if (onSuccess) onSuccess(data); },
        (err) => { 
            console.error("공휴일 불러오기 실패:", err); 
            if (onError) onError(err); 
        }
    );
}

// ✅ 2. 식단표 이미지 업로드 함수 복구
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

// ✅ 3. 식단표 삭제 API 호출 함수 복구
async function deleteMenuBoardItems(ids) {
  const response = await fetch(resolveMenuImageUrl("/api/menu-board/delete"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
  if (!response.ok) throw new Error("삭제 실패");
  return await response.json();
}

// ✅ 4. 선택된 항목 삭제 실행 함수 복구
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
    await renderMenuBoard(); // 목록 새로고침
  } catch (error) {
    console.error("❌ 식단표 삭제 실패:", error);
    alert(`❌ 식단표 삭제 실패: ${error.message}`);
  }
}

// ✅ 5. 가장 중요한 버튼 기능 연결(Event Binding) 함수 복구
function bindMenuBoardEvents() {
  const uploadBtn = document.getElementById("menuUploadBtn");
  const deleteBtn = document.getElementById("menuDeleteBtn");
  const input = document.getElementById("menuUploadInput");
  const list = document.getElementById("menuList");

  // 업로드 버튼 클릭 이벤트
  if (uploadBtn && input && !uploadBtn.dataset.bound) {
    uploadBtn.dataset.bound = "1";
    uploadBtn.addEventListener("click", () => {
      if (!isAdminUser()) return alert("관리자만 업로드할 수 있습니다.");
      input.click(); // 숨겨진 input file 실행
    });
  }

  // 파일 선택 시 업로드 실행 이벤트
  if (input && !input.dataset.bound) {
    input.dataset.bound = "1";
    input.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      try {
        const result = await uploadMenuBoardImage(file);
        if (!result?.cancelled) {
          alert("업로드 완료");
          await renderMenuBoard(); // 업로드 후 목록 갱신
        }
      } catch (error) {
        alert(error.message);
      } finally {
        event.target.value = ""; // 동일한 파일 재업로드 가능하게 초기화
      }
    });
  }

  // ✅ 삭제 버튼 클릭 이벤트 수정 (즉시 삭제 방식)
if (deleteBtn && list && !deleteBtn.dataset.bound) {
  deleteBtn.dataset.bound = "1";
  deleteBtn.addEventListener("click", async () => {
    // 1. 권한 체크
    if (!isAdminUser()) return alert("관리자만 삭제할 수 있습니다.");

    // 2. 체크박스 선택 여부 즉시 확인
    const checkedList = Array.from(document.querySelectorAll("#menuList .menu-select:checked"));
    
    if (checkedList.length === 0) {
      alert("삭제할 식단표를 먼저 체크해 주세요.");
      return;
    }

    // 3. 체크된 항목이 있다면 바로 삭제 프로세스 진행
    await deleteSelectedMenuBoardItems();
  });
}
}

function getCurrentWeekRange() {
    // 1. 현재 시간의 순수 UTC 타임스탬프(ms) 추출 (로컬 설정 무시)
    const now = new Date();
    const utcTimestamp = now.getTime(); 
    
    // 2. 한국 시간(KST) 보정: UTC 타임스탬프 + 9시간
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kstTimestamp = utcTimestamp + KST_OFFSET;
    
    // 3. 보정된 타임스탬프를 기준으로 요일 추출
    // 🚨 이미 한국시간으로 9시간을 밀어두었으므로, 로컬의 영향을 받지 않는 getUTCDay()를 사용해야 합니다.
    const kstDate = new Date(kstTimestamp);
    const day = kstDate.getUTCDay(); // 0(일) ~ 6(토)
    
    // 4. 월요일로 가기 위한 날짜(ms) 차이 계산
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    // 5. 한국 시간 기준 월요일과 금요일의 타임스탬프 계산
    const mondayTimestamp = kstTimestamp + (diffToMonday * ONE_DAY);
    const fridayTimestamp = mondayTimestamp + (4 * ONE_DAY);
    
    // 6. 결과 반환
    // 이미 내부 시간이 KST로 +9시간 맞춰져 있으므로, 
    // 무조건 UTC 기준으로 문자를 내뱉는 toISOString()을 사용하면 정확히 KST 날짜가 출력됩니다.
    return {
        start: new Date(mondayTimestamp).toISOString().split('T')[0],
        end: new Date(fridayTimestamp).toISOString().split('T')[0]
    };
}

/**
 * ISO 형식의 날짜 문자열을 한국 시간 형식(YYYY-MM-DD HH:mm:ss)으로 변환하는 함수
 */
function formatToKoreanTime(dateStr) {
    if (!dateStr) return "-";
    
    const date = new Date(dateStr);
    
    // 유효하지 않은 날짜인 경우 처리
    if (isNaN(date.getTime())) return "-"; 

    return date.toLocaleString("ko-KR", { 
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false // 24시간제로 표시하려면 false, 오전/오후로 표시하려면 true
    });
}