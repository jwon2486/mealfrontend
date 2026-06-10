/**
 * 에스엔시스 식수 신청 시스템 - 방문자/협력사 스크립트 (최종 패치 및 날짜 규격 리팩토링 버전)
 */

let lastSubmittedDate = null;
window.serverDeadlines = null; 

/**
 * ============================================================================
 * [1. 초기화 및 이벤트 바인딩]
 * ============================================================================
 */
document.addEventListener("DOMContentLoaded", () => {
    // 사이드바 및 탭 전환 활성화
    setupSidebarAndTabs();

    // 상단 및 기본 버튼 액션 바인딩
    document.getElementById("page-button")?.addEventListener("click", goToMain);
    document.getElementById("visit-data-save-btn")?.addEventListener("click", submitVisit);
    document.getElementById("load-thisweek-btn")?.addEventListener("click", loadThisWeek);
    document.getElementById("load-visit-data-btn")?.addEventListener("click", loadWeeklyVisitData);

    // 날짜 및 테이블 동적 액션 바인딩
    document.getElementById("visit-date")?.addEventListener("change", handleDateChange);
    document.getElementById("visit-summary-body")?.addEventListener("click", handleTableActions);

    // 신청 내역 일괄 수정 기능 바인딩
    document.getElementById("history-bulk-edit-btn")?.addEventListener("click", toggleHistoryBulkEdit);
    document.getElementById("history-bulk-save-btn")?.addEventListener("click", submitHistoryBulkUpdate);

    // 실시간 서버 시간 동기화 파이프라인 트리거
    if (typeof syncServerTime === "function") {
        syncServerTime(() => initializeApplicationPipeline());
    } else {
        initializeApplicationPipeline();
    }
});

/**
 * 로그인 세션 정보 확인 후 애플리케이션 초기 데이터 로딩 지휘
 */
function initializeApplicationPipeline() {
    const storedDate = sessionStorage.getItem("lastVisitDate");
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const todayStr = ymdKST(now);

    if (storedDate && storedDate !== todayStr) {
        const dateInputEl = document.getElementById("visit-date");
        const weekInputEl = document.getElementById("visit-week-date");
        if (dateInputEl) dateInputEl.value = storedDate;
        if (weekInputEl) weekInputEl.value = storedDate;
    } else {
        setTodayDefault();
    }

    loadLoginInfo();
    
    // 마감 규칙 동적 셋팅 후 후속 데이터 렌더링
    loadDeadlinesForVisitor(() => {
        updateWeekday();
        loadWeeklyVisitData();
        if (typeof initMenuBoard === "function") initMenuBoard();
        applyUserTypeUI();
    });
}

/**
 * ============================================================================
 * [2. 날짜 및 시간 처리 유틸리티]
 * ============================================================================
 */
function ymdKST(dateObj) {
    const pad = n => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
}

function mondayOf(dateObj) {
    const copy = new Date(dateObj);
    const dayIndex = (copy.getDay() + 6) % 7; // 월요일(0) ~ 일요일(6) 보정
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - dayIndex);
    return copy;
}

function getThisWeekMonday() {
    const today = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    return ymdKST(mondayOf(today));
}

function getNearestWeekday(dateObj) {
    const day = dateObj.getDay();
    if (day === 6) dateObj.setDate(dateObj.getDate() + 2);      // 토 -> 월
    else if (day === 0) dateObj.setDate(dateObj.getDate() + 1); // 일 -> 월
    return dateObj;
}

/**
 * ============================================================================
 * [3. 마감 시간 검증 엔진]
 * ============================================================================
 */
function loadDeadlinesForVisitor(callback) {
    getData("/admin/api/deadlines", (data) => {
        window.serverDeadlines = data;
        if (callback) callback();
    }, () => {
        console.warn("⚠️ 마감 설정 연동 실패. 비상용 기본 규칙으로 대체합니다.");
        window.serverDeadlines = { 
            breakfast_days_before: "1", breakfast_time: "09:00", 
            lunch_days_before: "0", lunch_time: "10:30", 
            dinner_days_before: "0", dinner_time: "14:30",
            next_week_day_of_week: "3", next_week_time: "16:00"
        };
        if (callback) callback();
    });
}

function isDeadlinePassed(dateStr, mealType) {
    if (!window.serverDeadlines) return true; 
    
    // dateStr이 혹시 모를 Date 객체일 경우를 대비해 문자열로 안전하게 보정
    const targetDateStr = (dateStr instanceof Date) ? ymdKST(dateStr) : dateStr;
    
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mealTargetDate = new Date(targetDateStr);
    mealTargetDate.setHours(0, 0, 0, 0);

    const isLunch = (mealType === "lunch" || mealType === "중식");
    const isDinner = (mealType === "dinner" || mealType === "석식");
    const prefix = isLunch ? "lunch" : (isDinner ? "dinner" : "breakfast");

    const daysBefore = parseInt(window.serverDeadlines[`${prefix}_days_before`] || 0, 10);
    const timeStr = window.serverDeadlines[`${prefix}_time`] || "00:00";
    const [hour, minute] = timeStr.split(":").map(Number);

    const deadline = new Date(mealTargetDate);
    deadline.setDate(deadline.getDate() - daysBefore);
    deadline.setHours(hour, minute, 0, 0);

    return now > deadline;
}

function isNextWeekDeadlinePassed(selectedDate) {
    if (!window.serverDeadlines) return true;
    
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mealTargetDate = new Date(selectedDate);

    const currentDayIdx = now.getDay() === 0 ? 7 : now.getDay(); 
    const thisWeekMonday = new Date(now);
    thisWeekMonday.setDate(now.getDate() - currentDayIdx + 1);
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

    if (mealTargetDate >= nextWeekMonday && mealTargetDate <= nextWeekSunday) {
        if (now >= nextWeekDeadline && now <= sundayEnd) {
            return true;
        }
    }
    return false;
}

/**
 * 💡 [리팩토링 핵심 지점]: 백엔드로 전송되는 날짜 포맷팅을 "YYYY-MM-DD" 문자열로 완벽 강제
 */
function getExpiredMeals(dateStr, mealData) {
    // 자바스크립트 Date 객체가 들어오면 텍스트 형식으로 명시적 강제 치환
    const formattedDate = (dateStr instanceof Date) ? ymdKST(dateStr) : dateStr;

    const expired = [];
    if (mealData.breakfast > 0 && isDeadlinePassed(formattedDate, "breakfast")) expired.push("breakfast");
    if (mealData.lunch > 0 && isDeadlinePassed(formattedDate, "lunch")) expired.push("lunch");
    if (mealData.dinner > 0 && isDeadlinePassed(formattedDate, "dinner")) expired.push("dinner");
    return expired;  
}

/**
 * ============================================================================
 * [4. UI 및 요소 제어 파트]
 * ============================================================================
 */
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
    const currentDept = sessionStorage.getItem("dept");
    const pageTitle = document.getElementById("page-title"); 
    const pageButton = document.getElementById("page-button"); 
    const applyNavLink = document.querySelector('.erp-nav-link[data-page="visitorApplySection"]');
    const sidebarSubtitle = document.querySelector('.erp-sidebar-subtitle'); 
    const sidebarTitle = document.querySelector('.erp-sidebar-title'); 

    const reasonTh = document.getElementById("reason-th");
    const reasonInput = document.getElementById("visit-reason");
    const reasonTd = reasonInput ? reasonInput.closest("td") : null;
    const weeklyReasonTh = document.getElementById("weekly-reason-th");

    const isPartner = (userType === "협력사");
    const isException = (currentDept === "신명전력");

    if (pageTitle) pageTitle.innerText = isPartner ? "식수 신청 시스템" : "방문자 식수 신청";
    if (pageButton) pageButton.innerText = isPartner ? "🔙 로그아웃" : "🔙 뒤로가기";
    if (applyNavLink) applyNavLink.innerText = isPartner ? "협력사 신청" : "방문자 신청";
    if (sidebarSubtitle) sidebarSubtitle.innerText = isPartner ? "협력사 신청 메뉴" : "방문자 신청 메뉴";
    if (sidebarTitle) sidebarTitle.innerText = isPartner ? "PARTNER MENU" : "VISITOR MENU"; 

    // 💡 [의도 반영]: 협력사이더라도 '신명전력'이면 단건 입력 창에서 사유 입력란(reasonTh, reasonTd)을 시각적으로 노출합니다.
    if (isPartner) {
        toggleVisibility(reasonTh, isException);
        toggleVisibility(reasonTd, isException);
    } else {
        toggleVisibility(reasonTh, true);
        toggleVisibility(reasonTd, true);
    }
    
    toggleVisibility(weeklyReasonTh, true);
}

function setupSidebarAndTabs() {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const mainArea = document.getElementById("mainArea");
    const toggle = document.getElementById("mobileMenuToggle");
    const links = document.querySelectorAll(".erp-nav-link[data-page]");
    const pages = document.querySelectorAll(".erp-page");
    const sideActions = document.querySelectorAll(".erp-side-action");

    const closeMobileSidebar = () => {
        if (!mainArea || !toggle) return;
        mainArea.classList.remove("mobile-sidebar-open");
        toggle.setAttribute("aria-expanded", "false");
    };

    const syncMobileSidebar = () => {
        if (!mainArea || !toggle) return;
        mainArea.classList.remove("mobile-sidebar-open");
        toggle.setAttribute("aria-expanded", !mobileQuery.matches ? "true" : "false");
    };

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

function updateDeadlineColors() {
    const dateField = document.getElementById("visit-date");
    if (!dateField || !dateField.value) return;
    const dateStr = dateField.value;

    const inputs = [
        document.getElementById("b-count"),
        document.getElementById("l-count"),
        document.getElementById("d-count")
    ];

    inputs.forEach(input => {
        if (!input) return;
        input.classList.remove("expired-input");
        input.readOnly = false;
        input.title = "";
    });

    const mealTypes = ["breakfast", "lunch", "dinner"];
    const labels = ["조식", "중식", "석식"];

    inputs.forEach((input, idx) => {
        if (input && isDeadlinePassed(dateStr, mealTypes[idx])) {
            input.classList.add("expired-input");
            input.readOnly = true;
            input.title = `⛔ ${labels[idx]}은 신청 마감되었습니다.`;
        }
    });

    if (isNextWeekDeadlinePassed(dateStr)) {
        inputs.forEach(input => {
            if (!input) return;
            input.classList.add("expired-input");
            input.readOnly = true;
            input.title = "⛔ 다음 주 식사는 신청 기간이 경과되었습니다.";
        });
    }
}

/**
 * ============================================================================
 * [5. 비즈니스 장부 핸들러 및 트랜잭션 수집]
 * ============================================================================
 */
function handleDateChange() {
    const input = document.getElementById("visit-date");
    if (!input || !input.value) return;
    const picked = new Date(input.value);
     
    if (picked.getDay() === 0 || picked.getDay() === 6) {
        alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 평일로 보정됩니다.");
        const adjusted = getNearestWeekday(picked);
        input.value = ymdKST(adjusted);
    }

    const selectedDate = input.value;
    const weekField = document.getElementById("visit-week-date");
    if (weekField) weekField.value = selectedDate;

    const user = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    const actualType = sessionStorage.getItem("type") === "직영" ? "방문자" : "협력사";
    const checkUrl = `${API_BASE_URL}/visitors/check?date=${selectedDate}&id=${user.userId || ''}&type=${actualType}`;

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
            clearInput();
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

function handleTableActions(event) {
    const editBtn = event.target.closest('.action-edit');
    const deleteBtn = event.target.closest('.action-delete');
    const saveEditBtn = event.target.closest('.action-save-edit');

    if (editBtn) editVisit(editBtn.dataset.id);
    else if (deleteBtn) deleteVisit(deleteBtn.dataset.id);
    else if (saveEditBtn) saveVisitEdit(saveEditBtn.dataset.id);
}

function loadWeeklyVisitData() {
    const dateInput = document.getElementById("visit-week-date");
    if (!dateInput || !dateInput.value) return;
    
    const selectedDate = dateInput.value;
    const { start, end } = getWeekStartAndEnd(selectedDate);
    const params = `start=${start}&end=${end}`;
  
    getData(`/visitors/weekly?${params}`, (result) => {
        const tbody = document.getElementById("visit-summary-body");
        if (!tbody) return;
        tbody.innerHTML = "";
  
        if (!result || result.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="empty-row-text">신청 내역이 없습니다.</td></tr>`;
            return;
        }

        const todayStr = ymdKST((typeof getKSTNow === "function") ? getKSTNow() : new Date());
        const userType = sessionStorage.getItem("type") || "방문자";
        const currentDept = sessionStorage.getItem("dept"); 
        const currentUserId = sessionStorage.getItem("id");

        result.forEach(row => {
            if (userType === "협력사" && (row.type !== "협력사" || row.dept !== currentDept)) return;
            if (userType === "직영" && row.type !== "방문자") return;

            const tr = document.createElement("tr");
            const isOwner = (row.applicant_id === currentUserId);

            const bExpired = isDeadlinePassed(row.date, "breakfast");
            const lExpired = isDeadlinePassed(row.date, "lunch");
            const dExpired = isDeadlinePassed(row.date, "dinner");
            const rowExpired = bExpired && lExpired && dExpired;
            
            const isTodayOrLater = row.date >= todayStr;
            const isRowClosed = isNextWeekDeadlinePassed(row.date) || rowExpired || !isTodayOrLater;
            
            if (isRowClosed) tr.classList.add("expired-row");
            tr.setAttribute("data-id", row.id);
            
            const btnLockHTML = `<span class="closed-text">🔒마감</span>`;
            const editButtonHTML = (isOwner && !isRowClosed)
                ? `<button class="action-btn-icon action-edit" data-id="${row.id}" title="수정">✏️</button>` : btnLockHTML;
            const deleteButtonHTML = (isOwner && !isRowClosed)
                ? `<button class="action-btn-icon action-delete" data-id="${row.id}" title="삭제">🗑</button>` : btnLockHTML;

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
    }, (err) => {
        console.error("❌ 주간 신청 내역 불러오기 실패:", err);
        if (typeof showToast === "function") showToast("❌ 방문자 신청 데이터를 불러오는 데 실패했습니다.");
    });
}

function submitVisit() {
    const date = document.getElementById("visit-date").value;
    const breakfast = Number(document.getElementById("b-count").value || 0);
    const lunch = Number(document.getElementById("l-count").value || 0);
    const dinner = Number(document.getElementById("d-count").value || 0);
    const reasonInput = document.getElementById("visit-reason");
    const userType = sessionStorage.getItem("type") || "방문자";
    const actualType = userType === "직영" ? "방문자" : "협력사";
    
    if (isNextWeekDeadlinePassed(date)) {
        alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 신청할 수 없습니다.");
        return;
    }
  
    const currentDept = sessionStorage.getItem("dept");
    const isException = (currentDept === "신명전력");
    
    // 💡 [의도 반영]: 협력사이면서 신명전력이 아니라면 무조건 사유를 "협력사 신청"으로 고정 처리합니다.
    const reason = (userType === "협력사" && !isException) ? "협력사 신청" : (reasonInput ? reasonInput.value.trim() : "");

    if (!date || (breakfast + lunch + dinner === 0) || reason === "") {
        alert("❗ 날짜, 식사 수량, 신청 사유를 정확하게 입력해주세요.\n(방문자 및 신명전력 신청 시 사유는 필수 입력 항목입니다.)");
        return;
    }

    localStorage.setItem("lastVisitDate", date);
    lastSubmittedDate = date;

    const checkUrl = `${API_BASE_URL}/visitors/check?date=${date}&id=${sessionStorage.getItem("id")}&type=${actualType}`;
    const mealData = { breakfast, lunch, dinner };
    
    const expiredList = getExpiredMeals(date, mealData);

    if (expiredList.length === 3) {
        alert("⛔ 모든 식사가 마감되어 신청할 수 없습니다.");
        return;
    }

    getData(`/holidays?year=${date.substring(0, 4)}`, (holidays) => {
        if ((holidays || []).some(h => h.date === date)) {
            alert(`❌ ${date}는 공휴일입니다. 신청할 수 없습니다.`);
            return;
        }
    
        getData(checkUrl, (res) => {
            if (res && res.exists) {
                if (!confirm("📌 해당 날짜에 이미 신청한 내역이 있습니다. 덮어쓰시겠습니까?")) return;
            }

            const visitData = {
                applicant_id: sessionStorage.getItem("id"),
                applicant_name: sessionStorage.getItem("name"),
                date: date,
                reason: reason,
                type: actualType,
                breakfast: expiredList.includes("breakfast") ? 0 : breakfast,
                lunch: expiredList.includes("lunch") ? 0 : lunch,
                dinner: expiredList.includes("dinner") ? 0 : dinner,
                requested_by_admin: false
            };
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
        alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 수정/삭제할 수 없습니다.");
        loadWeeklyVisitData(); 
        return;
    }

    if (isDeadlinePassed(date, "breakfast") || isDeadlinePassed(date, "lunch") || isDeadlinePassed(date, "dinner")) {
        alert(`⛔ 신청 마감 시간이 지난 식수가 포함되어 있어 삭제할 수 없습니다.`);
        return;
    }
  
    if (!confirm("정말 삭제하시겠습니까?")) return;
  
    deleteData(`/visitors/${id}`, () => {
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

    // 💡 [의도 반영]: 테이블 내 개별 수정 시에도 일반 협력사라면 사유 칸을 readonly 처리합니다.
    if (tr.querySelector(".r-cell")) {
        const userType = sessionStorage.getItem("type") || "방문자";
        const currentDept = sessionStorage.getItem("dept");
        const isException = (currentDept === "신명전력");
        
        if (userType === "협력사" && !isException) {
            tr.querySelector(".r-cell").innerHTML = `<input type="text" value="협력사 신청" data-prev="${r}" readonly style="background-color: #f3f4f6; color: #6b7280; cursor: not-allowed;">`;
        } else {
            tr.querySelector(".r-cell").innerHTML = `<input type="text" value="${r}" data-prev="${r}">`;
        }
    }

    const editBtn = tr.querySelector("button.action-edit");
    if (editBtn) {
        editBtn.innerText = "💾";
        editBtn.title = "수정 완료";
        editBtn.classList.replace("action-edit", "action-save-edit");
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

    const breakfast = isDeadlinePassed(date, "breakfast") ? bPrev : Number(bInput?.value ?? 0);
    const lunch = isDeadlinePassed(date, "lunch") ? lPrev : Number(lInput?.value ?? 0);
    const dinner = isDeadlinePassed(date, "dinner") ? dPrev : Number(dInput?.value ?? 0);

    const userType = sessionStorage.getItem("type") || "방문자";
    const currentDept = sessionStorage.getItem("dept");
    const isException = (currentDept === "신명전력");
    
    // 💡 [의도 반영]: 저장 로직 단에서도 일반 협력사는 "협력사 신청" 고정 검증
    let reason = (reasonInput?.value || "").trim();
    if (userType === "협력사" && !isException) {
        reason = "협력사 신청";
    }

    if (!reason) {
        alert("❗ 사유를 입력해주세요.");
        return;
    }

    if (breakfast === bPrev && lunch === lPrev && dinner === dPrev && reason === (reasonInput?.dataset.prev || "").trim()) {
        alert("변경된 내용이 없습니다.");
        loadWeeklyVisitData();
        return;
    }

    const data = { reason, breakfast, lunch, dinner };

    putData(`/visitors/${id}`, data, () => {
        alert("✅ 수정 완료");
        loadWeeklyVisitData();
    });
    localStorage.setItem("lastWeeklyVisitDate", date);
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
    const dayField = document.getElementById("visit-day");
    if (dayField) dayField.innerText = getWeekdayName(dateField.value);
    updateDeadlineColors();
}

function loadLoginInfo() {
    const user = JSON.parse(sessionStorage.getItem("currentUser") || "null");
    if (user && user.userName) {
        const loginUserField = document.getElementById("login-user");
        if (loginUserField) loginUserField.innerText = `${user.userName} (${user.dept})`;
        
        const sessions = {
            id: user.userId, name: user.userName, type: user.type, dept: user.dept,
            userId: user.userId, userName: user.userName, userType: user.type, level: user.level
        };
        Object.keys(sessions).forEach(k => sessionStorage.setItem(k, sessions[k]));
        
        const logButton = document.getElementById("visit-log-button");
        if (logButton) {
            const hasAuth = (user.level === 3 || user.level === 2);
            toggleVisibility(logButton, hasAuth, 'ui-inline-block');
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

/**
 * ============================================================================
 * [6. 주간 일괄 입력 모듈 (IIFE 클로저 패턴 고수)]
 * ============================================================================
 */
(() => {
    const BULK_IDS = {
        toggle: "bulk-input-toggle-btn", wrapper: "bulk-visit-wrapper",
        body: "bulk-visit-body", save: "bulk-visit-save-btn",
        weekDate: "visit-week-date", singleDate: "visit-date"
    };

    const getUserType = () => sessionStorage.getItem("type") || "방문자";
    const getActualType = () => getUserType() === "협력사" ? "협력사" : "방문자";

    // 💡 [의도 반영]: 저장 시 사유 정제 모듈 파이프라인
    const getBulkReason = (reason) => {
        const isException = (sessionStorage.getItem("dept") === "신명전력");
        if (getUserType() === "협력사" && !isException) return "협력사 신청";
        return (reason || "").trim() || (getUserType() === "협력사" ? "협력사 신청" : "방문자 일괄신청");
    };

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
        const baseDateInput = document.getElementById(BULK_IDS.singleDate);
        if (!bulkBody || !baseDateInput || !baseDateInput.value) return;

        const baseDateStr = baseDateInput.value;
        const dates = getWeekDatesFromMonday(baseDateStr);
        const { start, end } = getWeekStartAndEnd(baseDateStr);
        const user = JSON.parse(sessionStorage.getItem("currentUser") || "{}");

        getData(`/visitors/weekly?start=${start}&end=${end}`, (allData) => {
            const myDataMap = {};
            const actualType = getActualType();
            
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

                const defaultReason = actualType === "협력사" ? "협력사 신청" : "방문자 일괄신청";
                const currentDept = sessionStorage.getItem("dept");
                const isEditablePartner = (currentDept === "신명전력"); // 신명전력 여부 확인

                // 💡 [의도 반영 핵심]: 협력사이면서 '신명전력'이 아닌 경우에만 속성 잠금 문자열(readonly) 동적 바인딩 추가
                const lockStyleAttribute = (actualType === "협력사" && !isEditablePartner)
                    ? 'readonly style="background-color: #f3f4f6; color: #6b7280; cursor: not-allowed;"'
                    : '';

                let html = `
                    <td class="col-adate">${date}</td>
                    <td class="col-aday"><strong>${getWeekdayName(date)}</strong></td>
                    <td class="col-abreakfast"><input type="number" class="bulk-b-count" data-date="${date}" value="${rowData.breakfast}" min="0" max="50"></td>
                    <td class="col-alunch"><input type="number" class="bulk-l-count" data-date="${date}" value="${rowData.lunch}" min="0" max="50"></td>
                    <td class="col-adinner"><input type="number" class="bulk-d-count" data-date="${date}" value="${rowData.dinner}" min="0" max="50"></td>
                    <td class="col-areason"><input type="text" class="bulk-reason-input" data-date="${date}" value="${rowData.reason || defaultReason}" ${lockStyleAttribute}></td>
                `;

                if (index === 0) {
                    html += `
                        <td class="col-asave bulk-save-cell" rowspan="${dates.length}">
                            <button type="button" id="${BULK_IDS.save}" class="action-btn save-btn visitor-save-btn bulk-save-btn-large" style="height: 100%; min-height: 180px; width: 100%;">
                                💾<br><br>일괄<br>저장
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
        input.disabled = !!locked;
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
                [bInput, lInput, dInput].forEach(inp => applyStateToInput(inp, true, "⛔ 다음 주 마감"));
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
        }));
    }

    function clearBulkRows() {
        document.querySelectorAll(`#${BULK_IDS.body} tr`).forEach((row) => {
            [".bulk-b-count", ".bulk-l-count", ".bulk-d-count"].forEach((sel) => {
                const input = row.querySelector(sel);
                if (input && !input.readOnly) input.value = 0;
            });
        });
    }

    function saveVisitByData(rawData, callbacks = {}) {
        const date = rawData.date;
        const breakfast = Number(rawData.breakfast) || 0;
        const lunch = Number(rawData.lunch) || 0;
        const dinner = Number(rawData.dinner) || 0;
        const reason = getBulkReason(rawData.reason);

        if (isNextWeekDeadlinePassed(date)) {
            if (callbacks.onError) callbacks.onError(`${date}: 차주 마감 기한 경과`);
            return;
        }

        const expiredList = getExpiredMeals(date, { breakfast, lunch, dinner });
        if (expiredList.length === 3) {
            if (callbacks.onError) callbacks.onError(`${date}: 당일 전 식수 마감`);
            return;
        }

        const actualType = getActualType();

        getData(`/holidays?year=${date.substring(0, 4)}`, (holidays) => {
            if ((holidays || []).some(h => h.date === date)) {
                if (callbacks.onError) callbacks.onError(`${date}: 공휴일 지정일`);
                return;
            }

            const visitData = { 
                applicant_id: sessionStorage.getItem("id"), 
                applicant_name: sessionStorage.getItem("name"), 
                date, reason, type: actualType, 
                breakfast: expiredList.includes("breakfast") ? 0 : breakfast,
                lunch: expiredList.includes("lunch") ? 0 : lunch,
                dinner: expiredList.includes("dinner") ? 0 : dinner,
                requested_by_admin: false 
            };

            postData("/visitors", visitData, 
                () => { if (callbacks.onSuccess) callbacks.onSuccess(date); }, 
                () => { if (callbacks.onError) callbacks.onError(date); }
            );
        });
    }

    function submitBulkVisit() {
        const targets = collectBulkRows();
        if (targets.length === 0) return alert("💡 일괄 저장할 내역이 존재하지 않습니다.");
        if (!confirm("입력하신 주간 식수 인원을 일괄 저장하시겠습니까?")) return;

        const successList = [], failList = [];
        const run = (index) => {
            if (index >= targets.length) {
                loadWeeklyVisitData();
                clearBulkRows();
                renderBulkVisitRows();
                alert(`🎉 주간 일괄 저장 처리가 완료되었습니다.\n[성공: ${successList.length}건 / 실패: ${failList.length}건]`);
                return;
            }
            saveVisitByData(targets[index], {
                onSuccess: (date) => { successList.push(date); run(index + 1); },
                onError: (date) => { failList.push(date); run(index + 1); }
            });
        };
        run(0);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById(BULK_IDS.toggle)?.addEventListener("click", toggleBulkVisit);
        document.addEventListener("click", (event) => {
            if (event.target.closest(`#${BULK_IDS.save}`)) submitBulkVisit();
        });
    });

    window.renderBulkVisitRows = renderBulkVisitRows;
})();

/**
 * ============================================================================
 * [7. 식수 변경 로그 및 이력 관리]
 * ============================================================================
 */
function loadDeptVisitorLogs() {
    const user = JSON.parse(sessionStorage.getItem("currentUser") || "null");
    const container = document.getElementById("dept-log-body");
    const startInput = document.getElementById("logStartDate");
    const endInput = document.getElementById("logEndDate");
    const nameInput = document.getElementById("logName");

    if (!user || !startInput || !endInput || !container) return;
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

/**
 * ============================================================================
 * [8. 신청 내역 일괄 편집 서브모듈]
 * ============================================================================
 */
function toggleHistoryBulkEdit() {
    const tbody = document.getElementById("visit-summary-body");
    const saveBtn = document.getElementById("history-bulk-save-btn");
    const editBtn = document.getElementById("history-bulk-edit-btn");
    if (!tbody || !editBtn) return;

    const rows = tbody.querySelectorAll("tr:not(.empty-row-text):not(.expired-row)");
    if (rows.length === 0) return alert("수정 가능한 내역이 없습니다.");
    
    const isEditing = editBtn.innerText.includes("취소");

    if (!isEditing) {
        rows.forEach(row => renderRowToEditMode(row));
        editBtn.innerText = "❌ 편집 취소";
        editBtn.style.backgroundColor = "#ef4444";
        if (saveBtn) saveBtn.classList.remove("ui-hidden");
    } else {
        loadWeeklyVisitData();
        editBtn.innerText = "✏️ 일괄 편집";
        editBtn.style.backgroundColor = "#6366f1";
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
    
    // 💡 [의도 반영]: 내역 하단 '일괄 편집' 컴포넌트 활성화 시에도 일반 협력사는 사유창 잠금 설정
    if (tr.querySelector(".r-cell")) {
        const userType = sessionStorage.getItem("type") || "방문자";
        const currentDept = sessionStorage.getItem("dept");
        const isException = (currentDept === "신명전력");
        
        if (userType === "협력사" && !isException) {
            tr.querySelector(".r-cell").innerHTML = `<input type="text" class="edit-r" value="협력사 신청" data-prev="${r}" readonly style="background-color: #f3f4f6; color: #6b7280; cursor: not-allowed;">`;
        } else {
            tr.querySelector(".r-cell").innerHTML = `<input type="text" class="edit-r" value="${r}" data-prev="${r}">`;
        }
    }

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

        const bNew = Number(bInput.value), lNew = Number(lInput.value), dNew = Number(dInput.value);
        
        const userType = sessionStorage.getItem("type") || "방문자";
        const currentDept = sessionStorage.getItem("dept");
        const isException = (currentDept === "신명전력");
        
        // 💡 [의도 반영]: 히스토리 다중 트랜잭션 업데이트 수집 시에도 일반 협력사는 강제로 정제작업 수행
        let rNew = rInput?.value.trim() || "협력사 신청";
        if (userType === "협력사" && !isException) {
            rNew = "협력사 신청";
        }

        const bPrev = Number(bInput.dataset.prev), lPrev = Number(lInput.dataset.prev), dPrev = Number(dInput.dataset.prev);
        const rPrev = (rInput?.dataset.prev || "").trim();

        if ((bNew !== bPrev) || (lNew !== lPrev) || (dNew !== dPrev) || (rNew !== rPrev)) {
            updateData.push({ 
                id: row.getAttribute("data-id"), 
                date: row.querySelector(".date-cell").innerText, 
                breakfast: bNew, lunch: lNew, dinner: dNew, reason: rNew 
            });
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
        putData(`/visitors/${item.id}`, item, () => { 
            successCount++; 
            runUpdate(index + 1); 
        }, () => { 
            runUpdate(index + 1); 
        });
    };
    runUpdate(0);
}