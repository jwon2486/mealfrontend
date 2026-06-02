/**
 * 에스엔시스 식수 신청 시스템 Script (Bug-Fixed & Server-Time Synchronized Version)
 */

// ============================================================================
// 1. 전역 상태 및 DOM 캐싱 (상단에 모아서 관리)
// ============================================================================
let holidayList = [];
let holidayMap = {};
let flag_type = "직영";
let isSelfcheckLate = false;
let isBlockedWeek = false;
let isAllSelected = false;

window.mealCreatedAtMap = window.mealCreatedAtMap || {};
window.selfcheckCreatedAtMap = window.selfcheckCreatedAtMap || {};
window.serverDeadlines = null; // 백엔드 동적 마감시간 저장용 전역 객체

// 자주 찾는 DOM 요소를 캐싱할 객체 (매번 getElementById 호출 방지)
const DOM = {};
document.addEventListener("DOMContentLoaded", () => {
    DOM.userId = document.getElementById("userId");
    DOM.userName = document.getElementById("userName");
    DOM.loginWrapper = document.getElementById("login-wrapper");
    DOM.mainArea = document.getElementById("mainArea");
    DOM.topUserText = document.getElementById("topUserText");
    DOM.rememberMe = document.getElementById("rememberMe");
    DOM.adminBtn = document.getElementById("adminBtn");
    DOM.teamEditBtn = document.getElementById("teamEditButton");
    DOM.deadlineInfo = document.getElementById("deadline-info");
    DOM.datePickerContainer = document.getElementById("date-picker-container");
    DOM.mealContainer = document.getElementById("meal-container");
    DOM.weekPicker = document.getElementById("weekPicker");
    DOM.welcome = document.getElementById("welcome");
    DOM.weekRangeText = document.getElementById("weekRangeText");
    DOM.mealSummary = document.getElementById("mealSummary");
    DOM.mealBody = document.getElementById("meal-body");
    DOM.toast = document.getElementById("toast");
    DOM.toggleSelectBtn = document.getElementById("toggleSelectBtn");
    DOM.selfCheck = document.getElementById("selfCheck");
});

// ============================================================================
// 2. 날짜 및 시간 유틸리티 (중복 로직 통합 및 고도화)
// ============================================================================
const pad2 = n => String(n).padStart(2, '0');
const fmtKST = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const ymdKST = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function mondayOf(d) {
    const c = new Date(d);
    const idx = (c.getDay() + 6) % 7;
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - idx);
    return c;
}

function isThisWeek(dateStr) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const target = new Date(dateStr);
    const mon = mondayOf(now);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return target >= mon && target <= sun;
}

function isSameWeekAsNow(dateStr) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    return dateStr === ymdKST(mondayOf(now));
}

function lastWeekWednesdayCutoff() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mon = mondayOf(now);
    const lastWed = new Date(mon);
    lastWed.setDate(mon.getDate() - 5);
    lastWed.setHours(16, 0, 0, 0);
    return lastWed;
}

function isTwoWeeksLaterOrMore(dateStr) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mon = mondayOf(now);
    const targetWeek = new Date(mon);
    targetWeek.setDate(mon.getDate() + 14);
    return new Date(dateStr) >= targetWeek;
}

// 서버 동적 마감 데이터 Fetch 함수
function loadDeadlineSettingsFromServer(callback) {
    getData("/admin/api/deadlines", (data) => {
        window.serverDeadlines = data;
        if (callback) callback();
    }, () => {
        console.error("❌ 마감 설정 연동 실패. 비상용 기본값으로 구동합니다.");
        window.serverDeadlines = {
            breakfast_days_before: "1", breakfast_time: "09:00",
            lunch_days_before: "0", lunch_time: "10:30",
            dinner_days_before: "0", dinner_time: "14:30",
            next_week_day_of_week: "3", next_week_time: "16:00"
        };
        if (callback) callback();
    });
}

function isNextWeekGloballyClosed(dateStr) {
    return isDeadlinePassed(dateStr, "중식");
}

function makeCreatedAt() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    return fmtKST(now);
}

function getCurrentWeekDates() {
    const selectedDateStr = DOM.weekPicker.value;
    const monday = mondayOf(new Date(selectedDateStr));
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push(ymdKST(date));
    }
    return dates;
}

function setDefaultWeek() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    DOM.weekPicker.value = ymdKST(mondayOf(now));
}


// ============================================================================
// 3. UI 및 시각 효과 제어
// ============================================================================
function setDisplayClass(el, displayType) {
    if (!el) return;
    el.classList.remove("ui-hidden", "ui-block", "ui-inline-block", "ui-flex", "ui-inline-flex");
    if (displayType === "none") el.classList.add("ui-hidden");
    else el.classList.add(`ui-${displayType}`);
}

function showBlock(el) { setDisplayClass(el, "block"); }
function showInlineBlock(el) { setDisplayClass(el, "inline-block"); }
function showFlex(el) { setDisplayClass(el, "flex"); }
function hideElement(el) { setDisplayClass(el, "none"); }

function setMealButtonVisualState(btn, state) {
    if (!btn) return;
    btn.classList.remove("state-unselected", "state-selected", "state-deadline", "state-blocked", "state-holiday");
    btn.classList.add(`state-${state}`);
}

function setHolidayVisualState(...elements) {
    elements.forEach(el => { if (el) el.classList.add("is-holiday"); });
}

function setMealButtonContent(btn, state) {
    if (!btn) return;
    const labels = { unselected: "미신청", selected: "✔ 신청", deadline: "❌ 마감", blocked: "⛔차단", holiday: "공휴일" };
    btn.textContent = labels[state] || state;
}

function updateToggleSelectButtonLabel() {
    if (DOM.toggleSelectBtn) {
        DOM.toggleSelectBtn.textContent = isAllSelected ? "☑ 전체 선택 해제" : "☐ 전체 선택";
    }
}

function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add("show");
    setTimeout(() => {
        DOM.toast.textContent = "";
        DOM.toast.classList.remove("show");
    }, 2500);
}


// ============================================================================
// 4. 핵심 로직 (로그인, 마감 계산, 테이블 렌더링)
// ============================================================================
function login(event) {
    if (event) event.preventDefault();
    
    // 💡 [버그 수정] DOM 원소 캐싱 보호 및 부드러운 예외 처리
    if (!DOM.userId || !DOM.userName) return;

    const userId = DOM.userId.value.trim();
    const userName = DOM.userName.value.trim();

    if (!userId || !userName) {
        alert("사번과 이름을 입력해주세요.");
        return;
    }

    if (userId === "admin" && userName === "admin") {
        window.location.href = "admin_dashboard.html";
        return;
    }

    const url = `/login_check?id=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}`;
    getData(url, (data) => {
        if (!data.valid) {
            alert("❌ 등록되지 않은 사용자입니다.");
            return;
        }

        window.currentUser = { ...data, userId: data.id, userName: data.name };
        sessionStorage.setItem("flagType", data.type);
        sessionStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        flag_type = data.type;

        DOM.topUserText.textContent = `${data.name}님`;

        if (DOM.rememberMe.checked) {
            localStorage.setItem("savedUserId", userId);
            localStorage.setItem("savedUserName", userName);
        } else {
            localStorage.removeItem("savedUserId");
            localStorage.removeItem("savedUserName");
        }
        
        showBlock(DOM.deadlineInfo);
        hideElement(DOM.adminBtn);
        hideElement(DOM.teamEditBtn);

        if (window.currentUser.level === 3) showInlineBlock(DOM.adminBtn);
        if (window.currentUser.level === 2) showInlineBlock(DOM.teamEditBtn);

        if (data.type === "협력사" || data.type === "방문자") {
            window.location.href = "visitor_request.html";
            return;
        }

        loadDeadlineSettingsFromServer(() => {
            hideElement(DOM.loginWrapper);
            showBlock(DOM.mainArea);
            showBlock(DOM.datePickerContainer);
            showBlock(DOM.mealContainer);
            showInlineBlock(DOM.weekPicker);
            showBlock(DOM.welcome);
            showBlock(DOM.weekRangeText);
            showBlock(DOM.mealSummary);
            
            DOM.welcome.innerText = `${data.name}님 (${data.dept}), 안녕하세요.`;

            setDefaultWeek();
            loadWeekData();
            if (typeof initMenuBoard === "function") initMenuBoard();
        });
    }, () => alert("❌ 로그인 실패: 올바른 정보를 입력해주세요!"));
}

function logout() {
    sessionStorage.clear();
    window.currentUser = null;

    hideElement(DOM.mainArea);
    showFlex(DOM.loginWrapper);

    DOM.mealBody.innerHTML = "";
    DOM.weekPicker.value = "";
    DOM.welcome.innerText = "";
    DOM.mealSummary.innerText = "";
    DOM.topUserText.textContent = "로그인 필요";

    hideElement(DOM.adminBtn);
    hideElement(DOM.teamEditBtn);

    showToast("로그아웃 되었습니다.");
}

function isDeadlinePassed(dateStr, mealType) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    if (isTwoWeeksLaterOrMore(dateStr)) return false;
    if (!window.serverDeadlines) return true; 

    const mealDate = new Date(dateStr);
    mealDate.setHours(0, 0, 0, 0);

    // --- [1] 금주 당일 식사 마감 통제 분기 ---
    if (isThisWeek(dateStr)) {
        if (window.currentUser?.region === "에코센터") {
            const thisMondayStr = ymdKST(mondayOf(mealDate));
            const createdAtStr = window.selfcheckCreatedAtMap[thisMondayStr];
            if (!createdAtStr) return true;
            
            const checkTime = new Date(createdAtStr.replace(' ', 'T') + '+09:00');
            if (checkTime > lastWeekWednesdayCutoff()) {
                isSelfcheckLate = true;
                return true;
            }
        }
        
        const prefix = mealType === "조식" ? "breakfast" : mealType === "중식" ? "lunch" : "dinner";
        const daysBefore = parseInt(window.serverDeadlines[`${prefix}_days_before`] || 0, 10);
        const timeStr = window.serverDeadlines[`${prefix}_time`] || "00:00";
        const [hour, minute] = timeStr.split(":").map(Number);
        
        const deadline = new Date(mealDate);
        deadline.setDate(deadline.getDate() - daysBefore);
        deadline.setHours(hour, minute, 0, 0);
        
        return now > deadline;
    }

    // --- [2] 차주 일괄 신청 마감 통제 분기 ---
    const thisMon = mondayOf(now);
    const nextMon = new Date(thisMon);
    nextMon.setDate(nextMon.getDate() + 7);
    
    if (dateStr === ymdKST(nextMon) || new Date(dateStr) >= nextMon) {
        if (window.currentUser?.region !== "에코센터") {
            return false;
        }
        
        const targetDayIndex = parseInt(window.serverDeadlines["next_week_day_of_week"] || 3, 10);
        const targetTimeStr = window.serverDeadlines["next_week_time"] || "16:00";
        const [h, m] = targetTimeStr.split(":").map(Number);
        
        const nextWeekDeadline = new Date(thisMon);
        nextWeekDeadline.setDate(thisMon.getDate() + (targetDayIndex - 1));
        nextWeekDeadline.setHours(h, m, 0, 0);
        
        return now > nextWeekDeadline;
    }

    return false;
}

function toggleMeal(btn) {
    if (btn.classList.contains("selected")) {
        btn.classList.remove("selected");
        setMealButtonContent(btn, "unselected");
        setMealButtonVisualState(btn, "unselected");
    } else {
        btn.classList.add("selected");
        setMealButtonContent(btn, "selected");
        setMealButtonVisualState(btn, "selected");
    }
    updateMealSummary();
}

function toggleSelectAll() {
    if (isBlockedWeek) {
        alert("전주 본인확인 미체크로 인해 식사 신청 및 변경이 불가능합니다.");
        return;
    }

    let changed = false;
    document.querySelectorAll(".meal-btn").forEach(btn => {
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        if (isDeadlinePassed(date, type)) return;
        if (holidayList.includes(normalizeDate(date))) return;

        const shouldSelect = !isAllSelected;
        const isSelected = btn.classList.contains("selected");

        if (shouldSelect !== isSelected) {
            toggleMeal(btn);
            changed = true;
        }
    });

    if (changed) {
        isAllSelected = !isAllSelected;
        updateToggleSelectButtonLabel();
    }
}

function updateMealSummary() {
    let breakfastCount = 0, lunchCount = 0, dinnerCount = 0;
    document.querySelectorAll(".meal-btn.selected").forEach(btn => {
        const type = btn.dataset.type;
        if (type === "조식") breakfastCount++;
        else if (type === "중식") lunchCount++;
        else if (type === "석식") dinnerCount++;
    });
    const total = breakfastCount + lunchCount + dinnerCount;
    if (DOM.mealSummary) {
        DOM.mealSummary.innerText = `총 식수 ${total} (조식 ${breakfastCount}, 중식 ${lunchCount}, 석식 ${dinnerCount})`;
    }
}

// ============================================================================
// 5. 데이터 Fetch 및 저장
// ============================================================================
function loadWeekData() {
    if (!window.currentUser) return;
    const userId = window.currentUser.userId;
    const dates = getCurrentWeekDates();
    const start = dates[0];
    const end = dates[dates.length - 1];
    window.currentWeekStartDate = start;

    checkPreviousWeek(userId, start, () => {
        loadSelfCheck(userId, start, () => {
            if (DOM.welcome) {
                DOM.welcome.innerHTML = `${window.currentUser.userName}님, 안녕하세요. (기간: ${start} ~ ${end})`;
            }
            renderMealTable(dates);
            
            getData(`/meals?user_id=${userId}&start=${start}&end=${end}`, (data) => {
                if (!isBlockedWeek) {
                    dates.forEach(date => {
                        const dayData = data[date];
                        if (!dayData) return;
                        ["조식", "중식", "석식"].forEach(type => {
                            const key = type === "조식" ? "breakfast" : type === "중식" ? "lunch" : "dinner";
                            if (dayData[key]) {
                                const btn = document.querySelector(`.meal-btn[data-date="${date}"][data-type="${type}"]`);
                                if (btn && !btn.classList.contains("selected")) toggleMeal(btn);
                            }
                        });
                    });
                }
                updateMealSummary();
            });
        });
    });
}

function renderMealTable(dates) {
    if (!DOM.mealBody) return;
    DOM.mealBody.innerHTML = "";
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    dates.forEach(dateStr => {
        const date = new Date(dateStr);
        const weekday = weekdays[date.getDay()];
        const isHoliday = holidayList.includes(normalizeDate(dateStr));
        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        dateCell.className = "date";
        dateCell.innerText = dateStr;

        if (isHoliday) {
            setHolidayVisualState(dateCell);
            const key = normalizeDate(dateStr);
            const desc = holidayMap[key] || "";
            const sub = document.createElement("div");
            sub.className = "holiday-desc";
            sub.innerText = desc ? `(${desc})` : "(공휴일)";
            dateCell.appendChild(sub);
        }

        const dayCell = document.createElement("td");
        dayCell.className = "day";
        dayCell.innerText = weekday;
        if (isHoliday) setHolidayVisualState(dayCell);

        row.appendChild(dateCell);
        row.appendChild(dayCell);

        ["조식", "중식", "석식"].forEach(type => {
            const cell = document.createElement("td");
            const btn = document.createElement("button");
            btn.className = "meal-btn state-unselected";
            btn.dataset.date = dateStr;
            btn.dataset.type = type;

            if (isBlockedWeek) {
                btn.disabled = true;
                setMealButtonContent(btn, "blocked");
                setMealButtonVisualState(btn, "blocked");
                btn.title = "앞 주 신청 및 본인 확인이 없어 차단됨";
            } else if (isHoliday) {
                setMealButtonVisualState(btn, "holiday");
                setMealButtonContent(btn, "holiday");
                btn.onclick = () => alert("⛔ 공휴일에는 식수 신청이 불가능합니다.");
                setHolidayVisualState(cell);
            } else if (isDeadlinePassed(dateStr, type)) {
                setMealButtonVisualState(btn, "deadline");
                setMealButtonContent(btn, "deadline");
                btn.onclick = () => {
                    if (isSelfcheckLate) alert("마감시간 이후 본인확인체크하여 변경이 불가능합니다.");
                    else alert(`${type}은 신청 마감 시간이 지났습니다.`);
                };
            } else {
                setMealButtonContent(btn, "unselected");
                btn.onclick = () => toggleMeal(btn);
            }
            cell.appendChild(btn);
            row.appendChild(cell);
        });
        DOM.mealBody.appendChild(row);
    });
}

function checkPreviousWeek(userId, currentWeekStart, callback) {
    const lastMon = new Date(currentWeekStart);
    lastMon.setDate(lastMon.getDate() - 7);
    const lastStartStr = ymdKST(lastMon);
    const lastEndStr = ymdKST(new Date(lastMon.setDate(lastMon.getDate() + 4)));

    const prevMon = new Date(currentWeekStart);
    prevMon.setDate(prevMon.getDate() - 14);
    const prevStartStr = ymdKST(prevMon);
    const prevEndStr = ymdKST(new Date(prevMon.setDate(prevMon.getDate() + 4)));

    Promise.all([
        new Promise(r => getData(`/meals?user_id=${userId}&start=${lastStartStr}&end=${lastEndStr}`, r)),
        new Promise(r => getData(`/meals?user_id=${userId}&start=${prevStartStr}&end=${prevEndStr}`, r)),
        new Promise(r => getData(`/selfcheck?user_id=${userId}&date=${lastStartStr}`, r)),
        new Promise(r => getData(`/selfcheck?user_id=${userId}&date=${prevStartStr}`, r))
    ]).then(([lastWeekMeals, prevWeekMeals, lastWeekCheck, prevWeekCheck]) => {
        const hasMeal = [lastWeekMeals, prevWeekMeals].some(weekData =>
            Object.values(weekData).some(day => day.breakfast || day.lunch || day.dinner)
        );
        const isChecked = lastWeekCheck.checked === 1 || prevWeekCheck.checked === 1;
        
        isBlockedWeek = (window.currentUser.region === "에코센터") ? (!hasMeal && !isChecked) : false;
        if (callback) callback();
    });
}

function loadSelfCheck(userId, date, callback) {
    if (!DOM.selfCheck) {
        if (callback) callback();
        return;
    }
    
    getData(`/selfcheck?user_id=${userId}&date=${date}`, (data) => {
        if (data && data.created_at) {
            window.selfcheckCreatedAtMap[date] = data.created_at;
            sessionStorage.setItem("selfcheckCreatedAtMap", JSON.stringify(window.selfcheckCreatedAtMap));
        }
        DOM.selfCheck.checked = data.checked === 1;
        
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 4);
        
        const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
        DOM.selfCheck.disabled = !isThisWeek(date) && now > weekEnd;
        
        if (callback) callback();
    }, () => {
        if (callback) callback();
    });
}

function saveMeals() {
    const checkedValue = (DOM.selfCheck && DOM.selfCheck.checked) ? 1 : 0;
    const hasMealSelected = document.querySelectorAll(".meal-btn.selected").length > 0;
    const weekStartStr = window.currentWeekStartDate;

    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const thisMondayStr = ymdKST(mondayOf(now));
    const isModifyingNextWeek = weekStartStr > thisMondayStr;

    if (isModifyingNextWeek && !isTwoWeeksLaterOrMore(weekStartStr) && isNextWeekGloballyClosed(weekStartStr)) {
        alert("차주 식수 신청 마감시간이 지났기 때문에 변경이 불가능합니다.");
        return;
    }

    if (hasMealSelected && checkedValue === 0) {
        alert("본인확인을 체크해주세요!");
        return;
    }

    const __createdAt = isSameWeekAsNow(weekStartStr) ? null : makeCreatedAt();

    postData("/selfcheck", {
        user_id: window.currentUser.userId,
        date: weekStartStr,
        checked: checkedValue,
        ...(__createdAt && { created_at: __createdAt })
    }, () => {
        const meals = getCurrentWeekDates().map(date => {
            const mealData = {
                user_id: window.currentUser.userId,
                name: window.currentUser.userName,
                dept: window.currentUser.dept,
                date,
                breakfast: 0,
                lunch: 0,
                dinner: 0,
                ...(__createdAt && { created_at: __createdAt })
            };
            
            document.querySelectorAll(`.meal-btn[data-date="${date}"]`).forEach(btn => {
                if (btn.classList.contains("selected")) {
                    const t = btn.dataset.type;
                    if (t === "조식") mealData.breakfast = 1;
                    if (t === "중식") mealData.lunch = 1;
                    if (t === "석식") mealData.dinner = 1;
                }
            });
            return mealData;
        });

        postData("/meals", { meals }, () => {
            showToast("✅ 저장 완료");
            alert("✅ 저장되었습니다.");
            loadWeekData();
        }, (err) => showToast("❌ 저장 실패: " + err.message));
    });
}

// ============================================================================
// 6. 초기화 및 이벤트 바인딩
// ============================================================================
window.login = login;
window.logout = logout;
window.saveMeals = saveMeals;
window.loadWeekData = loadWeekData;
window.toggleSelectAll = toggleSelectAll;
window.goToAdminDashboard = () => { window.location.href = "admin_dashboard.html"; };
window.goToVisitor = () => location.href = "visitor_request.html";
window.goToTeamEdit = () => location.href = "team_edit.html";

const COLOR_BLIND_STORAGE_KEY = "snsysColorBlindMode";
function applyColorBlindMode(mode) {
    document.body.classList.remove("cb-protan", "cb-deutan", "cb-tritan", "cb-protan-deutan", "cb-tritan-deutan", "cb-highcontrast");
    if (mode !== "normal") document.body.classList.add(`cb-${mode}`);
    localStorage.setItem(COLOR_BLIND_STORAGE_KEY, mode);
}

document.addEventListener("DOMContentLoaded", () => {
    // 💡 [구조 개선] util.js에 내장된 공통 시간 동기화 완료 후 초기 바인딩 전개
    if (typeof syncServerTime === "function") {
        syncServerTime(() => {
            initializeApplication();
        });
    } else {
        initializeApplication();
    }
});

/**
 * 💡 어플리케이션 순차 초기화 코어
 */
function initializeApplication() {
    const savedTheme = localStorage.getItem(COLOR_BLIND_STORAGE_KEY) || "normal";
    applyColorBlindMode(savedTheme);
    const s1 = document.getElementById("colorBlindMode");
    const s2 = document.getElementById("sidebarColorBlindMode");
    [s1, s2].forEach(selectEl => { 
        if (selectEl) {
            selectEl.value = savedTheme;
            selectEl.addEventListener("change", e => applyColorBlindMode(e.target.value));
        }
    });

    const savedSelfcheckMap = sessionStorage.getItem("selfcheckCreatedAtMap");
    if (savedSelfcheckMap) window.selfcheckCreatedAtMap = JSON.parse(savedSelfcheckMap);
    
    setDefaultWeek();
    updateToggleSelectButtonLabel();
    
    const savedId = localStorage.getItem("savedUserId");
    const savedName = localStorage.getItem("savedUserName");
    
    // 💡 [버그 수정] DOM 객체 자체를 문자열로 덮어쓰던 치명적 결함(DOM.userName = savedName) 해결!
    if (savedId && savedName) {
        if (DOM.userId) DOM.userId.value = savedId;
        if (DOM.userName) DOM.userName.value = savedName;
        if (DOM.rememberMe) DOM.rememberMe.checked = true;
    }

    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        if (DOM.topUserText) DOM.topUserText.textContent = `${window.currentUser.userName}님`;
        if (window.currentUser.level === 3) showInlineBlock(DOM.adminBtn);
        if (window.currentUser.level === 2) showInlineBlock(DOM.teamEditBtn);
    }

    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const year = now.getFullYear();
    
    fetchHolidayList(`/api/public-holidays?year=${year}`, (h1) => {
        fetchHolidayList(`/api/public-holidays?year=${year + 1}`, (h2) => {
            const merged = [].concat(h1 || []).concat(h2 || []);
            holidayList = merged.map(h => normalizeDate(h.date || h));
            merged.forEach(h => { holidayMap[normalizeDate(h.date || h)] = h.description || h.name || ""; });
            
            if (savedUser) { 
                loadDeadlineSettingsFromServer(() => {
                    hideElement(DOM.loginWrapper);
                    showBlock(DOM.mainArea);
                    loadWeekData();
                    if (typeof initMenuBoard === "function") initMenuBoard();
                });
            }
        });
    });

    if (DOM.weekPicker) {
        DOM.weekPicker.addEventListener("change", loadWeekData);
    }
}