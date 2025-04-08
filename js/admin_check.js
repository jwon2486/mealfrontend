let holidayList = [];

// ✅ 주말(토,일) 제외한 날짜 리스트 생성
function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // 주말 제외
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ✅ 현재 주 월~금 범위 반환
function getCurrentWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    start: monday.toISOString().split("T")[0],
    end: friday.toISOString().split("T")[0]
  };
}

// ✅ 요일 포함 날짜 포맷
function formatDateWithDay(dateStr) {
  const date = new Date(dateStr);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const day = weekdays[date.getDay()];
  return `${dateStr} (${day})`;
}

// ✅ 테이블 헤더 생성 (공휴일 강조)
function generateTableHeader(dates) {
  const thead = document.getElementById("table-head");
  thead.innerHTML = "";

  const topRow = document.createElement("tr");
  topRow.innerHTML = `<th rowspan="2">부서</th><th rowspan="2">사번</th><th rowspan="2">이름</th>`;

  dates.forEach(date => {
    const isHoliday = holidayList.includes(normalizeDate(date));
    const formattedDate = formatDateWithDay(date);

    if (isHoliday) {
      topRow.innerHTML += `<th colspan="3" class="holiday-header">${formattedDate}</th>`;
    } else {
      topRow.innerHTML += `<th colspan="3">${formattedDate}</th>`;
    }
    //const style = isHoliday ? 'style="color:red; background-color:#ffe6e6;"' : '';
    //topRow.innerHTML += `<th colspan="3" ${style}>${formatDateWithDay(date)}</th>`;
  });

  const subRow = document.createElement("tr");
  dates.forEach(date => {
    const isHoliday = holidayList.includes(normalizeDate(date));
    if (isHoliday) {
      subRow.innerHTML += `
        <th class="holiday-header">조식</th>
        <th class="holiday-header">중식</th>
        <th class="holiday-header">석식</th>
      `;
    } else {
      subRow.innerHTML += `<th>조식</th><th>중식</th><th>석식</th>`;
    }
        
    //const style = isHoliday ? 'style="color:red; background-color:#ffe6e6;"' : '';
    //subRow.innerHTML += `<th ${style}>조식</th><th ${style}>중식</th><th ${style}>석식</th>`;
  });

  thead.appendChild(topRow);
  thead.appendChild(subRow);
}

// ✅ 본문 테이블 생성
function generateTableBody(dates, data) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  data.forEach(emp => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${emp.dept}</td><td>${emp.id}</td><td>${emp.name}</td>`;

    dates.forEach(date => {
      const meal = emp.meals[date] || {};
      row.innerHTML += `
        <td>${meal.breakfast ? "✅" : "❌"}</td>
        <td>${meal.lunch ? "✅" : "❌"}</td>
        <td>${meal.dinner ? "✅" : "❌"}</td>
      `;
    });

    tbody.appendChild(row);
  });
}

// ✅ 신청 통계 업데이트
function updateSummary(data, dates) {
  let people = data.length;
  let breakfast = 0, lunch = 0, dinner = 0;

  data.forEach(emp => {
    dates.forEach(date => {
      const meal = emp.meals[date] || {};
      if (meal.breakfast) breakfast++;
      if (meal.lunch) lunch++;
      if (meal.dinner) dinner++;
    });
  });

  document.getElementById("totalPeople").innerText = people;
  document.getElementById("totalBreakfast").innerText = breakfast;
  document.getElementById("totalLunch").innerText = lunch;
  document.getElementById("totalDinner").innerText = dinner;
}

// ✅ 관리자 신청내역 조회
function loadCheckData() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    alert("📅 조회할 기간을 선택하세요.");
    return;
  }

  const url = `/admin/meals?start=${start}&end=${end}`;

  getData(url, (flatData) => {
    const dates = getDateRange(new Date(start), new Date(end)); // 주말 제외
    generateTableHeader(dates);

    const grouped = {};
    flatData.forEach(entry => {
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

    const structured = Object.values(grouped);
    generateTableBody(dates, structured);
    updateSummary(structured, dates);
  }, (err) => {
    console.error("불러오기 실패:", err);
    alert("❌ 데이터를 불러오지 못했습니다.");
  });
}

// ✅ 엑셀 다운로드
function downloadExcel() {
  const table = document.getElementById("check-table");
  const tableHtml = table.outerHTML.replace(/ /g, '%20');
  const filename = `식수신청내역_${new Date().toISOString().split("T")[0]}.xls`;

  const link = document.createElement("a");
  link.href = 'data:application/vnd.ms-excel,' + tableHtml;
  link.download = filename;
  link.click();
}

// ✅ 필터 기능
function filterCheckData() {
  const dept = document.getElementById("filterDept").value.trim().toLowerCase();
  const id = document.getElementById("filterId").value.trim().toLowerCase();
  const name = document.getElementById("filterName").value.trim().toLowerCase();

  document.querySelectorAll("#table-body tr").forEach(row => {
    const rowDept = row.children[0].innerText.toLowerCase();
    const rowId = row.children[1].innerText.toLowerCase();
    const rowName = row.children[2].innerText.toLowerCase();

    const visible =
      (!dept || rowDept.includes(dept)) &&
      (!id || rowId.includes(id)) &&
      (!name || rowName.includes(name));

    row.style.display = visible ? "" : "none";
  });
}

// ✅ 필터 초기화
function resetFilter() {
  document.getElementById("filterDept").value = "";
  document.getElementById("filterId").value = "";
  document.getElementById("filterName").value = "";
  filterCheckData();
}

// ✅ 최초 로드 시: 공휴일 받아오고, 금주 조회 실행
document.addEventListener("DOMContentLoaded", () => {
  const range = getCurrentWeekRange();
  document.getElementById("startDate").value = range.start;
  document.getElementById("endDate").value = range.end;

  const year = new Date().getFullYear();
  fetchHolidayList(`holidays?year=${year}`, (holidays) => {
    holidayList = holidays;
    loadCheckData();  // 공휴일 받아온 후 조회
  });
});

/*
// 예시용 더미 데이터
const dummyData = [
  {
    dept: "영업부", id: "1001", name: "홍길동",
    meals: {
      "2024-05-06": { breakfast: true, lunch: false, dinner: true },
      "2024-05-07": { breakfast: true, lunch: true, dinner: false }
    }
  },
  {
    dept: "생산팀", id: "1002", name: "이순신",
    meals: {
      "2024-05-06": { breakfast: false, lunch: true, dinner: true },
      "2024-05-07": { breakfast: false, lunch: false, dinner: false }
    }
  }
];

let holidayList = []; 

// ✅ 선택한 기간의 날짜 배열 생성
function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // 0 = 일, 6 = 토
      const dateStr = current.toISOString().split('T')[0];
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ✅ 현재 주 월~금 범위 반환
function getCurrentWeekRange() {
  const today = new Date();
  const day = today.getDay(); // 0(일) ~ 6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: monday.toISOString().split('T')[0],
    end: friday.toISOString().split('T')[0]
  };
}

// 날짜 포맷 변환 (YYYY-MM-DD → YYYY-MM-DD (요일))
function formatDateWithDay(dateStr) {
  const date = new Date(dateStr);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const day = weekdays[date.getDay()];
  return `${dateStr} (${day})`;
}

// 테이블 헤더 생성 (날짜 + 요일 표시)
function generateTableHeader(dates) {
  const thead = document.getElementById("table-head");
  thead.innerHTML = "";

  const topRow = document.createElement("tr");
  topRow.innerHTML = `<th rowspan="2">부서</th><th rowspan="2">사번</th><th rowspan="2">이름</th>`;

  dates.forEach(date => {
    const isHoliday = holidayList.includes(normalizeDate(date));
    const style = isHoliday ? 'style="color:red; background-color: #ffe6e6;"' : '';
    //const formattedDate = formatDateWithDay(date);
    topRow.innerHTML += `<th colspan="3" class="date-header" ${style}>${formattedDate}</th>`;
  });

  const subRow = document.createElement("tr");
  dates.forEach(() => {
    const isHoliday = holidayList.includes(normalizeDate(date));
    const style = isHoliday ? 'style="color:red; background-color: #ffe6e6;"' : '';
    subRow.innerHTML += `<th ${style}>조식</th><th ${style}>중식</th><th ${style}>석식</th>`;
  });

  thead.appendChild(topRow);
  thead.appendChild(subRow);
}

function generateTableBody(dates, data) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  data.forEach(emp => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${emp.dept}</td><td>${emp.id}</td><td>${emp.name}</td>`;

    dates.forEach(date => {
      const meal = emp.meals[date] || {};
      row.innerHTML += `
        <td>${meal.breakfast ? "✅" : "❌"}</td>
        <td>${meal.lunch ? "✅" : "❌"}</td>
        <td>${meal.dinner ? "✅" : "❌"}</td>
      `;
    });

    tbody.appendChild(row);
  });
}

function updateSummary(data, dates) {
  let people = data.length;
  let breakfast = 0, lunch = 0, dinner = 0;

  data.forEach(emp => {
    dates.forEach(date => {
      const meal = emp.meals[date] || {};
      if (meal.breakfast) breakfast++;
      if (meal.lunch) lunch++;
      if (meal.dinner) dinner++;
    });
  });

  document.getElementById("totalPeople").innerText = people;
  document.getElementById("totalBreakfast").innerText = breakfast;
  document.getElementById("totalLunch").innerText = lunch;
  document.getElementById("totalDinner").innerText = dinner;
}


// ✅ 관리자 신청 내역 조회 (API 호출)
// ⛳ GET /admin/meals?start=...&end=... → util.js의 getData() 사용
function loadCheckData() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    alert("📅 조회할 기간을 선택해 주세요.");
    return;
  }

  const url = `http://localhost:5000/admin/meals?start=${start}&end=${end}`;

  getData(url, (flatData) => {
    const dates = getDateRange(new Date(start), new Date(end));
    generateTableHeader(dates);

    // ✅ 응답 데이터를 사용자별로 그룹핑
    const grouped = {};
    flatData.forEach(entry => {
      const uid = entry.user_id;
      if (!grouped[uid]) {
        grouped[uid] = {
          id: entry.user_id,
          name: entry.name,
          dept: entry.dept,
          meals: {} // 날짜별 식수 신청 내역
        };
      }
      grouped[uid].meals[entry.date] = {
        breakfast: entry.breakfast === 1,
        lunch: entry.lunch === 1,
        dinner: entry.dinner === 1
      };
    });

    const structuredData = Object.values(grouped); // 배열로 변환
    generateTableBody(dates, structuredData); // 테이블 본문 생성
    updateSummary(structuredData, dates);      // 요약 정보 계산
  }, (err) => {
    console.error("불러오기 실패:", err);
    alert("❌ 데이터를 불러오지 못했습니다.");
  });
}


function downloadExcel() {
  const table = document.getElementById("check-table");
  const tableHtml = table.outerHTML.replace(/ /g, '%20');

  const filename = '식수신청내역_' + new Date().toISOString().split("T")[0] + '.xls';

  const downloadLink = document.createElement("a");
  document.body.appendChild(downloadLink);

  downloadLink.href = 'data:application/vnd.ms-excel,' + tableHtml;
  downloadLink.download = filename;
  downloadLink.click();

  document.body.removeChild(downloadLink);
}



function filterCheckData() {
  const deptFilter = document.getElementById("filterDept").value.trim().toLowerCase();
  const idFilter = document.getElementById("filterId").value.trim().toLowerCase();
  const nameFilter = document.getElementById("filterName").value.trim().toLowerCase();

  const rows = document.querySelectorAll("#table-body tr");

  rows.forEach(row => {
    const dept = row.children[0].innerText.toLowerCase();
    const id = row.children[1].innerText.toLowerCase();
    const name = row.children[2].innerText.toLowerCase();

    // ✅ 필터 항목이 비어있으면 통과, 값이 있으면 비교
    const matchDept = !deptFilter || dept.includes(deptFilter);
    const matchId = !idFilter || id.includes(idFilter);
    const matchName = !nameFilter || name.includes(nameFilter);

    if (matchDept && matchId && matchName) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function resetFilter() {
  document.getElementById("filterDept").value = "";
  document.getElementById("filterId").value = "";
  document.getElementById("filterName").value = "";
  filterCheckData(); // 필터 모두 해제됨
}

document.addEventListener("DOMContentLoaded", function () {
  const range = getCurrentWeekRange();
  document.getElementById("startDate").value = range.start;
  document.getElementById("endDate").value = range.end;

  const year = new Date().getFullYear();
  
  fetchHolidayList(`http://localhost:5000/holidays?year=${year}`, (holidays) => {
    holidayList = holidays;
    loadCheckData(); // 공휴일 정보 받아온 뒤에 조회 실행
  });

});
*/