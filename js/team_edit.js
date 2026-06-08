// team_edit.js - 서버 기반 마감 로직 동기화 버전

let holidayList = [];
let holidayMap = {}; // 공휴일 설명 매핑용 추가
let editMode = "all";
let selfcheckMap = {};
window.serverDeadlines = null; // 백엔드 동적 마감시간 저장용 전역 객체

// 본인확인 불러오는 함수
async function fetchSelfcheckMap(startDate, endDate) {
  return new Promise((resolve) => {
    getData(`/admin/selfcheck?start=${startDate}&end=${endDate}`, (data) => {
      const map = {};
      Object.entries(data).forEach(([userId, checked]) => {
        map[userId] = checked === 1;
      });
      resolve(map);
    }, (err) => {
      console.error("❌ selfcheck 조회 실패:", err);
      resolve({});
    });
  });
}

// 본인확인 ox 여부 필터링 함수
function applySelfcheckFilter() {
    const filter = document.getElementById("selfcheckFilter").value;

    document.querySelectorAll("#edit-body tr").forEach(tr => {
        const selfcheckCell = tr.querySelector("td.selfcheck-col");
        if (!selfcheckCell) return;

        if (filter === "") {
            tr.style.display = "";
        } else if (filter === "1" && selfcheckCell.textContent === "✅") {
            tr.style.display = "";
        } else if (filter === "0" && selfcheckCell.textContent === "❌") {
            tr.style.display = "";
        } else {
            tr.style.display = "none";
        }
    });
}

function formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const day = weekdays[date.getDay()];
    return `${dateStr} (${day})`;
}

// 💡 [서버 동기화] 서버 마감 설정 동적 Fetch 함수 이식
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

async function loadEditData(selectedWeek) {
    editMode = "all";
    const range = selectedWeek ? getWeekRange(selectedWeek) : getCurrentWeekRange();
    const { start, end } = range;
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    const myDept = currentUser?.department || currentUser?.dept;

    if (!range) {
        alert("❗ 주간 날짜가 지정되지 않았습니다.");
        return;
    }
    
    selfcheckMap = await fetchSelfcheckMap(start, end);

    const url = `/admin/meals?start=${start}&end=${end}&mode=${editMode}`;
    getData(url, (flatData) => {
        if (!Array.isArray(flatData)) {
            if (Array.isArray(flatData.data)) {
                flatData = flatData.data;
            } else {
                alert("❌ 서버 응답 형식이 예상과 다릅니다.");
                return;
            }
        }

        const grouped = {};
        flatData.forEach(entry => {
            if (!entry.user_id || !entry.name || !entry.dept) return;
            if (entry.dept !== myDept) return;

            const uid = entry.user_id;
            if (!grouped[uid]) {
                grouped[uid] = {
                    id: entry.user_id,
                    name: entry.name,
                    dept: entry.dept,
                    region: entry.region,
                    meals: {}
                };
            }

            if (entry.date) {
                grouped[uid].meals[entry.date] = {
                    breakfast: entry.breakfast === 1,
                    lunch: entry.lunch === 1,
                    dinner: entry.dinner === 1
                };
            }
        });

        const dates = getDateArray(start, end);
        const groupedValues = Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
        generateTableHeader(dates);
        applyStickyHeaderOffsets();
        generateTableBody(dates, groupedValues);
        updateSummary(groupedValues, dates);
        applySelfcheckFilter();
        filterEditData();
    }, (err) => {
        alert("❌ 서버에서 데이터를 가져오지 못했습니다.");
    });
}

function generateTableHeader(dates) {
    const thead = document.getElementById("table-head");
    thead.innerHTML = "";

    const topRow = document.createElement("tr");
    topRow.innerHTML = `<th rowspan="2">부서</th>
                    <th rowspan="2">사번</th>
                    <th rowspan="2">이름</th>
                    <th rowspan="2">근무지역</th>
                    <th rowspan="2">본인확인</th>`;

    dates.forEach(date => {
        const isHoliday = holidayList.includes(normalizeDate(date));
        const className = isHoliday ? "holiday-header" : "";
        topRow.innerHTML += `<th colspan="3" class="${className}">${formatDateWithDay(date)}</th>`;
    });

    const subRow = document.createElement("tr");
    dates.forEach(date => {
        const isHoliday = holidayList.includes(normalizeDate(date));
        const className = isHoliday ? "holiday-header" : "";
        subRow.innerHTML += `
          <th class="${className}">조식</th>
          <th class="${className}">중식</th>
          <th class="${className}">석식</th>
        `;
    });

    thead.appendChild(topRow);
    thead.appendChild(subRow);
}

function generateTableBody(dates, data) {
    const tbody = document.getElementById("edit-body");
    tbody.innerHTML = "";

    data.forEach(emp => {
        const tr = document.createElement("tr");
        const selfcheckStatus = selfcheckMap[emp.id] ? "✅" : "❌";

        tr.innerHTML = `<td>${emp.dept}</td>
                        <td>${emp.id}</td>
                        <td>${emp.name}</td>
                        <td>${emp.region || ""}</td>
                        <td class="selfcheck-col">${selfcheckStatus}</td>`;

        dates.forEach(date => {
            const meal = emp.meals[date] || {};
            ["조식", "중식", "석식"].forEach(type => {
                const key = type === "조식" ? "breakfast" : type === "중식" ? "lunch" : "dinner";
                const selected = meal[key] === true;

                const btn = document.createElement("button");
                btn.className = "meal-btn";
                btn.dataset.id = emp.id;
                btn.dataset.name = emp.name;
                btn.dataset.dept = emp.dept;
                btn.dataset.date = date;
                btn.dataset.type = type;
                btn.innerText = selected ? "✅" : "❌";

                if (selected) {
                    btn.classList.add("selected");
                    btn.style.backgroundColor = "#28a745";
                    btn.style.color = "#fff";
                }

                const isHoliday = holidayList.includes(normalizeDate(date));
                if (isHoliday) {
                    btn.style.backgroundColor = "#ffe6e6";
                    btn.style.color = "#cc0000";
                    btn.disabled = true; // 관리자 대시보드 성격에 따라 차단 동기화
                    btn.title = "공휴일에는 신청할 수 없습니다.";
                    btn.onclick = () => alert("⛔ 공휴일에는 신청할 수 없습니다.");
                } else if (isDeadlinePassed(date, type, emp.region)) { // 💡 대상 부서원의 근무지역 정보 전달
                    btn.classList.add("meal-deadline"); 
                    btn.title = "신청 마감됨";
                    btn.disabled = true;
                    btn.onclick = () => alert(`${type}은 신청 마감 시간이 지났습니다.`);
                } else {
                    btn.onclick = () => toggleMeal(btn);
                }

                const td = document.createElement("td");
                td.appendChild(btn);
                tr.appendChild(td);
            });
        });

        tbody.appendChild(tr);
    });
}

function toggleMeal(btn) {
    if (btn.classList.contains("selected")) {
        btn.classList.remove("selected");
        btn.innerText = "❌";
        btn.style.backgroundColor = "#e0e0e0";
        btn.style.color = "#000";
    } else {
        btn.classList.add("selected");
        btn.innerText = "✅";
        btn.style.backgroundColor = "#28a745";
        btn.style.color = "#fff";
    }
}

function filterEditData() {
    const id = document.getElementById("searchEmpId").value.trim().toLowerCase();
    const name = document.getElementById("searchName").value.trim().toLowerCase();
    const region = document.getElementById("regionFilter")?.value || "";

    const rows = document.querySelectorAll("#edit-body tr");
    rows.forEach(row => {
        const idVal = row.children[1].innerText.toLowerCase();
        const nameVal = row.children[2].innerText.toLowerCase();
        const regionVal = row.children[3].innerText;
        const show = (!id || idVal.includes(id)) && (!name || nameVal.includes(name)) && (!region || regionVal === region);
        row.style.display = show ? "" : "none";
    });
}

function saveEditChanges() {
    if (!confirm("변경사항을 저장하시겠습니까?")) return;

    const allBtns = document.querySelectorAll(".meal-btn");
    const mealsMap = {};

    allBtns.forEach(btn => {
        const userId = btn.dataset.id;
        const name = btn.dataset.name;
        const dept = btn.dataset.dept;
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        const key = `${userId}_${date}`;
        if (!mealsMap[key]) {
            mealsMap[key] = {
                user_id: userId,
                name: name,
                dept: dept,
                date: date,
                breakfast: 0,
                lunch: 0,
                dinner: 0
            };
        }

        const isSelected = btn.classList.contains("selected");

        if (type === "조식") {
            mealsMap[key].breakfast = isSelected ? 1 : 0;
        } else if (type === "중식") {
            mealsMap[key].lunch = isSelected ? 1 : 0;
        } else if (type === "석식") {
            mealsMap[key].dinner = isSelected ? 1 : 0;
        }
    });

    const meals = Object.values(mealsMap);

    postData("/admin/edit_meals", { meals },
        () => {
            alert("✅ 저장되었습니다.");
            const selectedDate = document.getElementById("editWeekPicker").value;
            setTimeout(() => loadEditData(selectedDate), 700);
        },
        (err) => alert("❌ 저장 실패: " + err.message)
    );
}

// 날짜 유틸리티 함수군 (script.js의 동기화 구현체 반영)
function mondayOf(d) {
    const c = new Date(d);
    const idx = (c.getDay() + 6) % 7;
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - idx);
    return c;
}

function ymdKST(d) {
    const pad2 = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getWeekRange(dateStr) {
    const monday = mondayOf(new Date(dateStr));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return {
        start: ymdKST(monday),
        end: ymdKST(friday)
    };
}

function getNextWeekRange() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const thisMon = mondayOf(now);
    const nextMon = new Date(thisMon);
    nextMon.setDate(thisMon.getDate() + 7);
    const nextFri = new Date(nextMon);
    nextFri.setDate(nextMon.getDate() + 4);

    return {
        start: ymdKST(nextMon),
        end: ymdKST(nextFri)
    };
}

function getCurrentWeekRange() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    return getWeekRange(ymdKST(now));
}

function getDateArray(start, end) {
    const dates = [];
    let current = new Date(start);
    while (current <= new Date(end)) {
        dates.push(ymdKST(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function isTwoWeeksLaterOrMore(dateStr) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mon = mondayOf(now);
    const targetWeek = new Date(mon);
    targetWeek.setDate(mon.getDate() + 14);
    return new Date(dateStr) >= targetWeek;
}

function lastWeekWednesdayCutoff() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mon = mondayOf(now);
    const lastWed = new Date(mon);
    lastWed.setDate(mon.getDate() - 5);
    lastWed.setHours(16, 0, 0, 0);
    return lastWed;
}

// 💡 [핵심 변경] script.js의 완벽한 서버 연동 통제식 마감 판정 로직으로 교체
function isDeadlinePassed(dateStr, mealType, empRegion) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    if (isTwoWeeksLaterOrMore(dateStr)) return false;
    if (!window.serverDeadlines) return true; 

    const mealDate = new Date(dateStr);
    mealDate.setHours(0, 0, 0, 0);

    // 과거 날짜는 무조건 차단
    const todayZero = new Date(now);
    todayZero.setHours(0, 0, 0, 0);
    if (mealDate < todayZero) return true;

    // --- [1] 금주 당일 식사 마감 통제 분기 ---
    if (isThisWeek(dateStr)) {
        // 부서원이 에코센터 소속인 경우 본인 확인 시점 통제 조건식 결합
        if (empRegion === "에코센터" || window.currentUser?.region === "에코센터") {
            const thisMondayStr = ymdKST(mondayOf(mealDate));
            const createdAtStr = sessionStorage.getItem("selfcheckCreatedAtMap") ? JSON.parse(sessionStorage.getItem("selfcheckCreatedAtMap"))[thisMondayStr] : null;
            if (createdAtStr) {
                const checkTime = new Date(createdAtStr.replace(' ', 'T') + '+09:00');
                if (checkTime > lastWeekWednesdayCutoff()) {
                    return true;
                }
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
        if (empRegion !== "에코센터" && window.currentUser?.region !== "에코센터") {
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

function isThisWeek(dateStr) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const target = new Date(dateStr);
    const mon = mondayOf(now);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return target >= mon && target <= sun;
}

function updateSummary(data, dates) {
    let breakfast = 0, lunch = 0, dinner = 0;
    data.forEach(emp => {
        dates.forEach(date => {
            const meal = emp.meals[date] || {};
            if (meal.breakfast) breakfast++;
            if (meal.lunch) lunch++;
            if (meal.dinner) dinner++;
        });
    });

    document.getElementById("totalPeople").innerText = data.length;
    document.getElementById("totalBreakfast").innerText = breakfast;
    document.getElementById("totalLunch").innerText = lunch;
    document.getElementById("totalDinner").innerText = dinner;
}

function onSearch() {
    const picker = document.getElementById("editWeekPicker");
    if (!picker.value) {
        const { start } = getNextWeekRange();
        picker.value = start;
    }
    setTimeout(() => filterEditData(), 300);
}

// 💡 [프로세스 제어] 초기화부 내부 구조 최적화 및 마감 Fetch 추가
document.addEventListener("DOMContentLoaded", () => {
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    if (!currentUser || currentUser.level !== 2) {
        alert("중간관리자만 접근할 수 있습니다.");
        location.href = "index.html";
        return;
    }
    window.currentUser = currentUser; 
    console.log("✅ 현재 로그인한 사용자 정보:", window.currentUser);

    const region = currentUser.region;
    const regionFilter = document.getElementById("regionFilter");
    if (region && regionFilter) {
        const validOptions = Array.from(regionFilter.options).map(o => o.value);
        if (validOptions.includes(region)) {
            regionFilter.value = region;
            filterEditData(); 
        }
    }

    const picker = document.getElementById("editWeekPicker");
    const { start } = getNextWeekRange(); 
    picker.value = start;

    const year = new Date().getFullYear();
    const nextYear = year + 1;

    // 공휴일 정보 병합 Fetch 프로세스
    fetchHolidayList(`/api/public-holidays?year=${year}`, (apiThisYear) => {
      fetchHolidayList(`/api/public-holidays?year=${nextYear}`, (apiNextYear) => {
        fetchHolidayList(`/holidays?year=${year}`, (customThisYear) => {
          fetchHolidayList(`/holidays?year=${nextYear}`, (customNextYear) => {

            const apiMerged = [].concat(apiThisYear || []).concat(apiNextYear || []);
            const customMerged = [].concat(customThisYear || []).concat(customNextYear || []);

            const apiDates = new Set(apiMerged.map(h => (typeof h === "string") ? normalizeDate(h) : normalizeDate(h.date)));
            const filteredCustom = customMerged.filter(h => !apiDates.has((typeof h === "string") ? normalizeDate(h) : normalizeDate(h.date)));

            const merged = [...apiMerged, ...filteredCustom];
            holidayList = merged.map(h => (typeof h === "string") ? normalizeDate(h) : normalizeDate(h.date));

            holidayMap = {};
            merged.forEach(h => {
              const key  = (typeof h === "string") ? normalizeDate(h) : normalizeDate(h.date);
              const desc = (typeof h === "string") ? "" : (h.description || h.desc || h.name || "");
              holidayMap[key] = desc;
            });

            // 💡 공휴일 조회가 끝나면 서버 동적 마감 설정을 가져온 후 화면을 로드하도록 제어
            loadDeadlineSettingsFromServer(() => {
                loadEditData(start);
            });
          });
        });
      });
    });

    document.getElementById("selfcheckFilter").addEventListener("change", applySelfcheckFilter);
    document.getElementById("regionFilter").addEventListener("change", filterEditData); 
});

document.getElementById("editWeekPicker").addEventListener("change", function () {
    loadEditData(this.value);
    setTimeout(() => applySelfcheckFilter(), 300);
});

function applyStickyHeaderOffsets() {
    const thead = document.querySelector('#edit-table thead');
    const headerRows = thead.querySelectorAll('tr');

    if (headerRows.length >= 2) {
        const firstRowHeight = headerRows[0].offsetHeight;

        headerRows[0].querySelectorAll('th').forEach(th => {
            th.style.position = 'sticky';
            th.style.top = '0px';
            th.style.zIndex = '10';
        });

        headerRows[1].querySelectorAll('th').forEach(th => {
            th.style.position = 'sticky';
            th.style.top = `${firstRowHeight}px`;
            th.style.zIndex = '9';
        });
    }
}

window.loadEditData = loadEditData;
window.onSearch = onSearch;