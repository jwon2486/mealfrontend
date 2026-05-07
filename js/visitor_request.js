// visitor_request.js

let lastSubmittedDate = null;

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

    loadLoginInfo();
    updateWeekday();
    loadWeeklyVisitData();

    if (typeof initMenuBoard === "function") initMenuBoard();
    
    applyUserTypeUI();
});

function toggleVisibility(element, show, displayClass = '') {
  if (!element) return;
  element.classList.remove('ui-hidden', 'ui-block', 'ui-inline-block', 'ui-flex');
  if (show) {
    if (displayClass) {
        element.classList.add(displayClass);
    }
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

      pages.forEach(page => page.classList.remove("active"));
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

function handleDateChange() {
  const input = document.getElementById("visit-date");
  const picked = new Date(input.value);
   
  if (picked.getDay() === 0 || picked.getDay() === 6) {
    alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
    const adjusted = getNearestWeekday(picked);
    input.value = adjusted.toISOString().split("T")[0];
  }

  const selectedDate = input.value;
  document.getElementById("visit-week-date").value = selectedDate;

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
  handleDateChange();
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

function loadLoginInfo() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  if (user && user.userName) {
    document.getElementById("login-user").innerText = `${user.userName} (${user.dept})`;
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

  if (editBtn) {
    editVisit(editBtn.dataset.id);
  } else if (deleteBtn) {
    deleteVisit(deleteBtn.dataset.id);
  } else if (saveEditBtn) {
    saveVisitEdit(saveEditBtn.dataset.id);
  }
}

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
      
      const isClosed = isDeadlinePassed(date, "lunch", 1); 

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

function loadDeptVisitorLogs() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  if (!user) return;
  const dept = user.dept;
  
  const nameInput = document.getElementById("logName");
  const startInput = document.getElementById("logStartDate");
  const endInput = document.getElementById("logEndDate");
  const container = document.getElementById("dept-log-body");

  if (!startInput || !endInput || !container) return;

  const name = nameInput ? nameInput.value.trim() : "";
  let start = startInput.value;
  let end = endInput.value;

  if (!start || !end) {
    if (typeof getCurrentWeekRange === "function") {
        const week = getCurrentWeekRange();
        start = week.start;
        end = week.end;
        startInput.value = start;
        endInput.value = end;
    }
  }

  container.innerHTML = `<tr><td colspan="6" class="empty-row-text">데이터를 불러오는 중입니다...</td></tr>`;

  const url = `/admin/visitor_logs?start=${start}&end=${end}&dept=${dept}&name=${name}`;
  
  getData(url, (logs) => {
    if (!logs || logs.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="empty-row-text">📭 해당 기간에 식수 변경 로그가 없습니다.</td></tr>`;
      return;
    }

    container.innerHTML = "";
    logs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    logs.forEach(row => {
      const beforeB = row.before_breakfast || 0;
      const beforeL = row.before_lunch || 0;
      const beforeD = row.before_dinner || 0;
      const afterB = row.breakfast || 0;
      const afterL = row.lunch || 0;
      const afterD = row.dinner || 0;

      const beforeStr = `조(${beforeB}), 중(${beforeL}), 석(${beforeD})`;
      const afterStr = `조(${afterB}), 중(${afterL}), 석(${afterD})`;

      const isChanged = (beforeB !== afterB) || (beforeL !== afterL) || (beforeD !== afterD);
      const changedClass = isChanged ? "changed" : "unchanged";

      const tr = document.createElement("tr");
      const timeStr = typeof formatToKoreanTime === "function" ? formatToKoreanTime(row.updated_at) : row.updated_at;

      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.dept || "-"}</td>
        <td class="log-name-cell">${row.applicant_name}</td>
        <td class="log-before-cell">${beforeStr}</td>
        <td class="log-after-cell ${changedClass}">${afterStr}</td>
        <td class="log-time-cell">${timeStr}</td>
      `;
      container.appendChild(tr);
    });
  });
}

// 1. 이벤트 리스너 등록 (DOMContentLoaded 내부나 하단에 추가)
document.getElementById("history-bulk-edit-btn").addEventListener("click", toggleHistoryBulkEdit);
document.getElementById("history-bulk-save-btn").addEventListener("click", submitHistoryBulkUpdate);

// 2. 일괄 편집 모드 토글 함수
function toggleHistoryBulkEdit() {
    const tbody = document.getElementById("visit-summary-body");
    const rows = tbody.querySelectorAll("tr:not(.empty-row-text):not(.expired-row)");
    const saveBtn = document.getElementById("history-bulk-save-btn");
    const editBtn = document.getElementById("history-bulk-edit-btn");

    if (rows.length === 0) {
        alert("수정 가능한 내역이 없습니다.");
        return;
    }

    const isEditing = editBtn.innerText.includes("취소");

    if (!isEditing) {
        // 편집 모드 시작
        rows.forEach(row => {
            const id = row.getAttribute("data-id");
            // 기존 editVisit(id) 로직을 활용하되 UI만 변경
            renderRowToEditMode(row);
        });
        editBtn.innerText = "❌ 편집 취소";
        editBtn.style.backgroundColor = "#ef4444";
        saveBtn.classList.remove("ui-hidden");
    } else {
        // 편집 모드 취소 (새로고침으로 복구)
        loadWeeklyVisitData();
        editBtn.innerText = "✏️ 일괄 편집";
        editBtn.style.backgroundColor = "#6366f1";
        saveBtn.classList.add("ui-hidden");
    }
}

// 3. 특정 행을 입력 필드로 전환 (기존 editVisit 로직 커스텀)
function renderRowToEditMode(tr) {
  // 이미 편집 모드라면 중복 실행 방지
  if (tr.querySelector("input")) return;

  const date = tr.querySelector(".date-cell").innerText;
  const b = tr.querySelector(".b-cell").innerText;
  const l = tr.querySelector(".l-cell").innerText;
  const d = tr.querySelector(".d-cell").innerText;
  const r = tr.querySelector(".r-cell")?.innerText || "";

  // 1. 마감 여부 확인 (기존 로직 동일 적용)
  const isBExpired = isDeadlinePassed(date, "breakfast", Number(b));
  const isLExpired = isDeadlinePassed(date, "lunch", Number(l));
  const isDExpired = isDeadlinePassed(date, "dinner", Number(d));

  // 2. 수량 칸을 기존 editVisit과 동일한 형태로 변환
  // 기존 코드의 핵심인 'data-prev' 속성을 반드시 넣어야 나중에 변경 여부 감지가 가능합니다.
  tr.querySelector(".b-cell").innerHTML = isBExpired
    ? `${b}<input type="hidden" class="edit-b" value="${b}" data-prev="${b}">`
    : `<input type="number" class="edit-b" min="0" max="50" value="${b}" data-prev="${b}">`;

  tr.querySelector(".l-cell").innerHTML = isLExpired
    ? `${l}<input type="hidden" class="edit-l" value="${l}" data-prev="${l}">`
    : `<input type="number" class="edit-l" min="0" max="50" value="${l}" data-prev="${l}">`;

  tr.querySelector(".d-cell").innerHTML = isDExpired
    ? `${d}<input type="hidden" class="edit-d" value="${d}" data-prev="${d}">`
    : `<input type="number" class="edit-d" min="0" max="50" value="${d}" data-prev="${d}">`;

  // 3. 사유 칸 변환
  if (tr.querySelector(".r-cell")) {
    tr.querySelector(".r-cell").innerHTML = `<input type="text" class="edit-r" value="${r}" data-prev="${r}">`;
  }

  // 4. 개별 행의 수정 버튼 상태 변경 (시각적 통일성)
  const editBtn = tr.querySelector("button.action-edit");
  if (editBtn) {
    editBtn.innerText = "💾";
    editBtn.classList.replace("action-edit", "action-save-edit");
  }
}

// 4. 일괄 저장 실행 함수
function submitHistoryBulkUpdate() {
    const tbody = document.getElementById("visit-summary-body");
    const rows = tbody.querySelectorAll("tr[data-id]");
    const updateData = [];

    rows.forEach(row => {
        const bInput = row.querySelector(".edit-b");
        const lInput = row.querySelector(".edit-l");
        const dInput = row.querySelector(".edit-d");
        const rInput = row.querySelector(".edit-r");

        if (!bInput) return; // 편집 모드가 아닌 행 제외

        // 1. 현재 값과 이전 값(data-prev) 비교
        const bNew = Number(bInput.value);
        const lNew = Number(lInput.value);
        const dNew = Number(dInput.value);
        const rNew = rInput?.value.trim() || "협력사 신청";

        const bPrev = Number(bInput.dataset.prev);
        const lPrev = Number(lInput.dataset.prev);
        const dPrev = Number(dInput.dataset.prev);
        const rPrev = (rInput?.dataset.prev || "").trim();

        const isChanged = (bNew !== bPrev) || (lNew !== lPrev) || (dNew !== dPrev) || (rNew !== rPrev);

        // 2. 변경된 데이터만 배열에 담기
        if (isChanged) {
            updateData.push({
                id: row.getAttribute("data-id"),
                date: row.querySelector(".date-cell").innerText,
                breakfast: bNew,
                lunch: lNew,
                dinner: dNew,
                reason: rNew
            });
        }
    });

    // 3. 변경된 내용이 없는 경우 처리
    if (updateData.length === 0) {
        alert("변경된 내용이 없습니다.");
        return;
    }

    if (!confirm(`변경된 내역 총 ${updateData.length}건을 저장하시겠습니까?`)) return;

    // 순차적 업데이트 실행 (기존 로직 유지)
    let successCount = 0;
    const runUpdate = (index) => {
        if (index >= updateData.length) {
            alert(`✅ 일괄 수정 완료 (${successCount}건)`);
            location.reload(); 
            return;
        }

        const item = updateData[index];
        putData(`${API_BASE_URL}/visitors/${item.id}`, item, () => {
            successCount++;
            runUpdate(index + 1);
        }, () => {
            console.error(`${item.date} 수정 실패`);
            runUpdate(index + 1);
        });
    };

    runUpdate(0);
}

function printMenuImage(imgSrc) {
  if (!imgSrc) return;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>식단표 인쇄</title>
        <style>
          @page { size: auto; margin: 5mm; }
          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
          img { max-width: 100%; height: auto; object-fit: contain; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <img src="${imgSrc}" />
      </body>
    </html>
  `);
  printWindow.document.close();
}