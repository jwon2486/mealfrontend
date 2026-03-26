// visitor_request.js

let lastSubmittedDate = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. 네비게이션 및 사이드바 이벤트 바인딩
    setupSidebarAndTabs();

    // 2. 정적 버튼 이벤트 리스너 바인딩 (HTML에서 onclick 제거됨)
    const pageBtn = document.getElementById("page-button");
    if (pageBtn) pageBtn.addEventListener("click", goToMain);

    const saveBtn = document.getElementById("visit-data-save-btn");
    if (saveBtn) saveBtn.addEventListener("click", submitVisit);

    const loadThisWeekBtn = document.getElementById("load-thisweek-btn");
    if (loadThisWeekBtn) loadThisWeekBtn.addEventListener("click", loadThisWeek);

    const loadDataBtn = document.getElementById("load-visit-data-btn");
    if (loadDataBtn) loadDataBtn.addEventListener("click", loadWeeklyVisitData);

    const visitDateInput = document.getElementById("visit-date");
    if (visitDateInput) visitDateInput.addEventListener("change", handleDateChange);
    
    // 3. 동적 테이블 이벤트 위임 (수정, 삭제, 저장 버튼 클릭 처리)
    const visitSummaryBody = document.getElementById("visit-summary-body");
    if (visitSummaryBody) visitSummaryBody.addEventListener("click", handleTableActions);

    // 4. 초기 날짜 데이터 로드
    const storedDate = sessionStorage.getItem("lastVisitDate");
    if (storedDate) {
      const todayStr = getKSTDate().toISOString().split("T")[0];
      if (storedDate !== todayStr) {
        document.getElementById("visit-date").value = storedDate;
        document.getElementById("visit-week-date").value = storedDate;
      } else {
        setTodayDefault();
      }
    } else {
      setTodayDefault();
    }

    // 5. 로그인 정보 및 기본 UI 세팅
    loadLoginInfo();
    updateWeekday();
    loadWeeklyVisitData();

    if (typeof initMenuBoard === "function") initMenuBoard();
    
    // 6. 직영/협력사 권한별 UI 분기 처리
    applyUserTypeUI();
});

// ============================================================================
// UI 상태 제어 헬퍼 함수
// ============================================================================
function toggleVisibility(element, show, displayClass = 'ui-block') {
  if (!element) return;
  element.classList.remove('ui-hidden', 'ui-block', 'ui-inline-block', 'ui-flex');
  if (show) {
    element.classList.add(displayClass);
  } else {
    element.classList.add('ui-hidden');
  }
}

function applyUserTypeUI() {
  const userType = sessionStorage.getItem("type"); 
  const pageTitle = document.getElementById("page-title"); 
  const pageButton = document.getElementById("page-button"); 
  
  const reasonTh = document.getElementById("reason-th");
  const reasonInput = document.getElementById("visit-reason");
  const weeklyReasonTh = document.getElementById("weekly-reason-th");

  if (userType === "협력사") {
    if (pageTitle) pageTitle.innerText = "식수 신청 시스템";
    if (pageButton) pageButton.innerText = "🔙 로그아웃";
    toggleVisibility(weeklyReasonTh, true);
  } else if (userType === "직영") {
    if (pageTitle) pageTitle.innerText = "방문자 식수 신청";
    if (pageButton) pageButton.innerText = "🔙 뒤로가기";
    toggleVisibility(reasonTh, true);
    toggleVisibility(reasonInput, true);
    toggleVisibility(weeklyReasonTh, true);
  }
}

// ============================================================================
// 사이드바 및 탭 제어 로직 (HTML 스크립트에서 이관)
// ============================================================================
function setupSidebarAndTabs() {
  const mobileQuery = window.matchMedia("(max-width: 768px)");
  const mainArea = document.getElementById("mainArea");
  const toggle = document.getElementById("mobileMenuToggle");
  const links = document.querySelectorAll(".erp-nav-link[data-page]");
  const pages = document.querySelectorAll(".erp-page");
  const sideActions = document.querySelectorAll(".erp-side-action");

  function closeMobileSidebar() {
    if (!mainArea || !toggle) return;
    mainArea.classList.remove("mobile-sidebar-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function syncMobileSidebar() {
    if (!mainArea || !toggle) return;
    mainArea.classList.remove("mobile-sidebar-open");
    toggle.setAttribute("aria-expanded", !mobileQuery.matches ? "true" : "false");
  }

  links.forEach(btn => {
    btn.addEventListener("click", function () {
      const targetId = this.dataset.page;
      if (!targetId) return;

      links.forEach(el => el.classList.remove("active"));
      this.classList.add("active");

      pages.forEach(page => page.classList.remove("active"));
      const target = document.getElementById(targetId);
      if (target) target.classList.add("active");

      if (mobileQuery.matches) closeMobileSidebar();
    });
  });

  sideActions.forEach(btn => {
    btn.addEventListener("click", () => {
      if (mobileQuery.matches) closeMobileSidebar();
    });
  });

  if (toggle && mainArea) {
    toggle.addEventListener("click", () => {
      if (!mobileQuery.matches) return;
      const willOpen = !mainArea.classList.contains("mobile-sidebar-open");
      mainArea.classList.toggle("mobile-sidebar-open", willOpen);
      toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  syncMobileSidebar();
  window.addEventListener("resize", syncMobileSidebar);
}

// ============================================================================
// 날짜 및 캘린더 관련 로직
// ============================================================================
function handleDateChange() {
  const input = document.getElementById("visit-date");
  const picked = new Date(input.value);
   
  if (picked.getDay() === 0 || picked.getDay() === 6) {
    alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
    const adjusted = getNearestWeekday(picked);
    input.value = adjusted.toISOString().split("T")[0];
  }

  document.getElementById("visit-week-date").value = input.value;

  const bulkWrapper = document.getElementById("bulk-visit-wrapper");
  if (bulkWrapper && !bulkWrapper.classList.contains("ui-hidden")) {
    if (typeof renderBulkVisitRows === "function") renderBulkVisitRows(); 
  }

  updateWeekday();
  loadWeeklyVisitData(); 
}

function getThisWeekMonday() {
  const today = getKSTDate();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  monday.setHours(9, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function loadThisWeek() {
  const thisMonday = getThisWeekMonday();
  document.getElementById("visit-week-date").value = thisMonday;
  document.getElementById("visit-date").value = thisMonday;
  loadWeeklyVisitData();
}

function setTodayDefault() {
  const today = getKSTDate();
  const currentDay = today.getDay();
  const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(9, 0, 0, 0);

  const dateStr = nextMonday.toISOString().split("T")[0];
  const dateField = document.getElementById("visit-date");
  const weekField = document.getElementById("visit-week-date");

  if (!dateField.value) dateField.value = dateStr;
  if (!weekField.value) weekField.value = dateStr;

  updateWeekday();
}
  
function updateWeekday() {
    const date = document.getElementById("visit-date").value;
    if (!date) return;
    document.getElementById("visit-day").innerText = getWeekdayName(date);
    updateDeadlineColors();
}

function getNearestWeekday(dateObj) {
  const day = dateObj.getDay();
  if (day === 6) dateObj.setDate(dateObj.getDate() + 2); 
  else if (day === 0) dateObj.setDate(dateObj.getDate() + 1); 
  return dateObj;
}

// ============================================================================
// 로그인 정보 및 세션
// ============================================================================
function loadLoginInfo() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  if (user && user.userName) {
    document.getElementById("login-user").innerText = `👤 ${user.userName} (${user.dept})`;
    sessionStorage.setItem("id", user.userId);
    sessionStorage.setItem("name", user.userName);
    sessionStorage.setItem("type", user.type);
    sessionStorage.setItem("dept", user.dept);
    sessionStorage.setItem("userId", user.userId);
    sessionStorage.setItem("userName", user.userName);
    sessionStorage.setItem("userType", user.type);
    sessionStorage.setItem("level", user.level);
    
    const logButton = document.getElementById("visit-log-button");
    if (logButton) {
      if (user.level === 3 || user.level === 2) {
        toggleVisibility(logButton, true, 'ui-inline-block');
        logButton.addEventListener("click", () => window.location.href = "visitor_logs.html");
      } else {
        toggleVisibility(logButton, false);
      }
    }
  }
}

function goToMain() {
    localStorage.removeItem("lastVisitDate");
    localStorage.removeItem("lastWeeklyVisitDate");
    sessionStorage.clear();
    window.location.href = "index.html";
}

function clearInput() {
    const bCount = document.getElementById("b-count");
    const lCount = document.getElementById("l-count");
    const dCount = document.getElementById("d-count");
    const reasonInput = document.getElementById("visit-reason");

    if (bCount && !bCount.readOnly) bCount.value = 0;
    if (lCount && !lCount.readOnly) lCount.value = 0;
    if (dCount && !dCount.readOnly) dCount.value = 0;
    if (reasonInput) reasonInput.value = "";
}

// ============================================================================
// 테이블 액션 위임 (수정, 삭제, 저장)
// ============================================================================
function handleTableActions(event) {
  const editBtn = event.target.closest('.action-edit');
  const deleteBtn = event.target.closest('.action-delete');
  const saveEditBtn = event.target.closest('.action-save-edit');

  if (editBtn) {
    editVisit(editBtn.dataset.id);
  } else if (deleteBtn) {
    deleteVisit(deleteBtn.dataset.id);
  } else if (saveEditBtn) {
    saveVisitEdit(saveEditBtn.dataset.id);
  }
}

// ============================================================================
// 데이터 로드 및 렌더링
// ============================================================================
function loadWeeklyVisitData() {
    const dateInput = document.getElementById("visit-week-date");
    if (!dateInput || !dateInput.value) return;
    
    const selectedDate = dateInput.value;
    const { start, end } = getWeekStartAndEnd(selectedDate);
    const params = `start=${start}&end=${end}`;
  
    getData(`${API_BASE_URL}/visitors/weekly?${params}`, (result) => {
        const tbody = document.getElementById("visit-summary-body");
        tbody.innerHTML = "";
  
        if (!result || result.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="10" class="empty-row-text">신청 내역이 없습니다.</td>`;
          tbody.appendChild(tr);
          return;
        }

        (result || []).forEach(row => {
          const userType = sessionStorage.getItem("type") || "방문자";
          const currentDept = sessionStorage.getItem("dept"); 

          if (userType === "협력사" && (row.type !== "협력사" || row.dept !== currentDept)) return;
          if (userType === "직영" && row.type !== "방문자") return;

          const tr = document.createElement("tr");
          const isOwner = row.applicant_id === sessionStorage.getItem("id");

          const bExpired = isDeadlinePassed(row.date, "breakfast", row.breakfast);
          const lExpired = isDeadlinePassed(row.date, "lunch", row.lunch);
          const dExpired = isDeadlinePassed(row.date, "dinner", row.dinner);
          const rowExpired = bExpired && lExpired && dExpired;
          const todayStr = getKSTDate().toISOString().split("T")[0];
          const isTodayOrLater = row.date >= todayStr;
          const isRowClosed = isNextWeekDeadlinePassed(row.date) || rowExpired || !isTodayOrLater;
          
          if (isRowClosed) tr.classList.add("expired-row");

          tr.setAttribute("data-id", row.id);
          
          const editButtonHTML = (isOwner && !rowExpired)
            ? `<button class="action-btn-icon action-edit" data-id="${row.id}" title="수정">✏️</button>`
            : `<span class="closed-text">🔒마감</span>`;

          const deleteButtonHTML = (isOwner && !rowExpired)
            ? `<button class="action-btn-icon action-delete" data-id="${row.id}" title="삭제">🗑</button>`
            : `<span class="closed-text">🔒마감</span>`;

          tr.innerHTML = `
          <td class="date-cell">${row.date}</td>
          <td>${getWeekdayName(row.date)}</td>
          <td class="b-cell ${bExpired ? 'expired-cell' : ''}">${row.breakfast}</td>
          <td class="l-cell ${lExpired ? 'expired-cell' : ''}">${row.lunch}</td>
          <td class="d-cell ${dExpired ? 'expired-cell' : ''}">${row.dinner}</td>
          <td class="r-cell ${isRowClosed ? 'expired-cell' : ''}">${row.reason || "-"}</td>
          <td>${row.dept || "-"}</td>
          <td>${row.applicant_name || "-"}</td>
          <td>${editButtonHTML}</td>
          <td>${deleteButtonHTML}</td>
        `;
          tbody.appendChild(tr);
        });
      },
      (err) => {
        console.error("❌ 주간 신청 내역 불러오기 실패:", err);
        if (typeof showToast === "function") showToast("❌ 방문자 신청 데이터를 불러오는 데 실패했습니다.");
      }
    );
}

// ============================================================================
// 데이터 저장, 수정, 삭제 로직
// ============================================================================
function submitVisit() {
    const date = document.getElementById("visit-date").value;
    const breakfast = +document.getElementById("b-count").value;
    const lunch = +document.getElementById("l-count").value;
    const dinner = +document.getElementById("d-count").value;
    const reasonInput = document.getElementById("visit-reason");
    const userType = sessionStorage.getItem("type") || "방문자";
    let actualType = userType === "직영" ? "방문자" : "협력사";
    
    if (isNextWeekDeadlinePassed(date)) {
      alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 신청할 수 없습니다.");
      return;
    }
  
    const currentDept = sessionStorage.getItem("dept");
    const isException = currentDept === "신명전력";
    const reason = (userType === "협력사" && !isException) ? "협력사 신청" : reasonInput.value.trim();
  
    if (!date || (breakfast + lunch + dinner === 0) || (userType !== "협력사" && reason === "")) {
      if (typeof showToast === "function") showToast("❗ 날짜, 식사 수량, 사유를 모두 입력해주세요.");
      alert("❗ 날짜, 식사 수량, 사유를 모두 입력해주세요.");
      return;
    }

    localStorage.setItem("lastVisitDate", date);
    localStorage.setItem("flag", 2);
    lastSubmittedDate = date;

    const checkUrl = `${API_BASE_URL}/visitors/check?date=${date}&id=${sessionStorage.getItem("id")}&type=${actualType}`;
    const mealData = { breakfast, lunch, dinner };
    const expiredList = getExpiredMeals(date, mealData);

    if (expiredList.length === 3) {
      alert("⛔ 모든 식사는 마감되어 신청할 수 없습니다.");
      return;
    }

    getData(`/holidays?year=${date.substring(0, 4)}`, (holidays) => {
      if (holidays.some(h => h.date === date)) {
        alert(`❌ ${date}는 공휴일입니다. 신청할 수 없습니다.`);
        return;
      }
    
      getData(checkUrl, (res) => {
        if (res.exists) {
          if (!confirm("📌 해당 날짜에 이미 신청한 내역이 있습니다. 덮어쓰시겠습니까?")) return;
        }

        const visitData = {
          applicant_id: sessionStorage.getItem("id"),
          applicant_name: sessionStorage.getItem("name"),
          date,
          reason,
          type: actualType,
          requested_by_admin: false
        };
        
        if (!expiredList.includes("breakfast")) visitData.breakfast = breakfast;
        if (!expiredList.includes("lunch"))     visitData.lunch     = lunch;
        if (!expiredList.includes("dinner"))    visitData.dinner    = dinner;

        saveVisit(visitData); 
      });
    });
}

function saveVisit(data) {
    postData("/visitors", data, () => {
      if (typeof showToast === "function") showToast("✅ 저장되었습니다.");
      alert("✅ 저장되었습니다.");
      clearInput();
      
      if (lastSubmittedDate) {
        document.getElementById("visit-date").value = lastSubmittedDate;
        document.getElementById("visit-week-date").value = lastSubmittedDate;
      }

      updateWeekday();  
      loadWeeklyVisitData(); 
    });
}

function deleteVisit(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    const date = tr.querySelector(".date-cell").innerText;
    const b = +tr.querySelector(".b-cell").innerText;
    const l = +tr.querySelector(".l-cell").innerText;
    const d = +tr.querySelector(".d-cell").innerText;

    const expiredList = getExpiredMeals(date, { breakfast: b, lunch: l, dinner: d });

    if (isNextWeekDeadlinePassed(date)) {
      alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 수정할 수 없습니다.");
      loadWeeklyVisitData(); 
      return;
    }

    if (expiredList.length > 0) {
      alert(`⛔ 조/중/석 중 ${expiredList.join(", ")}은(는) 마감되어 삭제할 수 없습니다.`);
      return;
    }
  
    if (!confirm("정말 삭제하시겠습니까?")) return;
  
    deleteData(`${API_BASE_URL}/visitors/${id}`, () => {
      if (typeof showToast === "function") showToast("✅ 삭제 완료");
      alert("✅ 삭제 완료");
      loadWeeklyVisitData();
    });

    localStorage.setItem("lastVisitDate", date);
    localStorage.setItem("lastWeeklyVisitDate", date);
}

function editVisit(id) {
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;

  const date = tr.querySelector("td.date-cell").innerText;
  const b = tr.querySelector(".b-cell").innerText;
  const l = tr.querySelector(".l-cell").innerText;
  const d = tr.querySelector(".d-cell").innerText;
  const r = tr.querySelector(".r-cell")?.innerText || "";

  const isBExpired = isDeadlinePassed(date, "breakfast", Number(b));
  const isLExpired = isDeadlinePassed(date, "lunch", Number(l));
  const isDExpired = isDeadlinePassed(date, "dinner", Number(d));

  tr.querySelector(".b-cell").innerHTML = isBExpired
    ? `${b}<input type="hidden" value="${b}" data-prev="${b}">`
    : `<input type="number" min="0" max="50" value="${b}" data-prev="${b}">`;

  tr.querySelector(".l-cell").innerHTML = isLExpired
    ? `${l}<input type="hidden" value="${l}" data-prev="${l}">`
    : `<input type="number" min="0" max="50" value="${l}" data-prev="${l}">`;

  tr.querySelector(".d-cell").innerHTML = isDExpired
    ? `${d}<input type="hidden" value="${d}" data-prev="${d}">`
    : `<input type="number" min="0" max="50" value="${d}" data-prev="${d}">`;

  if (tr.querySelector(".r-cell")) {
    tr.querySelector(".r-cell").innerHTML = `<input type="text" value="${r}" data-prev="${r}">`;
  }

  const editBtn = tr.querySelector("button.action-edit");
  if(editBtn) {
    editBtn.innerText = "💾";
    editBtn.title = "수정 완료";
    editBtn.classList.remove("action-edit");
    editBtn.classList.add("action-save-edit");
  }
}

function saveVisitEdit(id) {
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;

  const date = tr.querySelector(".date-cell").innerText;

  if (isNextWeekDeadlinePassed(date)) {
    alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 수정할 수 없습니다.");
    loadWeeklyVisitData();
    return;
  }

  const bInput = tr.querySelector(".b-cell input");
  const lInput = tr.querySelector(".l-cell input");
  const dInput = tr.querySelector(".d-cell input");
  const reasonInput = tr.querySelector(".r-cell input");

  const bPrev = Number(bInput?.dataset.prev ?? 0);
  const lPrev = Number(lInput?.dataset.prev ?? 0);
  const dPrev = Number(dInput?.dataset.prev ?? 0);

  const isBExpired = isDeadlinePassed(date, "breakfast", bPrev);
  const isLExpired = isDeadlinePassed(date, "lunch", lPrev);
  const isDExpired = isDeadlinePassed(date, "dinner", dPrev);

  const bNew = Number(bInput?.value ?? 0);
  const lNew = Number(lInput?.value ?? 0);
  const dNew = Number(dInput?.value ?? 0);

  const breakfast = isBExpired ? bPrev : bNew;
  const lunch = isLExpired ? lPrev : lNew;
  const dinner = isDExpired ? dPrev : dNew;

  const reason = (reasonInput?.value || "").trim() || "협력사 신청";
  if (!reason) {
    alert("❗ 사유를 입력해주세요.");
    return;
  }

  const hasMealChange = breakfast !== bPrev || lunch !== lPrev || dinner !== dPrev;
  const hasReasonChange = reason !== (reasonInput?.dataset.prev || "").trim();

  if (!hasMealChange && !hasReasonChange) {
    alert("변경된 내용이 없습니다.");
    loadWeeklyVisitData();
    return;
  }

  const data = { reason };
  if (!isBExpired) data.breakfast = breakfast;
  if (!isLExpired) data.lunch = lunch;
  if (!isDExpired) data.dinner = dinner;

  putData(`${API_BASE_URL}/visitors/${id}`, data, () => {
    if (typeof showToast === "function") showToast("✅ 수정 완료");
    loadWeeklyVisitData();
  });

  localStorage.setItem("lastWeeklyVisitDate", date);
  localStorage.setItem("flag", 3);
}

// ============================================================================
// 마감 처리(Deadline) 및 검증 로직
// ============================================================================
function isNextWeekDeadlinePassed(selectedDate) {
  const now = getKSTDate();
  const mealDate = new Date(selectedDate);

  const nowDay = now.getDay() === 0 ? 7 : now.getDay(); 
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - nowDay + 1);
  thisWeekMonday.setHours(0,0,0,0);

  const wednesday16 = new Date(thisWeekMonday);
  wednesday16.setDate(thisWeekMonday.getDate() + 2);
  wednesday16.setHours(16,0,0,0);

  const sundayEnd = new Date(thisWeekMonday);
  sundayEnd.setDate(thisWeekMonday.getDate() + 6);
  sundayEnd.setHours(23,59,59,999);

  const nextWeekMonday = new Date(thisWeekMonday);
  nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);

  const nextWeekSunday = new Date(nextWeekMonday);
  nextWeekSunday.setDate(nextWeekMonday.getDate() + 6);

  if (mealDate >= nextWeekMonday && mealDate <= nextWeekSunday) {
    if (now >= wednesday16 && now <= sundayEnd) {
      return true;
    }
  }
  return false;
}

function getExpiredMeals(date, mealData) {
  const now = getKSTDate();
  const mealDate = new Date(date);
  mealDate.setHours(0, 0, 0, 0);  
  const expired = [];

  const bLimit = new Date(mealDate);
  bLimit.setDate(mealDate.getDate() - 1);
  bLimit.setHours(9, 0, 0, 0);
  if (mealData.breakfast > 0 && now > bLimit) expired.push("breakfast");

  const lLimit = new Date(mealDate);
  lLimit.setHours(10, 30, 0, 0);
  if (mealData.lunch > 0 && now > lLimit) expired.push("lunch");

  const dLimit = new Date(mealDate);
  dLimit.setHours(14, 30, 0, 0);
  if (mealData.dinner > 0 && now > dLimit) expired.push("dinner");

  return expired;  
}

function isDeadlinePassed(date, mealType, quantity) {
  const now = getKSTDate();
  const mealDate = new Date(date);
  mealDate.setHours(0, 0, 0, 0); 

  if (mealType === "breakfast") {
    mealDate.setDate(mealDate.getDate() - 1);
    mealDate.setHours(9, 0, 0, 0);
  } else if (mealType === "lunch") {
    mealDate.setHours(10, 30, 0, 0);
  } else if (mealType === "dinner") {
    mealDate.setHours(14, 30, 0, 0);
  }

  return now > mealDate;
}

function updateDeadlineColors() {
  const date = document.getElementById("visit-date").value;
  if (!date) return;

  const inputs = [
    document.getElementById("b-count"),
    document.getElementById("l-count"),
    document.getElementById("d-count")
  ];

  const now = getKSTDate();
  const mealDate = new Date(date);

  inputs.forEach(input => {
    if(!input) return;
    input.classList.remove("expired-input");
    input.readOnly = false;
    input.title = "";
  });

  const bLimit = new Date(mealDate);
  bLimit.setDate(mealDate.getDate() - 1);
  bLimit.setHours(9,0,0,0);
  if (now > bLimit && inputs[0]) {
    inputs[0].classList.add("expired-input");
    inputs[0].readOnly = true;
    inputs[0].title = "⛔ 조식은 신청 마감되었습니다.";
  }

  const lLimit = new Date(mealDate);
  lLimit.setHours(10,30,0,0);
  if (now > lLimit && inputs[1]) {
    inputs[1].classList.add("expired-input");
    inputs[1].readOnly = true;
    inputs[1].title = "⛔ 중식은 신청 마감되었습니다.";
  }

  const dLimit = new Date(mealDate);
  dLimit.setHours(14,30,0,0);
  if (now > dLimit && inputs[2]) {
    inputs[2].classList.add("expired-input");
    inputs[2].readOnly = true;
    inputs[2].title = "⛔ 석식은 신청 마감되었습니다.";
  }

  if (isNextWeekDeadlinePassed(date)) {
    inputs.forEach(input => {
      if(!input) return;
      input.classList.add("expired-input");
      input.readOnly = true;
      input.title = "⛔ 다음 주 식사는 이번 주 수요일 이후에는 신청할 수 없습니다.";
    });
  }
}

// ============================================================================
// 일괄 주간 신청(Bulk Visit) 모듈
// ============================================================================
(function () {
  const BULK_IDS = {
    toggle: "bulk-input-toggle-btn",
    wrapper: "bulk-visit-wrapper",
    body: "bulk-visit-body",
    save: "bulk-visit-save-btn",
    weekDate: "visit-week-date",
    singleDate: "visit-date"
  };

  function getUserType() {
    return sessionStorage.getItem("type") || "방문자";
  }

  function isReasonRequired() {
    const userType = getUserType();
    const currentDept = sessionStorage.getItem("dept");
    const isException = currentDept === "신명전력";
    return !(userType === "협력사" && !isException);
  }

  function getActualType() {
    return getUserType() === "협력사" ? "협력사" : "방문자";
  }

  function normalizeReason(reason) {
    const currentDept = sessionStorage.getItem("dept");
    const isException = currentDept === "신명전력";
    if (getUserType() === "협력사" && !isException) {
      return "협력사 신청";
    }
    return (reason || "").trim();
  }

  function getWeekDatesFromMonday(baseDateStr) {
    const base = new Date(baseDateStr);
    const day = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((day + 6) % 7));
    monday.setHours(9, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 5; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }

  function toggleBulkVisit() {
    const wrapper = document.getElementById(BULK_IDS.wrapper);
    if (!wrapper) return;
    
    const isHidden = wrapper.classList.contains("ui-hidden");
    if (isHidden) {
      wrapper.classList.remove("ui-hidden");
      if(typeof renderBulkVisitRows === "function") renderBulkVisitRows();
    } else {
      wrapper.classList.add("ui-hidden");
    }
  }

  function renderBulkVisitRows() {
    const bulkBody = document.getElementById(BULK_IDS.body);
    if (!bulkBody) return;

    const baseDateStr = document.getElementById(BULK_IDS.singleDate).value;
    if (!baseDateStr) return;

    const dates = getWeekDatesFromMonday(baseDateStr); 
    bulkBody.innerHTML = "";

    dates.forEach((date, index) => {
      const row = document.createElement("tr");
      row.dataset.date = date; 
      
      const isClosed = isDeadlinePassed(date, "lunch", 1); 

      let html = `
        <td class="col-adate">${date}</td>
        <td class="col-aday">${getWeekdayName(date)}</td>
        <td class="col-abreakfast"><input type="number" class="bulk-b-count" data-date="${date}" value="0" min="0" ${isClosed ? 'disabled' : ''}></td>
        <td class="col-alunch"><input type="number" class="bulk-l-count" data-date="${date}" value="0" min="0" ${isClosed ? 'disabled' : ''}></td>
        <td class="col-adinner"><input type="number" class="bulk-d-count" data-date="${date}" value="0" min="0" ${isClosed ? 'disabled' : ''}></td>
        <td class="col-areason"><input type="text" class="bulk-reason-input" data-date="${date}" placeholder="사유" ${isClosed ? 'disabled' : ''}></td>
      `;

      if (index === 0) {
        html += `
          <td class="col-asave bulk-save-cell" rowspan="${dates.length}">
            <button type="button" id="${BULK_IDS.save}" class="action-btn save-btn visitor-save-btn bulk-save-btn-large">
              💾<br>일괄<br>저장
            </button>
          </td>
        `;
      }

      row.innerHTML = html;
      bulkBody.appendChild(row);
    });

    applyBulkDeadlineState();
  }

  function applyStateToInput(input, locked, title) {
    if (!input) return;
    input.readOnly = !!locked;
    input.classList.toggle("expired-input", !!locked);
    input.title = locked ? title : "";
    if (!locked && input.value === "") input.value = 0;
  }

  function applyBulkDeadlineState() {
    const rows = document.querySelectorAll(`#${BULK_IDS.body} tr`);
    rows.forEach((row) => {
      const date = row.dataset.date;
      const bInput = row.querySelector(".bulk-b-count");
      const lInput = row.querySelector(".bulk-l-count");
      const dInput = row.querySelector(".bulk-d-count");

      applyStateToInput(bInput, false, "");
      applyStateToInput(lInput, false, "");
      applyStateToInput(dInput, false, "");

      if (isDeadlinePassed(date, "breakfast", Number(bInput?.value) || 0)) applyStateToInput(bInput, true, "⛔ 조식 마감");
      if (isDeadlinePassed(date, "lunch", Number(lInput?.value) || 0)) applyStateToInput(lInput, true, "⛔ 중식 마감");
      if (isDeadlinePassed(date, "dinner", Number(dInput?.value) || 0)) applyStateToInput(dInput, true, "⛔ 석식 마감");
      if (isNextWeekDeadlinePassed(date)) {
        applyStateToInput(bInput, true, "⛔ 다음 주 마감");
        applyStateToInput(lInput, true, "⛔ 다음 주 마감");
        applyStateToInput(dInput, true, "⛔ 다음 주 마감");
      }
    });
  }

  function collectBulkRows() {
    const rows = Array.from(document.querySelectorAll(`#${BULK_IDS.body} tr`));
    return rows.map((row) => ({
      date: row.dataset.date,
      breakfast: Number(row.querySelector(".bulk-b-count")?.value || 0),
      lunch: Number(row.querySelector(".bulk-l-count")?.value || 0),
      dinner: Number(row.querySelector(".bulk-d-count")?.value || 0),
      reason: row.querySelector(".bulk-reason-input")?.value || ""
    })).filter((row) => row.breakfast + row.lunch + row.dinner > 0);
  }

  function clearBulkRows() {
    document.querySelectorAll(`#${BULK_IDS.body} tr`).forEach((row) => {
      [".bulk-b-count", ".bulk-l-count", ".bulk-d-count"].forEach((sel) => {
        const input = row.querySelector(sel);
        if (input && !input.readOnly) input.value = 0;
      });
      const reasonInput = row.querySelector(".bulk-reason-input");
      if (reasonInput && !reasonInput.readOnly) reasonInput.value = "";
    });
  }

  function buildVisitPayload(rawData) {
    return {
      applicant_id: sessionStorage.getItem("id"),
      applicant_name: sessionStorage.getItem("name"),
      date: rawData.date,
      reason: normalizeReason(rawData.reason),
      type: getActualType(),
      requested_by_admin: false
    };
  }

  function validateVisitInput(rawData) {
    const date = rawData.date;
    const breakfast = Number(rawData.breakfast) || 0;
    const lunch = Number(rawData.lunch) || 0;
    const dinner = Number(rawData.dinner) || 0;
    const reason = normalizeReason(rawData.reason);

    if (!date) return { ok: false, message: "날짜가 없습니다." };
    if (breakfast + lunch + dinner === 0) return { ok: false, message: `${date}: 식사 수량이 없습니다.` };
    if (isReasonRequired() && !reason) return { ok: false, message: `${date}: 사유를 입력해주세요.` };
    if (isNextWeekDeadlinePassed(date)) return { ok: false, message: `${date}: 다음 주 식사는 이번 주 수요일 이후 신청불가.` };

    const expiredList = getExpiredMeals(date, { breakfast, lunch, dinner });
    if (expiredList.length === 3) return { ok: false, message: `${date}: 모든 식사가 마감되었습니다.` };

    return { ok: true, payload: buildVisitPayload({ date, reason }), meals: { breakfast, lunch, dinner }, expiredList };
  }

  function saveVisitByData(rawData, callbacks = {}) {
    const validation = validateVisitInput(rawData);
    if (!validation.ok) {
      if (callbacks.onError) callbacks.onError(validation.message);
      return;
    }

    const { payload, meals, expiredList } = validation;
    const date = rawData.date;
    const checkUrl = `${API_BASE_URL}/visitors/check?date=${date}&id=${sessionStorage.getItem("id")}&type=${payload.type}`;

    getData(`/holidays?year=${date.substring(0, 4)}`, (holidays) => {
      if ((holidays || []).some(h => h.date === date)) {
        if (callbacks.onError) callbacks.onError(`${date}: 공휴일이라 신청할 수 없습니다.`);
        return;
      }

      getData(checkUrl, (res) => {
        if (res && res.exists && callbacks.confirmOverwrite) {
          if (!callbacks.confirmOverwrite(date, res)) {
            if (callbacks.onSkip) callbacks.onSkip(`${date}: 기존 신청 유지`);
            return;
          }
        }

        const visitData = { ...payload };
        if (!expiredList.includes("breakfast")) visitData.breakfast = meals.breakfast;
        if (!expiredList.includes("lunch")) visitData.lunch = meals.lunch;
        if (!expiredList.includes("dinner")) visitData.dinner = meals.dinner;

        postData("/visitors", visitData, () => {
            localStorage.setItem("lastVisitDate", date);
            localStorage.setItem("lastWeeklyVisitDate", date);
            localStorage.setItem("flag", "2");
            lastSubmittedDate = date;
            if (callbacks.onSuccess) callbacks.onSuccess(date);
        }, (err) => {
            if (callbacks.onError) callbacks.onError(`${date}: 저장 실패`);
        });
      });
    });
  }

  function submitBulkVisit() {
    const targets = collectBulkRows();
    if (targets.length === 0) {
      alert("일괄 저장할 식사 수량이 없습니다.");
      return;
    }

    const successList = [], failList = [], skippedList = [];

    const run = (index) => {
      if (index >= targets.length) {
        loadWeeklyVisitData();
        clearBulkRows();
        renderBulkVisitRows();

        const parts = [`성공: ${successList.length}건`, `실패: ${failList.length}건`];
        if (skippedList.length) parts.push(`건너뜀: ${skippedList.length}건`);

        let msg = `일괄 저장 완료\n\n${parts.join("\n")}`;
        if (failList.length) msg += `\n\n실패 내역\n- ${failList.join("\n- ")}`;
        alert(msg);
        return;
      }

      saveVisitByData(targets[index], {
        confirmOverwrite: (date) => confirm(`📌 ${date}에 이미 신청 내역이 있습니다. 덮어쓰시겠습니까?`),
        onSuccess: (date) => { successList.push(date); run(index + 1); },
        onError: (message) => { failList.push(message); run(index + 1); },
        onSkip: (message) => { skippedList.push(message); run(index + 1); }
      });
    };
    run(0);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById(BULK_IDS.toggle);
    if (toggleBtn) toggleBtn.addEventListener("click", toggleBulkVisit);

    // 일괄 저장 버튼 이벤트 위임 (동적 생성되므로 document에 위임)
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(`#${BULK_IDS.save}`);
      if (btn) submitBulkVisit();
    });

    const bulkBody = document.getElementById(BULK_IDS.body);
    if (bulkBody) {
      bulkBody.addEventListener("input", (event) => {
        if (event.target.classList.contains("bulk-b-count") || 
            event.target.classList.contains("bulk-l-count") || 
            event.target.classList.contains("bulk-d-count")) {
          applyBulkDeadlineState();
        }
      });
    }
  });

  window.renderBulkVisitRows = renderBulkVisitRows;
})();