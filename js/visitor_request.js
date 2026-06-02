/**
 * 에스엔시스 방문자/협력사 식수 신청 시스템 Script (버그 완전 패치 및 서버 시간 보정 통합 버전)
 */

let lastSubmittedDate = null;
window.serverDeadlines = null; // 백엔드 동적 마감시간 캐싱 객체

document.addEventListener("DOMContentLoaded", () => {
    setupSidebarAndTabs();

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
    
    const visitSummaryBody = document.getElementById("visit-summary-body");
    if (visitSummaryBody) visitSummaryBody.addEventListener("click", handleTableActions);

    // 일괄 편집 및 일괄 저장 버튼 돔 이벤트 바인딩 복구
    document.getElementById("history-bulk-edit-btn")?.addEventListener("click", toggleHistoryBulkEdit);
    document.getElementById("history-bulk-save-btn")?.addEventListener("click", submitHistoryBulkUpdate);

    // 💡 [개선]: PC 로컬 시간이 아닌 서버 측 보정 시간을 원천 베이스로 타임스탬프 로드
    if (typeof syncServerTime === "function") {
        syncServerTime(() => {
            initializeApplicationPipeline();
        });
    } else {
        initializeApplicationPipeline();
    }
});

/**
 * 💡 서버 시간 동기화 완료 후 비즈니스 로직 순차 시동 체이닝
 */
function initializeApplicationPipeline() {
    const storedDate = sessionStorage.getItem("lastVisitDate");
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    
    if (storedDate) {
      const todayStr = ymdKST(now);
      if (storedDate !== todayStr) {
        const dateInputEl = document.getElementById("visit-date");
        const weekInputEl = document.getElementById("visit-week-date");
        if (dateInputEl) dateInputEl.value = storedDate;
        if (weekInputEl) weekInputEl.value = storedDate;
      } else {
        setTodayDefault();
      }
    } else {
      setTodayDefault();
    }

    loadLoginInfo();
    
    // 화면 렌더링 구동 전 백엔드 마감 제어 규칙 매니페스트 선행 다운로드
    loadDeadlinesForVisitor(() => {
        updateWeekday();
        loadWeeklyVisitData();
        if (typeof initMenuBoard === "function") initMenuBoard();
        applyUserTypeUI();
    });
}

// ============================================================================
// 💡 [버그 패치]: 유실되었던 KST 날짜 변환 문자열 생성 핵심 유틸리티 복원
// ============================================================================
function ymdKST(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOf(d) {
    const c = new Date(d);
    const idx = (c.getDay() + 6) % 7;
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - idx);
    return c;
}

// ============================================================================
// 1. 서버 동적 마감 데이터 Fetch 및 공통 검증 연동
// ============================================================================
function loadDeadlinesForVisitor(callback) {
    getData("/admin/api/deadlines", (data) => {
        window.serverDeadlines = data;
        if (callback) callback();
    }, () => {
        console.error("⚠️ 마감 설정 연동 실패. 비상용 하드코딩 기본값으로 대체합니다.");
        window.serverDeadlines = { 
            breakfast_days_before: "1", breakfast_time: "09:00", 
            lunch_days_before: "0", lunch_time: "10:30", 
            dinner_days_before: "0", dinner_time: "14:30",
            next_week_day_of_week: "3", next_week_time: "16:00"
        };
        if (callback) callback();
    });
}

function isDeadlinePassed(date, mealType) {
    if (!window.serverDeadlines) return true; 
    
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mealDate = new Date(date);
    mealDate.setHours(0, 0, 0, 0);

    let prefix = (mealType === "lunch" || mealType === "중식") ? "lunch" : 
                 (mealType === "dinner" || mealType === "석식") ? "dinner" : "breakfast";

    const daysBefore = parseInt(window.serverDeadlines[`${prefix}_days_before`] || 0, 10);
    const timeStr = window.serverDeadlines[`${prefix}_time`] || "00:00";
    const [hour, minute] = timeStr.split(":").map(Number);

    const deadline = new Date(mealDate);
    deadline.setDate(deadline.getDate() - daysBefore);
    deadline.setHours(hour, minute, 0, 0);

    return now > deadline;
}

function isNextWeekDeadlinePassed(selectedDate) {
    if (!window.serverDeadlines) return true;
    
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mealDate = new Date(selectedDate);

    const nowDay = now.getDay() === 0 ? 7 : now.getDay(); 
    const thisWeekMonday = new Date(now);
    thisWeekMonday.setDate(now.getDate() - nowDay + 1);
    thisWeekMonday.setHours(0, 0, 0, 0);

    const targetDayIndex = parseInt(window.serverDeadlines["next_week_day_of_week"] || 3, 10);
    const targetTimeStr = window.serverDeadlines["next_week_time"] || "16:00";
    const [h, m] = targetTimeStr.split(":").map(Number);

    const nextWeekDeadline = new Date(thisWeekMonday);
    nextWeekDeadline.setDate(thisWeekMonday.getDate() + (targetDayIndex - 1));
    nextWeekDeadline.setHours(h, m, 0, 0);

    const sundayEnd = new Date(thisWeekMonday);
    sundayEnd.setDate(thisWeekMonday.getDate() + 6);
    sundayEnd.setHours(23, 59, 59, 999);

    const nextWeekMonday = new Date(thisWeekMonday);
    nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);

    const nextWeekSunday = new Date(nextWeekMonday);
    nextWeekSunday.setDate(nextWeekMonday.getDate() + 6);

    if (mealDate >= nextWeekMonday && mealDate <= nextWeekSunday) {
        if (now >= nextWeekDeadline && now <= sundayEnd) {
            return true;
        }
    }
    return false;
}

function getExpiredMeals(date, mealData) {
    const expired = [];
    if (mealData.breakfast > 0 && isDeadlinePassed(date, "breakfast")) expired.push("breakfast");
    if (mealData.lunch > 0 && isDeadlinePassed(date, "lunch")) expired.push("lunch");
    if (mealData.dinner > 0 && isDeadlinePassed(date, "dinner")) expired.push("dinner");
    return expired;  
}

// ============================================================================
// 2. UI 레이아웃 클래스 스위칭 유틸
// ============================================================================
function toggleVisibility(element, show, displayClass = '') {
  if (!element) return;
  element.classList.remove('ui-hidden', 'ui-block', 'ui-inline-block', 'ui-flex');
  if (show) {
    if (displayClass) element.classList.add(displayClass);
  } else {
    element.classList.add('ui-hidden');
  }
}

function applyUserTypeUI() {
  const userType = sessionStorage.getItem("type"); 
  const pageTitle = document.getElementById("page-title"); 
  const pageButton = document.getElementById("page-button"); 
  
  const applyNavLink = document.querySelector('.erp-nav-link[data-page="visitorApplySection"]');
  const sidebarSubtitle = document.querySelector('.erp-sidebar-subtitle'); 
  const sidebarTitle = document.querySelector('.erp-sidebar-title'); 

  const reasonTh = document.getElementById("reason-th");
  const reasonInput = document.getElementById("visit-reason");
  const reasonTd = reasonInput ? reasonInput.closest("td") : null;
  const weeklyReasonTh = document.getElementById("weekly-reason-th");

  if (userType === "협력사") {
    if (pageTitle) pageTitle.innerText = "식수 신청 시스템";
    if (pageButton) pageButton.innerText = "🔙 로그아웃";
    if (applyNavLink) applyNavLink.innerText = "협력사 신청";
    if (sidebarSubtitle) sidebarSubtitle.innerText = "협력사 신청 메뉴";
    if (sidebarTitle) sidebarTitle.innerText = "PARTNER MENU"; 

    toggleVisibility(reasonTh, false);
    toggleVisibility(reasonTd, false);
    toggleVisibility(weeklyReasonTh, true);

  } else if (userType === "직영") {
    if (pageTitle) pageTitle.innerText = "방문자 식수 신청";
    if (pageButton) pageButton.innerText = "🔙 뒤로가기";
    if (applyNavLink) applyNavLink.innerText = "방문자 신청";
    if (sidebarSubtitle) sidebarSubtitle.innerText = "방문자 신청 메뉴";
    if (sidebarTitle) sidebarTitle.innerText = "VISITOR MENU"; 

    toggleVisibility(reasonTh, true);
    toggleVisibility(reasonTd, true);
    toggleVisibility(weeklyReasonTh, true);
  }
}

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

      pages.forEach(page => page.className = "card pad erp-page visitor-page-card");
      const target = document.getElementById(targetId);
      if (target) target.classList.add("active");

      if (targetId === "visitorLogSection") {
        const startInput = document.getElementById("logStartDate");
        const endInput = document.getElementById("logEndDate");
        if (startInput && !startInput.value) {
            const { start, end } = getCurrentWeekRange();
            startInput.value = start;
            if (endInput) endInput.value = end;
        }
        loadDeptVisitorLogs(); 
      }

      if (mobileQuery.matches) closeMobileSidebar();
    });
  });

  sideActions.forEach(btn => {
    btn.addEventListener("click", () => { if (mobileQuery.matches) closeMobileSidebar(); });
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
// 3. 날짜 처리 조율 및 리스너 분기
// ============================================================================
function handleDateChange() {
  const input = document.getElementById("visit-date");
  if (!input || !input.value) return;
  const picked = new Date(input.value);
   
  if (picked.getDay() === 0 || picked.getDay() === 6) {
    alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
    const adjusted = getNearestWeekday(picked);
    input.value = ymdKST(adjusted);
  }

  const selectedDate = input.value;
  const weekField = document.getElementById("visit-week-date");
  if (weekField) weekField.value = selectedDate;

  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  const actualType = sessionStorage.getItem("type") === "직영" ? "방문자" : "협력사";
  const checkUrl = `${API_BASE_URL}/visitors/check?date=${selectedDate}&id=${user.userId}&type=${actualType}`;

  getData(checkUrl, (res) => {
    const bCount = document.getElementById("b-count");
    const lCount = document.getElementById("l-count");
    const dCount = document.getElementById("d-count");
    const reasonInput = document.getElementById("visit-reason");

    if (res && res.exists && res.record) {
      if (bCount) bCount.value = res.record.breakfast || 0;
      if (lCount) lCount.value = res.record.lunch || 0;
      if (dCount) dCount.value = res.record.dinner || 0;
      if (reasonInput) reasonInput.value = res.record.reason || "";
    } else {
      if (bCount) bCount.value = 0;
      if (lCount) lCount.value = 0;
      if (dCount) dCount.value = 0;
      if (reasonInput) reasonInput.value = "";
    }
    updateDeadlineColors(); 
  });

  const bulkWrapper = document.getElementById("bulk-visit-wrapper");
  if (bulkWrapper && !bulkWrapper.classList.contains("ui-hidden")) {
    if (typeof renderBulkVisitRows === "function") renderBulkVisitRows(); 
  }

  updateWeekday();
  loadWeeklyVisitData(); 
}

function getThisWeekMonday() {
  const today = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
  return ymdKST(mondayOf(today));
}

function loadThisWeek() {
  const thisMonday = getThisWeekMonday();
  const weekField = document.getElementById("visit-week-date");
  const dateField = document.getElementById("visit-date");
  if (weekField) weekField.value = thisMonday;
  if (dateField) dateField.value = thisMonday;
  handleDateChange();
}

function setTodayDefault() {
  const today = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
  const currentDay = today.getDay();
  const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(9, 0, 0, 0);

  const dateStr = ymdKST(nextMonday);
  const dateField = document.getElementById("visit-date");
  const weekField = document.getElementById("visit-week-date");

  if (dateField && !dateField.value) dateField.value = dateStr;
  if (weekField && !weekField.value) weekField.value = dateStr;

  updateWeekday();
}
  
function updateWeekday() {
    const dateField = document.getElementById("visit-date");
    if (!dateField || !dateField.value) return;
    const date = dateField.value;
    const dayField = document.getElementById("visit-day");
    if (dayField) dayField.innerText = getWeekdayName(date);
    updateDeadlineColors();
}

function getNearestWeekday(dateObj) {
  const day = dateObj.getDay();
  if (day === 6) dateObj.setDate(dateObj.getDate() + 2); 
  else if (day === 0) dateObj.setDate(dateObj.getDate() + 1); 
  return dateObj;
}

function loadLoginInfo() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  if (user && user.userName) {
    const loginUserField = document.getElementById("login-user");
    if (loginUserField) loginUserField.innerText = `${user.userName} (${user.dept})`;
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

function handleTableActions(event) {
  const editBtn = event.target.closest('.action-edit');
  const deleteBtn = event.target.closest('.action-delete');
  const saveEditBtn = event.target.closest('.action-save-edit');

  if (editBtn) editVisit(editBtn.dataset.id);
  else if (deleteBtn) deleteVisit(deleteBtn.dataset.id);
  else if (saveEditBtn) saveVisitEdit(saveEditBtn.dataset.id);
}

// ============================================================================
// 4. 주간 내역 동적 Fetch 및 버튼 가시성 분기
// ============================================================================
function loadWeeklyVisitData() {
    const dateInput = document.getElementById("visit-week-date");
    if (!dateInput || !dateInput.value) return;
    
    const selectedDate = dateInput.value;
    const { start, end } = getWeekStartAndEnd(selectedDate);
    const params = `start=${start}&end=${end}`;
  
    getData(`${API_BASE_URL}/visitors/weekly?${params}`, (result) => {
        const tbody = document.getElementById("visit-summary-body");
        if (!tbody) return;
        tbody.innerHTML = "";
  
        if (!result || result.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="10" class="empty-row-text">신청 내역이 없습니다.</td>`;
          tbody.appendChild(tr);
          return;
        }

        const todayStr = ymdKST((typeof getKSTNow === "function") ? getKSTNow() : new Date());

        result.forEach(row => {
          const userType = sessionStorage.getItem("type") || "방문자";
          const currentDept = sessionStorage.getItem("dept"); 

          if (userType === "협력사" && (row.type !== "협력사" || row.dept !== currentDept)) return;
          if (userType === "직영" && row.type !== "방문자") return;

          const tr = document.createElement("tr");
          const isOwner = row.applicant_id === sessionStorage.getItem("id");

          const bExpired = isDeadlinePassed(row.date, "breakfast");
          const lExpired = isDeadlinePassed(row.date, "lunch");
          const dExpired = isDeadlinePassed(row.date, "dinner");
          const rowExpired = bExpired && lExpired && dExpired;
          
          const isTodayOrLater = row.date >= todayStr;
          const isRowClosed = isNextWeekDeadlinePassed(row.date) || rowExpired || !isTodayOrLater;
          
          if (isRowClosed) tr.classList.add("expired-row");
          tr.setAttribute("data-id", row.id);
          
          const editButtonHTML = (isOwner && !isRowClosed)
            ? `<button class="action-btn-icon action-edit" data-id="${row.id}" title="수정">✏️</button>`
            : `<span class="closed-text">🔒마감</span>`;

          const deleteButtonHTML = (isOwner && !isRowClosed)
            ? `<button class="action-btn-icon action-delete" data-id="${row.id}" title="삭제">🗑</button>`
            : `<span class="closed-text">🔒마감</span>`;

          tr.innerHTML = `
          <td class="date-cell">${row.date}</td>
          <td>${getWeekdayName(row.date)}</td>
          <td class="b-cell ${bExpired ? 'expired-cell' : ''}">${row.breakfast}</td>
          <td class="l-cell ${lExpired ? 'expired-cell' : ''}">${row.lunch}</td>
          <td class="d-cell ${dExpired ? 'expired-cell' : ''}">${row.dinner}</td>
          <td class="r-cell">${row.reason || "-"}</td>
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
// 5. 저장 및 데이터 처리 파이프라인 (POST / PUT)
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
      alert("❗ 날짜, 식사 수량, 사유를 모두 입력해주세요.");
      return;
    }

    localStorage.setItem("lastVisitDate", date);
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
      alert("✅ 저장되었습니다.");
      clearInput();
      if (lastSubmittedDate) {
        const dateField = document.getElementById("visit-date");
        const weekField = document.getElementById("visit-week-date");
        if (dateField) dateField.value = lastSubmittedDate;
        if (weekField) weekField.value = lastSubmittedDate;
      }
      updateWeekday();  
      loadWeeklyVisitData(); 
    });
}

function deleteVisit(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    const date = tr.querySelector(".date-cell").innerText;
    if (isNextWeekDeadlinePassed(date)) {
      alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 수정할 수 없습니다.");
      loadWeeklyVisitData(); 
      return;
    }

    if (isDeadlinePassed(date, "breakfast") || isDeadlinePassed(date, "lunch") || isDeadlinePassed(date, "dinner")) {
      alert(`⛔ 신청 마감 시간이 지난 식수가 포함되어 있어 삭제할 수 없습니다.`);
      return;
    }
  
    if (!confirm("정말 삭제하시겠습니까?")) return;
  
    deleteData(`${API_BASE_URL}/visitors/${id}`, () => {
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

  const isBExpired = isDeadlinePassed(date, "breakfast");
  const isLExpired = isDeadlinePassed(date, "lunch");
  const isDExpired = isDeadlinePassed(date, "dinner");

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

  const isBExpired = isDeadlinePassed(date, "breakfast");
  const isLExpired = isDeadlinePassed(date, "lunch");
  const isDExpired = isDeadlinePassed(date, "dinner");

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

  if (breakfast === bPrev && lunch === lPrev && dinner === dPrev && reason === (reasonInput?.dataset.prev || "").trim()) {
    alert("변경된 내용이 없습니다.");
    loadWeeklyVisitData();
    return;
  }

  const data = { reason };
  if (!isBExpired) data.breakfast = breakfast;
  if (!isLExpired) data.lunch = lunch;
  if (!isDExpired) data.dinner = dinner;

  putData(`${API_BASE_URL}/visitors/${id}`, data, () => {
    alert("✅ 수정 완료");
    loadWeeklyVisitData();
  });
  localStorage.setItem("lastWeeklyVisitDate", date);
}

// ============================================================================
// 6. 인풋 박스 색상 경고 비주얼 제어
// ============================================================================
function updateDeadlineColors() {
  const dateField = document.getElementById("visit-date");
  if (!dateField || !dateField.value) return;
  const date = dateField.value;

  const inputs = [
    document.getElementById("b-count"),
    document.getElementById("l-count"),
    document.getElementById("d-count")
  ];

  inputs.forEach(input => {
    if(!input) return;
    input.classList.remove("expired-input");
    input.readOnly = false;
    input.title = "";
  });

  if (isDeadlinePassed(date, "breakfast") && inputs[0]) {
    inputs[0].classList.add("expired-input");
    inputs[0].readOnly = true;
    inputs[0].title = "⛔ 조식은 신청 마감되었습니다.";
  }
  if (isDeadlinePassed(date, "lunch") && inputs[1]) {
    inputs[1].classList.add("expired-input");
    inputs[1].readOnly = true;
    inputs[1].title = "⛔ 중식은 신청 마감되었습니다.";
  }
  if (isDeadlinePassed(date, "dinner") && inputs[2]) {
    inputs[2].classList.add("expired-input");
    inputs[2].readOnly = true;
    inputs[2].title = "⛔ 석식은 신청 마감되었습니다.";
  }

  if (isNextWeekDeadlinePassed(date)) {
    inputs.forEach(input => {
      if(!input) return;
      input.classList.add("expired-input");
      input.readOnly = true;
      input.title = "⛔ 다음 주 식사는 신청 기간이 경과되었습니다.";
    });
  }
}

// ============================================================================
// 7. 주간 일괄 입력 제어 락 (클로저 IIFE 모듈 탑재)
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

  function getUserType() { return sessionStorage.getItem("type") || "방문자"; }

  function isReasonRequired() {
    const userType = getUserType();
    const isException = sessionStorage.getItem("dept") === "신명전력";
    return !(userType === "협력사" && !isException);
  }

  function getActualType() { return getUserType() === "협력사" ? "협력사" : "방문자"; }

  const 常规Reason = (reason) => {
    const isException = sessionStorage.getItem("dept") === "신명전력";
    if (getUserType() === "협력사" && !isException) return "협력사 신청";
    return (reason || "").trim();
  }

  function getWeekDatesFromMonday(baseDateStr) {
    const base = new Date(baseDateStr);
    const mon = mondayOf(base);
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      dates.push(ymdKST(d));
    }
    return dates;
  }

  function toggleBulkVisit() {
    const wrapper = document.getElementById(BULK_IDS.wrapper);
    if (!wrapper) return;
    const isHidden = wrapper.classList.contains("ui-hidden");
    if (isHidden) {
      wrapper.classList.remove("ui-hidden");
      renderBulkVisitRows();
    } else {
      wrapper.classList.add("ui-hidden");
    }
  }

  function renderBulkVisitRows() {
    const bulkBody = document.getElementById(BULK_IDS.body);
    if (!bulkBody) return;

    const baseDateInput = document.getElementById(BULK_IDS.singleDate);
    if (!baseDateInput || !baseDateInput.value) return;
    const baseDateStr = baseDateInput.value;

    const dates = getWeekDatesFromMonday(baseDateStr);
    const { start, end } = getWeekStartAndEnd(baseDateStr);
    const user = JSON.parse(sessionStorage.getItem("currentUser"));

    getData(`${API_BASE_URL}/visitors/weekly?start=${start}&end=${end}`, (allData) => {
      const myDataMap = {};
      const actualType = sessionStorage.getItem("type") === "직영" ? "방문자" : "협력사";
      
      (allData || []).forEach(item => {
        if (item.applicant_id === user.userId && item.type === actualType) {
          myDataMap[item.date] = item;
        }
      });

      bulkBody.innerHTML = "";
      dates.forEach((date, index) => {
        const rowData = myDataMap[date] || { breakfast: 0, lunch: 0, dinner: 0, reason: "" };
        const row = document.createElement("tr");
        row.dataset.date = date; 

        const isClosed = isDeadlinePassed(date, "lunch");

        let html = `
          <td class="col-adate">${date}</td>
          <td class="col-aday">${getWeekdayName(date)}</td>
          <td class="col-abreakfast"><input type="number" class="bulk-b-count" data-date="${date}" value="${rowData.breakfast}" min="0" ${isClosed ? 'disabled' : ''}></td>
          <td class="col-alunch"><input type="number" class="bulk-l-count" data-date="${date}" value="${rowData.lunch}" min="0" ${isClosed ? 'disabled' : ''}></td>
          <td class="col-adinner"><input type="number" class="bulk-d-count" data-date="${date}" value="${rowData.dinner}" min="0" ${isClosed ? 'disabled' : ''}></td>
          <td class="col-areason"><input type="text" class="bulk-reason-input" data-date="${date}" value="${rowData.reason}" placeholder="사유" ${isClosed ? 'disabled' : ''}></td>
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
    });
  }

  function applyStateToInput(input, locked, title) {
    if (!input) return;
    input.readOnly = !!locked;
    input.classList.toggle("expired-input", !!locked);
    input.title = locked ? title : "";
  }

  function applyBulkDeadlineState() {
    document.querySelectorAll(`#${BULK_IDS.body} tr`).forEach((row) => {
      const date = row.dataset.date;
      const bInput = row.querySelector(".bulk-b-count");
      const lInput = row.querySelector(".bulk-l-count");
      const dInput = row.querySelector(".bulk-d-count");

      applyStateToInput(bInput, false, "");
      applyStateToInput(lInput, false, "");
      applyStateToInput(dInput, false, "");

      if (isDeadlinePassed(date, "breakfast")) applyStateToInput(bInput, true, "⛔ 조식 마감");
      if (isDeadlinePassed(date, "lunch")) applyStateToInput(lInput, true, "⛔ 중식 마감");
      if (isDeadlinePassed(date, "dinner")) applyStateToInput(dInput, true, "⛔ 석식 마감");
      if (isNextWeekDeadlinePassed(date)) {
        applyStateToInput(bInput, true, "⛔ 다음 주 마감");
        applyStateToInput(lInput, true, "⛔ 다음 주 마감");
        applyStateToInput(dInput, true, "⛔ 다음 주 마감");
      }
    });
  }

  function collectBulkRows() {
    return Array.from(document.querySelectorAll(`#${BULK_IDS.body} tr`)).map((row) => ({
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

  function saveVisitByData(rawData, callbacks = {}) {
    const date = rawData.date;
    const breakfast = Number(rawData.breakfast) || 0;
    const lunch = Number(rawData.lunch) || 0;
    const dinner = Number(rawData.dinner) || 0;
    const reason = 常规Reason(rawData.reason);

    if (breakfast + lunch + dinner === 0 || (isReasonRequired() && !reason) || isNextWeekDeadlinePassed(date)) {
      if (callbacks.onError) callbacks.onError(`${date}: 검증 실패`);
      return;
    }

    const expiredList = getExpiredMeals(date, { breakfast, lunch, dinner });
    if (expiredList.length === 3) {
      if (callbacks.onError) callbacks.onError(`${date}: 전 수량 마감`);
      return;
    }

    const actualType = getActualType();
    const checkUrl = `${API_BASE_URL}/visitors/check?date=${date}&id=${sessionStorage.getItem("id")}&type=${actualType}`;

    getData(`/holidays?year=${date.substring(0, 4)}`, (holidays) => {
      if ((holidays || []).some(h => h.date === date)) {
        if (callbacks.onError) callbacks.onError(`${date}: 공휴일`);
        return;
      }

      getData(checkUrl, (res) => {
        if (res && res.exists && callbacks.confirmOverwrite) {
          if (!callbacks.confirmOverwrite(date)) {
            if (callbacks.onSkip) callbacks.onSkip(date);
            return;
          }
        }

        const visitData = { applicant_id: sessionStorage.getItem("id"), applicant_name: sessionStorage.getItem("name"), date, reason, type: actualType, requested_by_admin: false };
        if (!expiredList.includes("breakfast")) visitData.breakfast = breakfast;
        if (!expiredList.includes("lunch")) visitData.lunch = lunch;
        if (!expiredList.includes("dinner")) visitData.dinner = dinner;

        postData("/visitors", visitData, () => { if (callbacks.onSuccess) callbacks.onSuccess(date); }, () => { if (callbacks.onError) callbacks.onError(date); });
      });
    });
  }

  function submitBulkVisit() {
    const targets = collectBulkRows();
    if (targets.length === 0) return alert("일괄 저장할 수량이 없습니다.");

    const successList = [], failList = [];
    const run = (index) => {
      if (index >= targets.length) {
        loadWeeklyVisitData();
        clearBulkRows();
        renderBulkVisitRows();
        alert(`일괄 저장 완료\n성공: ${successList.length}건\n실패: ${failList.length}건`);
        return;
      }

      saveVisitByData(targets[index], {
        confirmOverwrite: (date) => confirm(`📌 ${date}에 이미 신청 내역이 있습니다. 덮어쓰시겠습니까?`),
        onSuccess: (date) => { successList.push(date); run(index + 1); },
        onError: (date) => { failList.push(date); run(index + 1); },
        onSkip: (date) => { run(index + 1); }
      });
    };
    run(0);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById(BULK_IDS.toggle);
    if (toggleBtn) toggleBtn.addEventListener("click", toggleBulkVisit);
    document.addEventListener("click", (event) => {
      if (event.target.closest(`#${BULK_IDS.save}`)) submitBulkVisit();
    });
  });

  window.renderBulkVisitRows = renderBulkVisitRows;
})();

// ============================================================================
// 8. 로그 조회 액션 파이프라인
// ============================================================================
function loadDeptVisitorLogs() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  if (!user) return;
  
  const container = document.getElementById("dept-log-body");
  const startInput = document.getElementById("logStartDate");
  const endInput = document.getElementById("logEndDate");
  const nameInput = document.getElementById("logName");

  if (!startInput || !endInput || !container) return;
  const name = nameInput ? nameInput.value.trim() : "";

  const url = `/admin/visitor_logs?start=${startInput.value}&end=${endInput.value}&dept=${user.dept}&name=${name}`;
  container.innerHTML = `<tr><td colspan="6" class="empty-row-text">데이터를 불러오는 중입니다...</td></tr>`;

  getData(url, (logs) => {
    if (!logs || logs.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="empty-row-text">📭 해당 기간에 식수 변경 로그가 없습니다.</td></tr>`;
      return;
    }
    container.innerHTML = "";
    logs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    logs.forEach(row => {
      const beforeStr = `조(${row.before_breakfast || 0}), 중(${row.before_lunch || 0}), 석(${row.before_dinner || 0})`;
      const afterStr = `조(${row.breakfast || 0}), 중(${row.lunch || 0}), 석(${row.dinner || 0})`;
      const timeStr = typeof formatToKoreanTime === "function" ? formatToKoreanTime(row.updated_at) : row.updated_at;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.dept || "-"}</td>
        <td class="log-name-cell">${row.applicant_name}</td>
        <td class="log-before-cell">${beforeStr}</td>
        <td class="log-after-cell changed">${afterStr}</td>
        <td class="log-time-cell">${timeStr}</td>
      `;
      container.appendChild(tr);
    });
  });
}

// ============================================================================
// 9. 역대 주간 내역 일괄 편집 및 일괄 저장 시스템 부품
// ============================================================================
function toggleHistoryBulkEdit() {
    const tbody = document.getElementById("visit-summary-body");
    if (!tbody) return;
    const rows = tbody.querySelectorAll("tr:not(.empty-row-text):not(.expired-row)");
    const saveBtn = document.getElementById("history-bulk-save-btn");
    const editBtn = document.getElementById("history-bulk-edit-btn");

    if (rows.length === 0) return alert("수정 가능한 내역이 없습니다.");
    const isEditing = editBtn.innerText.includes("취소");

    if (!isEditing) {
        rows.forEach(row => renderRowToEditMode(row));
        if (editBtn) {
            editBtn.innerText = "❌ 편집 취소";
            editBtn.style.backgroundColor = "#ef4444";
        }
        if (saveBtn) saveBtn.classList.remove("ui-hidden");
    } else {
        loadWeeklyVisitData();
        if (editBtn) {
            editBtn.innerText = "✏️ 일괄 편집";
            editBtn.style.backgroundColor = "#6366f1";
        }
        if (saveBtn) saveBtn.classList.add("ui-hidden");
    }
}

function renderRowToEditMode(tr) {
  if (tr.querySelector("input")) return;
  const date = tr.querySelector(".date-cell").innerText;
  const b = tr.querySelector(".b-cell").innerText;
  const l = tr.querySelector(".l-cell").innerText;
  const d = tr.querySelector(".d-cell").innerText;
  const r = tr.querySelector(".r-cell")?.innerText || "";

  const isBExpired = isDeadlinePassed(date, "breakfast");
  const isLExpired = isDeadlinePassed(date, "lunch");
  const isDExpired = isDeadlinePassed(date, "dinner");

  tr.querySelector(".b-cell").innerHTML = isBExpired ? `${b}<input type="hidden" class="edit-b" value="${b}" data-prev="${b}">` : `<input type="number" class="edit-b" min="0" max="50" value="${b}" data-prev="${b}">`;
  tr.querySelector(".l-cell").innerHTML = isLExpired ? `${l}<input type="hidden" class="edit-l" value="${l}" data-prev="${l}">` : `<input type="number" class="edit-l" min="0" max="50" value="${l}" data-prev="${l}">`;
  tr.querySelector(".d-cell").innerHTML = isDExpired ? `${d}<input type="hidden" class="edit-d" value="${d}" data-prev="${d}">` : `<input type="number" class="edit-d" min="0" max="50" value="${d}" data-prev="${d}">`;
  if (tr.querySelector(".r-cell")) tr.querySelector(".r-cell").innerHTML = `<input type="text" class="edit-r" value="${r}" data-prev="${r}">`;

  const editBtn = tr.querySelector("button.action-edit");
  if (editBtn) {
    editBtn.innerText = "💾";
    editBtn.classList.replace("action-edit", "action-save-edit");
  }
}

function submitHistoryBulkUpdate() {
    const rows = document.querySelectorAll("#visit-summary-body tr[data-id]");
    const updateData = [];

    rows.forEach(row => {
        const bInput = row.querySelector(".edit-b");
        const lInput = row.querySelector(".edit-l");
        const dInput = row.querySelector(".edit-d");
        const rInput = row.querySelector(".edit-r");
        if (!bInput) return;

        const bNew = Number(bInput.value), lNew = Number(lInput.value), dNew = Number(dInput.value), rNew = rInput?.value.trim() || "협력사 신청";
        const bPrev = Number(bInput.dataset.prev), lPrev = Number(lInput.dataset.prev), dPrev = Number(dInput.dataset.prev), rPrev = (rInput?.dataset.prev || "").trim();

        if ((bNew !== bPrev) || (lNew !== lPrev) || (dNew !== dPrev) || (rNew !== rPrev)) {
            updateData.push({ id: row.getAttribute("data-id"), date: row.querySelector(".date-cell").innerText, breakfast: bNew, lunch: lNew, dinner: dNew, reason: rNew });
        }
    });

    if (updateData.length === 0) return alert("변경된 내용이 없습니다.");
    if (!confirm(`변경된 내역 총 ${updateData.length}건을 일괄 저장하시겠습니까?`)) return;

    let successCount = 0;
    const runUpdate = (index) => {
        if (index >= updateData.length) {
            alert(`✅ 일괄 수정 완료 (${successCount}건)`);
            loadWeeklyVisitData();
            const editBtn = document.getElementById("history-bulk-edit-btn");
            const saveBtn = document.getElementById("history-bulk-save-btn");
            if (editBtn) {
                editBtn.innerText = "✏️ 일괄 편집";
                editBtn.style.backgroundColor = "#6366f1";
            }
            if (saveBtn) saveBtn.classList.add("ui-hidden");
            return;
        }
        const item = updateData[index];
        putData(`${API_BASE_URL}/visitors/${item.id}`, item, () => { successCount++; runUpdate(index + 1); }, () => { runUpdate(index + 1); });
    };
    runUpdate(0);
}