// ✅ 수정 사항: toggleSelectAll 함수에 isBlockedWeek 체크 로직 추가
// ✅ 수정 사항: 전주 본인확인 미체크 시 전체 선택 기능 차단

let holidayList = [];
let holidayMap = {};
let flag_type = "직영";
let isSelfcheckLate = false;
let isBlockedWeek = false; // 전역 변수 초기화
window.mealCreatedAtMap = window.mealCreatedAtMap || {};
window.selfcheckCreatedAtMap = window.selfcheckCreatedAtMap || {};

function setDisplayClass(el, displayType) {
  if (!el) return;
  el.classList.remove("ui-hidden", "ui-block", "ui-inline-block", "ui-flex", "ui-inline-flex");
  if (displayType === "none") el.classList.add("ui-hidden");
  else if (displayType === "block") el.classList.add("ui-block");
  else if (displayType == "inline-block") el.classList.add("ui-inline-block");
  else if (displayType === "flex") el.classList.add("ui-flex");
  else if (displayType === "inline-flex") el.classList.add("ui-inline-flex");
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
  elements.forEach((el) => { if (el) el.classList.add("is-holiday"); });
}

function getMealButtonLabel(state) {
  const labels = { unselected: "미신청", selected: "✔ 신청", deadline: "❌ 마감", blocked: "⛔차단", holiday: "공휴일" };
  return labels[state] || state;
}

function setMealButtonContent(btn, state) {
  if (!btn) return;
  btn.textContent = getMealButtonLabel(state);
}

function updateToggleSelectButtonLabel() {
  const toggleBtn = document.getElementById("toggleSelectBtn");
  if (!toggleBtn) return;
  toggleBtn.textContent = isAllSelected ? "☑ 전체 선택 해제" : "☐ 전체 선택";
}

function login(event) {
    if (event) event.preventDefault();
    const userId = document.getElementById("userId").value.trim();
    const userName = document.getElementById("userName").value.trim();

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

        window.currentUser = {
            userId: data.id,
            userName: data.name,
            dept: data.dept,
            rank: data.rank,
            type: data.type,
            level: data.level,
            region: data.region
        };
        if (data && data.created_at) window.currentUser.created_at = data.created_at;

        sessionStorage.setItem("flagType", data.type);
        flag_type = sessionStorage.getItem("flagType");
        sessionStorage.setItem("currentUser", JSON.stringify(window.currentUser));

        const topUserText = document.getElementById("topUserText");
        if (topUserText) topUserText.textContent = `${data.name}님`;

        if (document.getElementById("rememberMe").checked) {
            localStorage.setItem("savedUserId", userId);
            localStorage.setItem("savedUserName", userName);
        } else {
            localStorage.removeItem("savedUserId");
            localStorage.removeItem("savedUserName");
        }
        
        showBlock(document.getElementById("deadline-info"));
        const adminBtn = document.getElementById("adminBtn");
        const teamEditBtn = document.getElementById("teamEditButton");
        if (adminBtn) hideElement(adminBtn);
        if (teamEditBtn) hideElement(teamEditBtn);

        if (window.currentUser.level === 3 && adminBtn) showInlineBlock(adminBtn);
        if (window.currentUser.level === 2 && teamEditBtn) showInlineBlock(teamEditBtn);

        if (data.type === "협력사" || data.type === "방문자") {
            window.location.href = "visitor_request.html";
            return;
        }

        hideElement(document.getElementById("login-wrapper"));
        showBlock(document.getElementById("mainArea"));
        showBlock(document.getElementById("date-picker-container"));
        showBlock(document.getElementById("meal-container"));
        showInlineBlock(document.getElementById("weekPicker"));
        showBlock(document.getElementById("welcome"));
        showBlock(document.getElementById("weekRangeText"));
        showBlock(document.getElementById("mealSummary"));
        document.getElementById("welcome").innerText = `${data.name}님 (${data.dept}), 안녕하세요.`;

        setDefaultWeek();
        loadWeekData();
        if (typeof initMenuBoard === "function") initMenuBoard();
    }, (err) => {
        alert("❌ 로그인 실패: 올바른 정보를 입력해주세요!");
    });
}

let isAllSelected = false;

// ✅ 버그 수정된 전체 선택 함수
function toggleSelectAll() {
    // 1. 차단된 주간인 경우 동작 방지 [수정]
    if (isBlockedWeek) {
        alert("전주 본인확인 미체크로 인해 식사 신청 및 변경이 불가능합니다.");
        return;
    }

    const btnList = document.querySelectorAll(".meal-btn");
    let changed = false;

    btnList.forEach(btn => {
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        // ① 마감된 식사 제외
        if (isDeadlinePassed(date, type)) return;
        // ② 공휴일 제외
        if (holidayList.includes(normalizeDate(date))) return;

        const shouldSelect = !isAllSelected;
        const selected = btn.classList.contains("selected");

        if (shouldSelect && !selected) {
            toggleMeal(btn);
            changed = true;
        } else if (!shouldSelect && selected) {
            toggleMeal(btn);
            changed = true;
        }
    });

    if (changed) {
        isAllSelected = !isAllSelected;
        updateToggleSelectButtonLabel();
    }
}

function logout() {
  sessionStorage.removeItem("currentUser");
  sessionStorage.removeItem("flagType");
  sessionStorage.removeItem("selfcheckCreatedAtMap");
  window.currentUser = null;

  const mainArea = document.getElementById("mainArea");
  const loginWrapper = document.getElementById("login-wrapper");
  if (mainArea) hideElement(mainArea);
  if (loginWrapper) showFlex(loginWrapper);

  document.getElementById("meal-body").innerHTML = "";
  document.getElementById("weekPicker").value = "";
  document.getElementById("welcome").innerText = "";
  document.getElementById("mealSummary").innerText = "";
  document.getElementById("topUserText").textContent = "로그인 필요";

  const adminBtn = document.getElementById("adminBtn");
  if (adminBtn) hideElement(adminBtn);
  const teamEditButton = document.getElementById("teamEditButton");
  if (teamEditButton) hideElement(teamEditButton);

  if (typeof showToast === "function") showToast("로그아웃 되었습니다.");
}

function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>{
    toast.textContent = "";
    toast.classList.remove("show");
  }, 2500);
}

function getCurrentWeekDates() {
    const selected = document.getElementById("weekPicker").value;
    const selectedDate = new Date(selected);
    const dayOfWeek = selectedDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? +1 : 1 - dayOfWeek;
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() + diffToMonday);

    const dates = [];
    for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
}

function renderMealTable(dates) {
    const tableBody = document.getElementById("meal-body");
    tableBody.innerHTML = "";
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
            const desc = (holidayMap && holidayMap[key]) ? holidayMap[key] : "";
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
            const btn = document.createElement("button");
            btn.className = "meal-btn state-unselected";
            btn.dataset.date = dateStr;
            btn.dataset.type = type;
            const cell = document.createElement("td");

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
        tableBody.appendChild(row);
    });
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

function loadWeekData() {
    if (!window.currentUser) return;
    const userId = window.currentUser.userId;
    const dates = getCurrentWeekDates();
    const start = dates[0];
    const end = dates[dates.length - 1];
    window.currentWeekStartDate = start;

    checkPreviousWeek(userId, start, () => {
        loadSelfCheck(userId, start, () => {
            document.getElementById("welcome").innerHTML = `${window.currentUser.userName}님, 안녕하세요. (기간: ${start} ~ ${end})`;
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

function checkPreviousWeek(userId, currentWeekStart, callback) {
    const lastMon = new Date(currentWeekStart); lastMon.setDate(lastMon.getDate() - 7);
    const lastStart = lastMon.toISOString().split("T")[0];
    const lastEnd = new Date(lastMon); lastEnd.setDate(lastMon.getDate() + 4);
    const lastEndStr = lastEnd.toISOString().split("T")[0];

    const prevMon = new Date(currentWeekStart); prevMon.setDate(prevMon.getDate() - 14);
    const prevStart = prevMon.toISOString().split("T")[0];
    const prevEnd = new Date(prevMon); prevEnd.setDate(prevMon.getDate() + 4);
    const prevEndStr = prevEnd.toISOString().split("T")[0];

    Promise.all([
        new Promise(r => getData(`/meals?user_id=${userId}&start=${lastStart}&end=${lastEndStr}`, r)),
        new Promise(r => getData(`/meals?user_id=${userId}&start=${prevStart}&end=${prevEndStr}`, r)),
        new Promise(r => getData(`/selfcheck?user_id=${userId}&date=${lastStart}`, r)),
        new Promise(r => getData(`/selfcheck?user_id=${userId}&date=${prevStart}`, r))
    ]).then(([m1, m2, c1, c2]) => {
        const hasMeal = [m1, m2].some(m => Object.values(m).some(d => d.breakfast || d.lunch || d.dinner));
        const isChecked = c1.checked === 1 || c2.checked === 1;
        isBlockedWeek = (window.currentUser.region === "에코센터") ? (!hasMeal && !isChecked) : false;
        if (callback) callback();
    });
}

function saveMeals() {
    const checkbox = document.getElementById("selfCheck");
    const checkedValue = checkbox && checkbox.checked ? 1 : 0;
    let hasMealSelected = document.querySelectorAll(".meal-btn.selected").length > 0;

    const weekStartStr = window.currentWeekStartDate;
    if (!isTwoWeeksLaterOrMore(weekStartStr) && isNextWeekGloballyClosed(weekStartStr)) {
        alert("마감시간이 지났기 때문에 변경이 불가능합니다.");
        return;
    }

    if (hasMealSelected && checkedValue === 0) {
        alert("본인확인을 체크해주세요!");
        return;
    }

    let __createdAt = isSameWeekAsNow(weekStartStr) ? null : makeCreatedAt();

    postData("/selfcheck", {
        user_id: window.currentUser.userId,
        date: weekStartStr,
        checked: checkedValue,
        ...(__createdAt ? { created_at: __createdAt } : {})
    }, () => {
        const meals = getCurrentWeekDates().map(date => {
            const meal = { user_id: window.currentUser.userId, name: window.currentUser.userName, dept: window.currentUser.dept, date, breakfast: 0, lunch: 0, dinner: 0, ...(__createdAt ? { created_at: __createdAt } : {}) };
            document.querySelectorAll(`.meal-btn[data-date="${date}"]`).forEach(btn => {
                if (btn.classList.contains("selected")) {
                    const t = btn.dataset.type;
                    if (t === "조식") meal.breakfast = 1;
                    if (t === "중식") meal.lunch = 1;
                    if (t === "석식") meal.dinner = 1;
                }
            });
            return meal;
        });

        postData("/meals", { meals }, () => {
            showToast("✅ 저장 완료");
            alert("✅ 저장되었습니다.");
            loadWeekData();
        }, (err) => showToast("❌ 저장 실패: " + err.message));
    });
}

function updateMealSummary() {
    let b = 0, l = 0, d = 0;
    document.querySelectorAll(".meal-btn.selected").forEach(btn => {
        const t = btn.dataset.type;
        if (t === "조식") b++; else if (t === "중식") l++; else if (t === "석식") d++;
    });
    document.getElementById("mealSummary").innerText = `총 식수 ${b+l+d} (조식 ${b}, 중식 ${l}, 석식 ${d})`;
}

function isThisWeek(dateStr) {
    const now = (typeof getKSTDate === "function") ? getKSTDate() : new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    const target = new Date(dateStr);
    return target >= mon && target <= sun;
}

function setDefaultWeek() {
  const today = (typeof getKSTDate === "function") ? getKSTDate() : new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(today); mon.setDate(today.getDate() + diff);
  document.getElementById("weekPicker").value = mon.toISOString().split("T")[0];
}

function isDeadlinePassed(dateStr, mealType) {
    const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
    if (isTwoWeeksLaterOrMore(dateStr)) return false;
    
    const mealDate = new Date(dateStr); mealDate.setHours(0,0,0,0);

    if (isThisWeek(dateStr)) {
        if (window.currentUser?.region !== "에코센터") {
            let dl = new Date(mealDate);
            if (mealType === "조식") { dl.setDate(dl.getDate()-1); dl.setHours(9,0,0,0); }
            else if (mealType === "중식") dl.setHours(10,30,0,0);
            else if (mealType === "석식") dl.setHours(14,30,0,0);
            return now > dl;
        }
        const createdAtStr = window.selfcheckCreatedAtMap[ymdKST(mondayOf(new Date(dateStr)))];
        if (!createdAtStr) return true;
        if (new Date(createdAtStr.replace(' ','T')+'+09:00') > lastWeekWednesdayCutoff()) { isSelfcheckLate = true; return true; }
        
        let dl = new Date(mealDate);
        if (mealType === "조식") { dl.setDate(dl.getDate()-1); dl.setHours(9,0,0,0); }
        else if (mealType === "중식") dl.setHours(10,30,0,0);
        else if (mealType === "석식") dl.setHours(14,30,0,0);
        return now > dl;
    }

    const thisMon = mondayOf(now);
    const wedDl = new Date(thisMon); wedDl.setDate(thisMon.getDate()+2); wedDl.setHours(16,0,0,0);
    return now > wedDl;
}

const pad2 = n => String(n).padStart(2,'0');
const fmtKST = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const ymdKST = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
function mondayOf(d) { const c = new Date(d); const idx = (c.getDay()+6)%7; c.setHours(0,0,0,0); c.setDate(c.getDate()-idx); return c; }
function isSameWeekAsNow(ws) { const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date(); return ws === ymdKST(mondayOf(now)); }
function isNextWeekGloballyClosed(ws) {
  const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
  const thisMon = mondayOf(now);
  const nextMon = new Date(thisMon); nextMon.setDate(nextMon.getDate()+7);
  if (ws !== ymdKST(nextMon)) return false;
  const wed = new Date(thisMon); wed.setDate(thisMon.getDate()+2); wed.setHours(16,0,0,0);
  return now > wed;
}
function makeCreatedAt() { const d = (typeof getKSTDate === 'function') ? getKSTDate() : new Date(); return fmtKST(d); }

document.addEventListener("DOMContentLoaded", function () {
    const savedSelfcheckMap = sessionStorage.getItem("selfcheckCreatedAtMap");
    if (savedSelfcheckMap) window.selfcheckCreatedAtMap = JSON.parse(savedSelfcheckMap);
    
    setDefaultWeek();
    updateToggleSelectButtonLabel();
    
    const savedId = localStorage.getItem("savedUserId");
    const savedName = localStorage.getItem("savedUserName");
    if (savedId && savedName) {
        document.getElementById("userId").value = savedId;
        document.getElementById("userName").value = savedName;
        document.getElementById("rememberMe").checked = true;
    }

    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        const topUserText = document.getElementById("topUserText");
        if (topUserText) topUserText.textContent = `${window.currentUser.userName}님`;
        if (window.currentUser.level === 3) showInlineBlock(document.getElementById("adminBtn"));
        if (window.currentUser.level === 2) showInlineBlock(document.getElementById("teamEditButton"));
    }

    const year = new Date().getFullYear();
    fetchHolidayList(`/api/public-holidays?year=${year}`, (h1) => {
        fetchHolidayList(`/api/public-holidays?year=${year+1}`, (h2) => {
            const merged = [].concat(h1||[]).concat(h2||[]);
            holidayList = merged.map(h => normalizeDate(h.date || h));
            merged.forEach(h => { holidayMap[normalizeDate(h.date || h)] = h.description || h.name || ""; });
            if (savedUser) { hideElement(document.getElementById("login-wrapper")); showBlock(document.getElementById("mainArea")); loadWeekData(); }
        });
    });
    document.getElementById("weekPicker").addEventListener("change", loadWeekData);
});

function lastWeekWednesdayCutoff() {
    const mon = mondayOf((typeof getKSTDate === 'function') ? getKSTDate() : new Date());
    const lastWed = new Date(mon); lastWed.setDate(mon.getDate() - 5); lastWed.setHours(16,0,0,0);
    return lastWed;
}

function isTwoWeeksLaterOrMore(ws) {
    const mon = mondayOf((typeof getKSTDate === 'function') ? getKSTDate() : new Date());
    const target = new Date(mon); target.setDate(mon.getDate() + 14);
    return new Date(ws) >= target;
}

function loadSelfCheck(userId, date, callback) {
  const cb = document.getElementById("selfCheck");
  if (!cb) { if(callback) callback(); return; }
  getData(`/selfcheck?user_id=${userId}&date=${date}`, (data) => {
      if (data && data.created_at) {
          window.selfcheckCreatedAtMap[date] = data.created_at;
          sessionStorage.setItem("selfcheckCreatedAtMap", JSON.stringify(window.selfcheckCreatedAtMap));
      }
      cb.checked = data.checked === 1;
      const now = new Date(); const weekEnd = new Date(date); weekEnd.setDate(weekEnd.getDate()+4);
      cb.disabled = !isThisWeek(date) && now > weekEnd;
      if (callback) callback();
  }, () => { if(callback) callback(); });
}

window.login = login; window.logout = logout; window.saveMeals = saveMeals;
window.loadWeekData = loadWeekData; window.goToVisitor = () => location.href="visitor_request.html";
window.goToTeamEdit = () => location.href="team_edit.html";

/* 색각 보정 모드 */
const COLOR_BLIND_STORAGE_KEY = "snsysColorBlindMode";
function applyColorBlindMode(mode) {
  document.body.classList.remove("cb-protan","cb-deutan","cb-tritan","cb-protan-deutan","cb-tritan-deutan","cb-highcontrast");
  if (mode !== "normal") document.body.classList.add(`cb-${mode}`);
  localStorage.setItem(COLOR_BLIND_STORAGE_KEY, mode);
}
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(COLOR_BLIND_STORAGE_KEY) || "normal";
  applyColorBlindMode(saved);
  const s1 = document.getElementById("colorBlindMode");
  const s2 = document.getElementById("sidebarColorBlindMode");
  [s1, s2].forEach(s => { if(s) s.addEventListener("change", e => applyColorBlindMode(e.target.value)); });
});