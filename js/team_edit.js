// team_edit.js - 모던 카드 그리드 아키텍처 완전 리팩토링 버전

let holidayList = [];
let holidayMap = {}; 
let editMode = "all";
let selfcheckMap = {};
window.serverDeadlines = null; 

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

function applySelfcheckFilter() {
    const filter = document.getElementById("selfcheckFilter").value;
    document.querySelectorAll(".emp-meal-card").forEach(card => {
        const isChecked = card.dataset.selfcheck === "true";
        if (filter === "") {
            card.style.display = "";
        } else if (filter === "1" && isChecked) {
            card.style.display = "";
        } else if (filter === "0" && !isChecked) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
}

function getShortDayName(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${dateStr.substring(5)} (${weekdays[date.getDay()]})`;
}

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
        
        renderEmployeeCards(dates, groupedValues);
        updateSummary(groupedValues, dates);
        applySelfcheckFilter();
        filterEditData();
    }, (err) => {
        alert("❌ 서버에서 데이터를 가져오지 못했습니다.");
    });
}

function renderEmployeeCards(dates, data) {
    const gridContainer = document.getElementById("empGrid");
    gridContainer.innerHTML = "";

    data.forEach(emp => {
        const isSelfChecked = !!selfcheckMap[emp.id];
        const card = document.createElement("div");
        card.className = "emp-meal-card";
        card.dataset.id = emp.id;
        card.dataset.name = emp.name;
        card.dataset.region = emp.region || "";
        card.dataset.selfcheck = isSelfChecked;

        let cardHtml = `
            <div class="card-emp-info">
                <div class="emp-profile">
                    <span class="emp-name">${emp.name}</span>
                    <span class="emp-id">${emp.id}</span>
                </div>
                <div class="emp-meta">
                    <span class="meta-badge">${emp.dept}</span>
                    <span class="meta-badge">${emp.region || "미지정"}</span>
                    <span class="meta-badge ${isSelfChecked ? 'self-ok' : 'self-no'}">
                        ${isSelfChecked ? '확인 완료' : '미확인'}
                    </span>
                </div>
            </div>
            <div class="card-meal-timeline">
        `;

        dates.forEach(date => {
            const isHoliday = holidayList.includes(normalizeDate(date));
            const meal = emp.meals[date] || {};
            
            cardHtml += `
                <div class="timeline-day-row">
                    <span class="day-label ${isHoliday ? 'holiday' : ''}">
                        ${getShortDayName(date)} ${isHoliday ? '[휴]' : ''}
                    </span>
                    <div class="meal-badge-group" data-date="${date}" data-id="${emp.id}" data-name="${emp.name}" data-dept="${emp.dept}">
            `;

            ["조식", "중식", "석식"].forEach(type => {
                const key = type === "조식" ? "breakfast" : type === "중식" ? "lunch" : "dinner";
                const selected = meal[key] === true;
                
                let btnClass = "meal-btn";
                let btnText = type;
                let disabledAttr = "";

                if (selected) btnClass += " selected";

                if (isHoliday) {
                    btnClass += " meal-holiday";
                    disabledAttr = "disabled";
                    btnText = "휴무";
                } else if (isDeadlinePassed(date, type, emp.region)) {
                    disabledAttr = "disabled";
                    // 💡 [핵심 수정 분기] 마감 통제 랙 안에서 신청 유무 계층 분할 설계
                    if (selected) {
                        btnClass = "meal-btn meal-deadline-selected";
                        btnText = `✓ ${type}`; // 신청 상태 마감 처리
                    } else {
                        btnClass = "meal-btn meal-deadline";
                        btnText = type; // 미신청 상태 마감 처리
                    }
                }

                cardHtml += `<button class="${btnClass}" data-type="${type}" ${disabledAttr}>${btnText}</button>`;
            });

            cardHtml += `</div></div>`;
        });

        cardHtml += `</div>`;
        card.innerHTML = cardHtml;

        card.querySelectorAll(".meal-btn:not(:disabled)").forEach(btn => {
            btn.onclick = () => {
                btn.classList.toggle("selected");
            };
        });

        gridContainer.appendChild(card);
    });
}

function filterEditData() {
    const id = document.getElementById("searchEmpId").value.trim().toLowerCase();
    const name = document.getElementById("searchName").value.trim().toLowerCase();
    const region = document.getElementById("regionFilter")?.value || "";

    document.querySelectorAll(".emp-meal-card").forEach(card => {
        const idVal = card.dataset.id.toLowerCase();
        const nameVal = card.dataset.name.toLowerCase();
        const regionVal = card.dataset.region;
        const show = (!id || idVal.includes(id)) && (!name || nameVal.includes(name)) && (!region || regionVal === region);
        card.style.display = show ? "" : "none";
    });
}

function saveEditChanges() {
    if (!confirm("변경사항을 저장하시겠습니까?")) return;

    const mealsMap = {};
    document.querySelectorAll(".timeline-day-row").forEach(row => {
        const group = row.querySelector(".meal-badge-group");
        if (!group) return;

        const userId = group.dataset.id;
        const name = group.dataset.name;
        const dept = group.dataset.dept;
        const date = group.dataset.date;

        const key = `${userId}_${date}`;
        if (!mealsMap[key]) {
            mealsMap[key] = { user_id: userId, name, dept, date, breakfast: 0, lunch: 0, dinner: 0 };
        }

        row.querySelectorAll(".meal-btn").forEach(btn => {
            const type = btn.dataset.type;
            const isSelected = btn.classList.contains("selected") || btn.classList.contains("meal-deadline-selected");
            if (type === "조식") mealsMap[key].breakfast = isSelected ? 1 : 0;
            if (type === "중식") mealsMap[key].lunch = isSelected ? 1 : 0;
            if (type === "석식") mealsMap[key].dinner = isSelected ? 1 : 0;
        });
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
    return { start: ymdKST(monday), end: ymdKST(friday) };
}

function getNextWeekRange() {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const thisMon = mondayOf(now);
    const nextMon = new Date(thisMon);
    nextMon.setDate(thisMon.getDate() + 7);
    const nextFri = new Date(nextMon);
    nextFri.setDate(nextMon.getDate() + 4);
    return { start: ymdKST(nextMon), end: ymdKST(nextFri) };
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

function isDeadlinePassed(dateStr, mealType, empRegion) {
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    if (isTwoWeeksLaterOrMore(dateStr)) return false;
    if (!window.serverDeadlines) return true; 

    const mealDate = new Date(dateStr);
    mealDate.setHours(0, 0, 0, 0);
    const todayZero = new Date(now);
    todayZero.setHours(0, 0, 0, 0);
    if (mealDate < todayZero) return true;

    if (isThisWeek(dateStr)) {
        if (empRegion === "에코센터" || window.currentUser?.region === "에코센터") {
            const thisMondayStr = ymdKST(mondayOf(mealDate));
            const createdAtStr = sessionStorage.getItem("selfcheckCreatedAtMap") ? JSON.parse(sessionStorage.getItem("selfcheckCreatedAtMap"))[thisMondayStr] : null;
            if (createdAtStr) {
                const checkTime = new Date(createdAtStr.replace(' ', 'T') + '+09:00');
                if (checkTime > lastWeekWednesdayCutoff()) return true;
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

    const thisMon = mondayOf(now);
    const nextMon = new Date(thisMon);
    nextMon.setDate(nextMon.getDate() + 7);
    
    if (dateStr === ymdKST(nextMon) || new Date(dateStr) >= nextMon) {
        if (empRegion !== "에코센터" && window.currentUser?.region !== "에코센터") return false;
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

document.addEventListener("DOMContentLoaded", () => {
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    if (!currentUser || currentUser.level !== 2) {
        alert("중간관리자만 접근할 수 있습니다.");
        location.href = "index.html";
        return;
    }
    window.currentUser = currentUser; 

    const regionFilter = document.getElementById("regionFilter");
    if (currentUser.region && regionFilter) {
        if (Array.from(regionFilter.options).map(o => o.value).includes(currentUser.region)) {
            regionFilter.value = currentUser.region;
        }
    }

    const picker = document.getElementById("editWeekPicker");
    const { start } = getNextWeekRange(); 
    picker.value = start;

    const year = new Date().getFullYear();
    const nextYear = year + 1;

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

function applyStickyHeaderOffsets() {}
window.loadEditData = loadEditData;
window.onSearch = onSearch;