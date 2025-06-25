
let holidayList = [];  // 서버에서 불러온 공휴일 날짜 배열
let editMode = "apply"; 

function formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const day = weekdays[date.getDay()];
    return `${dateStr} (${day})`;
}

// ✅ 서버에서 식수 신청 내역 조회 (관리자용)
function loadEditData(selectedWeek) {
    editMode = "apply";  // ✅ 신청자 모드 설정
    const range = selectedWeek ? getWeekRange(selectedWeek) : getCurrentWeekRange();
    const { start, end } = range;

    if (!range) {
        alert("❗ 주간 날짜가 지정되지 않았습니다.");
        return;
    }

    const url = `/admin/meals?start=${start}&end=${end}&mode=${editMode}`;  // ✅ mode=apply 추가!


    getData(url, (flatData) => {
        console.log("✅ 서버에서 받은 data:", flatData);
        console.log("📌 flatData type:", typeof flatData);
        console.log("📌 flatData length:", flatData.length);

        try {

            if (!Array.isArray(flatData)) {
                // 만약 flatData가 { data: [...] } 형태라면
                if (Array.isArray(flatData.data)) {
                    flatData = flatData.data; // 내부 배열로 교체
                } else {
                    console.error("❌ 예상하지 못한 응답 형식:", flatData);
                    alert("❌ 서버 응답 형식이 예상과 다릅니다.");
                    return;
                }
            }

            // ✅ 기존 테이블 초기화 명확히!
            document.getElementById("edit-body").innerHTML = "";
            document.getElementById("table-head").innerHTML = "";
            
            
            const grouped = {};
            flatData.forEach(entry => {
                if (!entry.user_id || !entry.name || !entry.dept || !entry.date) {
                    console.warn("⚠️ 누락된 필드:", entry);
                    return;
                }

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

            generateTableHeader(dates);
            generateTableBody(dates, groupedValues);
            updateSummary(groupedValues, dates);

            filterEditData();  // ✅ 필터 적용 추가

            // if (groupedValues.length > 0) {
            //     updateSummary(groupedValues, dates);
            // } else {
            //     console.warn("📭 불러온 데이터가 없습니다.");
            // }

        } catch (e) {
            console.error("📛 데이터 처리 중 오류:", e);
            alert("❌ 데이터 처리 중 문제가 발생했습니다.");
        }
    }, (err) => {
        // ✅ 메시지를 좀 더 정제
        alert("❌ 서버에서 데이터를 가져오지 못했습니다.");
        console.error("❌ GET 요청 실패:", err);
    });

}

// ✅ 테이블 헤더 생성
function generateTableHeader(dates) {
    const thead = document.getElementById("table-head");
    thead.innerHTML = "";

    const topRow = document.createElement("tr");
    
    topRow.innerHTML = `<th rowspan="2">부서</th><th rowspan="2">사번</th><th rowspan="2">이름</th>`;
    
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
function generateTableBody(dates, data) {
    const tbody = document.getElementById("edit-body");
    tbody.innerHTML = "";

    data.forEach(emp => {
        const tr = document.createElement("tr");

        // 부서 / 사번 / 이름 셀
        tr.innerHTML = `<td>${emp.dept}</td><td>${emp.id}</td><td>${emp.name}</td>`;

        dates.forEach(date => {
            const meal = emp.meals[date] || {};
            ["조식", "중식", "석식"].forEach(type => {
                const key = type === "조식" ? "breakfast" : type === "중식" ? "lunch" : "dinner";
                const selected = meal[key] === true;

                // ✅ 버튼 생성
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

                // ✅ 🔽 여기에 "공휴일/마감시간" 로직 삽입 🔽
                const isHoliday = holidayList.includes(normalizeDate(date));

                if (isHoliday) {
                    btn.style.backgroundColor = "#ffe6e6";
                    btn.style.color = "#cc0000";
                    btn.disabled = false;
                    btn.title = "공휴일에는 신청할 수 없습니다.";
                    btn.onclick = () => alert("⛔ 공휴일에는 신청할 수 없습니다.");
                }
                else if (isDeadlinePassed(date, type)) {
                    btn.style.backgroundColor = "#ccc";
                    btn.style.color = "#666";
                    btn.title = "신청 마감됨";
                    btn.onclick = () => alert(`${type}은 신청 마감 시간이 지났습니다.`);
                }
                else {
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

    const rows = document.querySelectorAll("#edit-body tr");
    rows.forEach(row => {
        const deptVal = row.children[0].innerText.toLowerCase();
        const idVal = row.children[1].innerText.toLowerCase();
        const nameVal = row.children[2].innerText.toLowerCase();

        const show = (!dept || deptVal.includes(dept)) &&
                     (!id || idVal.includes(id)) &&
                     (!name || nameVal.includes(name));

        row.style.display = show ? "" : "none";
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

// ✅ 마감 여부 판단 함수 (조식/중식/석식)
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
    const { start } = getCurrentWeekRange();
    picker.value = start;
    
    const year = new Date().getFullYear();
    const holidayApiUrl = `/holidays?year=${year}`;

    fetchHolidayList(holidayApiUrl, (holidays) => {
        holidayList = holidays;
        loadEditData(start);  // 공휴일 불러온 후 실행
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
function loadAllEmployeesForEdit(selectedWeek = null) {
    editMode = "all";  // ✅ 전체 모드 설정
    const range = selectedWeek ? getWeekRange(selectedWeek) : getCurrentWeekRange();
    const { start, end } = range;

    const url = `/admin/meals?start=${start}&end=${end}&mode=${editMode}`;  // ✅ 추가 파라미터 사용

    getData(url, (response) => {
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
        
        
        generateTableHeader(dates);
        generateTableBody(dates, groupedValues);
        updateSummary(groupedValues, dates);

        // ✅ 필터 자동 적용
        filterEditData();

    }, (err) => {
        console.error("❌ 전체보기 실패:", err);
        alert("❌ 전체 데이터를 불러오지 못했습니다.");
    });
}