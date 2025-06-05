// team_edit.js - 수정된 전체 코드

let holidayList = [];
let editMode = "all";

function formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const day = weekdays[date.getDay()];
    return `${dateStr} (${day})`;
}

function loadEditData(selectedWeek) {
    editMode = "all";
    const range = selectedWeek ? getWeekRange(selectedWeek) : getCurrentWeekRange();
    const { start, end } = range;
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const myDept = currentUser?.department || currentUser?.dept;

    if (!range) {
        alert("❗ 주간 날짜가 지정되지 않았습니다.");
        return;
    }

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
    if (!entry.user_id || !entry.name || !entry.dept) return;  // ✅ entry.date 조건 제거
    if (entry.dept !== myDept) return;

    const uid = entry.user_id;
    if (!grouped[uid]) {
        grouped[uid] = {
            id: entry.user_id,
            name: entry.name,
            dept: entry.dept,
            meals: {}
        };
    }

    // ✅ entry.date가 있을 때만 meals 추가
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
        generateTableBody(dates, groupedValues);
        updateSummary(groupedValues, dates);
        filterEditData();
    }, (err) => {
        alert("❌ 서버에서 데이터를 가져오지 못했습니다.");
    });
}

function generateTableHeader(dates) {
    const thead = document.getElementById("table-head");
    thead.innerHTML = "";

    const topRow = document.createElement("tr");
    topRow.innerHTML = `<th rowspan="2">부서</th><th rowspan="2">사번</th><th rowspan="2">이름</th>`;

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
        tr.innerHTML = `<td>${emp.dept}</td><td>${emp.id}</td><td>${emp.name}</td>`;

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
                } else if (isDeadlinePassed(date, type)) {
                    btn.style.backgroundColor = "#ccc";
                    btn.style.color = "#666";
                    btn.title = "신청 마감됨";
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

    const rows = document.querySelectorAll("#edit-body tr");
    rows.forEach(row => {
        const idVal = row.children[1].innerText.toLowerCase();
        const nameVal = row.children[2].innerText.toLowerCase();

        const show = (!id || idVal.includes(id)) && (!name || nameVal.includes(name));
        row.style.display = show ? "" : "none";
    });
}

function saveEditChanges() {
    if (!confirm("변경사항을 저장하시겠습니까?")) return;

    const selectedBtns = document.querySelectorAll(".meal-btn.selected");
    const meals = [];

    selectedBtns.forEach(btn => {
        const userId = btn.dataset.id;
        const name = btn.dataset.name;
        const dept = btn.dataset.dept;
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        let meal = meals.find(m => m.user_id === userId && m.date === date);
        if (!meal) {
            meal = { user_id: userId, name, dept, date, breakfast: 0, lunch: 0, dinner: 0 };
            meals.push(meal);
        }

        const selected = btn.classList.contains("selected");
        if (type === "조식") meal.breakfast = selected ? 1 : 0;
        if (type === "중식") meal.lunch = selected ? 1 : 0;
        if (type === "석식") meal.dinner = selected ? 1 : 0;
    });

    postData("/admin/edit_meals", { meals },
        () => {
            alert("✅ 저장되었습니다.");
            const selectedDate = document.getElementById("editWeekPicker").value;
            setTimeout(() => loadEditData(selectedDate), 700);
        },
        (err) => alert("❌ 저장 실패: " + err.message)
    );
}

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

function getCurrentWeekRange() {
    return getWeekRange(getKSTDate().toISOString().split("T")[0]);
}

function getDateArray(start, end) {
    const dates = [];
    let current = new Date(start);
    while (current <= new Date(end)) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function isDeadlinePassed(dateStr, mealType) {
    const now = getKSTDate();
    const mealDate = new Date(dateStr);
    let deadline = new Date(mealDate);

    if (mealType === "조식") {
        deadline.setDate(mealDate.getDate() - 1);
        deadline.setHours(20, 0, 0, 0);
    } else if (mealType === "중식") {
        deadline.setHours(12, 0, 0, 0);
    } else if (mealType === "석식") {
        deadline.setHours(17, 0, 0, 0);
    }

    return now > deadline;
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
    const selected = document.getElementById("editWeekPicker").value;
    loadEditData(selected);
}

document.addEventListener("DOMContentLoaded", () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser || currentUser.level !== 2) {
        alert("중간관리자만 접근할 수 있습니다.");
        location.href = "index.html";
        return;
    }
    window.currentUser = currentUser; // ← 전역 등록
    console.log("✅ 현재 로그인한 사용자 정보:", window.currentUser);

    const picker = document.getElementById("editWeekPicker");
    const { start } = getCurrentWeekRange();
    picker.value = start;

    const year = new Date().getFullYear();
    fetchHolidayList(`/holidays?year=${year}`, (holidays) => {
        holidayList = holidays;
        loadEditData(start);
    });

    ["searchName", "searchEmpId"].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                onSearch();
            }
        });
    });
});

document.getElementById("editWeekPicker").addEventListener("change", function () {
    loadEditData(this.value);
});

// ✅ 전역 등록 (HTML 버튼에서 호출 가능하게 하기)
window.loadEditData = loadEditData;
window.loadEditData = loadEditData;
window.onSearch = onSearch;
