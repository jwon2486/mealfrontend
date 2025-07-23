
let holidayList = [];  // 서버에서 불러온 공휴일 날짜 배열
let editMode = "apply";
let selfcheckMap = {};

function formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const day = weekdays[date.getDay()];
    return `${dateStr} (${day})`;
}

// ✅ selfcheck 데이터 조회 함수
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

// ✅ 서버에서 식수 신청 내역 조회 (관리자용)
async function loadEditData(selectedWeek) {
    editMode = "apply";
    const range = selectedWeek ? getWeekRange(selectedWeek) : getCurrentWeekRange();
    const { start, end } = range;

    if (!range) {
        alert("❗ 주간 날짜가 지정되지 않았습니다.");
        return;
    }

    const url = `/admin/meals?start=${start}&end=${end}&mode=${editMode}`;

    getData(url, async (flatData) => {
        document.getElementById("edit-body").innerHTML = "";
        document.getElementById("table-head").innerHTML = "";

        const grouped = {};
        flatData.forEach(entry => {
            if (!entry.user_id || !entry.name || !entry.dept || !entry.date) return;
            if (!entry.breakfast && !entry.lunch && !entry.dinner) return;

            const uid = entry.user_id;
            if (!grouped[uid]) {
                grouped[uid] = {
                    id: entry.user_id,
                    name: entry.name,
                    dept: entry.dept,
                    meals: {}
                };
            }

            grouped[uid].meals[entry.date] = {
                breakfast: entry.breakfast === 1,
                lunch: entry.lunch === 1,
                dinner: entry.dinner === 1
            };
        });

        const dates = getDateArray(start, end);
        const groupedValues = Object.values(grouped).sort((a, b) => {
        if (a.dept < b.dept) return -1;
        if (a.dept > b.dept) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
        });
        const selfcheckMap = await fetchSelfcheckMap(start, end);

        generateTableHeader(dates);
        applyStickyHeaderOffsets();
        generateTableBody(dates, groupedValues, selfcheckMap);
        updateSummary(groupedValues, dates);
        filterEditData();
    }, (err) => {
        alert("❌ 서버에서 데이터를 가져오지 못했습니다.");
        console.error("❌ GET 요청 실패:", err);
    });
}

// ✅ 테이블 헤더 생성
function generateTableHeader(dates) {
    const thead = document.getElementById("table-head");
    thead.innerHTML = "";

    const topRow = document.createElement("tr");
    
    topRow.innerHTML = `<th rowspan="2">부서</th><th rowspan="2">사번</th><th rowspan="2">이름</th><th rowspan="2">본인확인</th>`;
    
    dates.forEach(date => {
        const isHoliday = holidayList.includes(normalizeDate(date));
        const className = isHoliday ? "holiday-header" : "";
        topRow.innerHTML += `<th colspan="3" class="${className}">${formatDateWithDay(date)}</th>`;
        
        //const color = isHoliday ? "red" : "black";
        //topRow.innerHTML += `<th colspan="3" style="color:${color}">${date}</th>`;
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
        
        //const color = isHoliday ? "red" : "black";
        //subRow.innerHTML += `<th style="color:${color}">조식</th><th style="color:${color}">중식</th><th style="color:${color}">석식</th>`;
    });

    thead.appendChild(topRow);
    thead.appendChild(subRow);
}

// ✅ 테이블 본문 생성
function generateTableBody(dates, data, selfcheckMap) {
    const tbody = document.getElementById("edit-body");
    tbody.innerHTML = "";

    data.forEach(emp => {
        const tr = document.createElement("tr");

        const checkStatus = selfcheckMap?.[emp.id] ? "✅" : "❌";

        tr.innerHTML = `
            <td>${emp.dept}</td>
            <td>${emp.id}</td>
            <td>${emp.name}</td>
            <td>${checkStatus}</td>
        `;

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
                    btn.disabled = false;
                    btn.title = "공휴일에는 신청할 수 없습니다.";
                    btn.onclick = () => alert("⛔ 공휴일에는 신청할 수 없습니다.");
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


// ✅ 신청 상태 토글
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

// ✅ 필터 검색 (부서/사번/이름)
function filterEditData() {
    const dept = document.getElementById("searchDept").value.trim().toLowerCase();
    const id = document.getElementById("searchEmpId").value.trim().toLowerCase();
    const name = document.getElementById("searchName").value.trim().toLowerCase();
    const selfcheckFilter = document.getElementById("selfcheckFilter")?.value;

    const rows = document.querySelectorAll("#edit-body tr");
    rows.forEach(row => {
        const deptVal = row.children[0].innerText.toLowerCase();
        const idVal = row.children[1].innerText.toLowerCase();
        const nameVal = row.children[2].innerText.toLowerCase();
        const selfcheckVal = row.children[3].innerText.trim(); // ✅ or ❌

        const matchesTextFilter =
            (!dept || deptVal.includes(dept)) &&
            (!id || idVal.includes(id)) &&
            (!name || nameVal.includes(name));

        const matchesSelfcheck =
            selfcheckFilter === "all" ||
            (selfcheckFilter === "checked" && selfcheckVal === "✅") ||
            (selfcheckFilter === "unchecked" && selfcheckVal === "❌");

        row.style.display = matchesTextFilter && matchesSelfcheck ? "" : "none";
    });
}

function resetFilter() {
    // 필터 입력창 초기화
    document.getElementById("searchDept").value = "";
    document.getElementById("searchEmpId").value = "";
    document.getElementById("searchName").value = "";
  
    // 행을 모두 다시 보이게 설정
    const rows = document.querySelectorAll("#edit-body tr");
    rows.forEach(row => {
      row.style.display = "";
    });
}

// ✅ 저장 버튼 클릭 시 서버로 변경사항 전송
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

    console.log("📤 관리자 저장 요청:", meals);

    postData("/admin/edit_meals", { meals },
        () => {
            alert("✅ 저장되었습니다.");
            const selectedDate = document.getElementById("editWeekPicker").value;
            loadEditData(selectedDate);  // ✅ 선택된 날짜를 인자로 명시적으로 전달
            setTimeout(() => {
                loadEditData(selectedDate);
            }, 700);
        },
        (err) => alert("❌ 저장 실패: " + err.message)
    );
}


// ✅ 선택한 날짜 기준 주간 범위 계산
function getWeekRange(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return {
        start: monday.toISOString().split("T")[0],
        end: friday.toISOString().split("T")[0]
    };
}

// ✅ 시작~끝 날짜 배열 생성
function getDateArray(start, end) {
    const dates = [];
    let current = new Date(start);
    while (current <= new Date(end)) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/* ✅ 마감 여부 판단 함수 (조식/중식/석식)
function isDeadlinePassed(dateStr, mealType) {
    const now = getKSTDate();
    const mealDate = new Date(dateStr);

    // ✅ 2주 뒤 월요일부터는 마감 제한 없음
    const day = now.getDay(); // 0(일) ~ 6(토)
    const diffToMonday = day === 0 ? -6 : 1 - day;
    let thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);

    const twoWeeksLaterMonday = new Date(thisMonday);
    twoWeeksLaterMonday.setDate(thisMonday.getDate() + 14);

    if (mealDate >= twoWeeksLaterMonday) {
        return false; // ✅ 마감 없음
    }

    // ✅ 이번 주 마감 규칙
    if (isThisWeek(dateStr)) {
        let deadline = new Date(mealDate);
        if (mealType === "조식") {
            deadline.setDate(mealDate.getDate() - 1);
            deadline.setHours(15, 0, 0, 0); // 전날 오후 3시
        } else if (mealType === "중식") {
            deadline.setHours(10, 0, 0, 0); // 당일 오전 10시
        } else if (mealType === "석식") {
            deadline.setHours(15, 0, 0, 0); // 당일 오후 3시
        }
        return now > deadline;
    }

    // ✅ 다음 주는 이번 주 수요일 오후 4시까지만 신청 가능
    thisMonday = new Date(now);
    const diff = thisMonday.getDay() === 0 ? -6 : 1 - thisMonday.getDay();
    thisMonday.setDate(thisMonday.getDate() + diff); // 이번 주 월요일
    thisMonday.setHours(0, 0, 0, 0);

    const wednesdayDeadline = new Date(thisMonday);
    wednesdayDeadline.setDate(thisMonday.getDate() + 2); // 수요일
    wednesdayDeadline.setHours(16, 0, 0, 0); // 16시

    return now > wednesdayDeadline;
}*/

/*
function isThisWeek(dateStr) {
    const target = new Date(dateStr);
    const now = getKSTDate();

    const monday = new Date(now);
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + diff);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return target >= monday && target <= sunday;
}
*/

// ✅ 이번 주 날짜 범위
function getCurrentWeekRange() {
    return getWeekRange(getKSTDate().toISOString().split("T")[0]);
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

// ✅ 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
    const picker = document.getElementById("editWeekPicker");

    // ✅ 다음 주 월요일 계산
    const today = getKSTDate();
    const day = today.getDay(); // 0(일)~6(토)
    const diffToNextMonday = day === 0 ? 1 : 8 - day;

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diffToNextMonday);

    const nextMondayStr = nextMonday.toISOString().split("T")[0];
    picker.value = nextMondayStr;

    const year = nextMonday.getFullYear();
    const holidayApiUrl = `/holidays?year=${year}`;

    fetchHolidayList(holidayApiUrl, (holidays) => {
    holidayList = holidays;
    editMode = "all";  // 명확히 전체 조회 모드 지정
    loadAllEmployeesForEdit(nextMondayStr);  // ✅ 전체 인원 기준 초기 로딩
    });
    });

// ✅ 주 선택 변경 시 자동 조회
document.getElementById("editWeekPicker").addEventListener("change", function () {
    if (editMode === "all") {
        loadAllEmployeesForEdit(this.value);
    } else {
        loadEditData(this.value);
    }
});


// ✅ 전체 등록 인력 + 신청 여부 함께 조회
async function loadAllEmployeesForEdit(selectedWeek = null) {
    editMode = "all";
    const range = selectedWeek ? getWeekRange(selectedWeek) : getCurrentWeekRange();
    const { start, end } = range;

    const url = `/admin/meals?start=${start}&end=${end}&mode=${editMode}`;

    getData(url, async (response) => {
        const dates = getDateArray(start, end);

        const grouped = {};
        response.forEach(entry => {
            const uid = entry.user_id;
            if (!grouped[uid]) {
                grouped[uid] = {
                    id: entry.user_id,
                    name: entry.name,
                    dept: entry.dept,
                    meals: {}
                };
            }
            grouped[uid].meals[entry.date] = {
                breakfast: entry.breakfast === 1,
                lunch: entry.lunch === 1,
                dinner: entry.dinner === 1
            };
        });

        const groupedValues = Object.values(grouped).sort((a, b) => {
        if (a.dept < b.dept) return -1;
        if (a.dept > b.dept) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
        });
        const selfcheckMap = await fetchSelfcheckMap(start, end);

        generateTableHeader(dates);
        applyStickyHeaderOffsets();
        generateTableBody(dates, groupedValues, selfcheckMap);
        updateSummary(groupedValues, dates);
        filterEditData();
    }, (err) => {
        console.error("❌ 전체보기 실패:", err);
        alert("❌ 전체 데이터를 불러오지 못했습니다.");
    });
}

function applyStickyHeaderOffsets() {
        const thead = document.querySelector('#edit-table thead');
        const headerRows = thead.querySelectorAll('tr');

        if (headerRows.length >= 2) {
            const firstRowHeight = headerRows[0].offsetHeight;

            // 첫 번째 줄: top 0
            headerRows[0].querySelectorAll('th').forEach(th => {
                th.style.top = '0px';
                th.style.zIndex = '10'; // 헤더 기본 z-index
                th.style.position = 'sticky';
            });

            // 두 번째 줄: top은 첫 줄 높이만큼
            headerRows[1].querySelectorAll('th').forEach(th => {
                th.style.top = `${firstRowHeight}px`;
                th.style.zIndex = '9'; // 아래에 위치
                th.style.position = 'sticky';
            });
        }
}