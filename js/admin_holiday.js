document.addEventListener("DOMContentLoaded", () => {
  const year = new Date().getFullYear();
  loadHolidays(year);
});

let currentHolidayDetail = [];
let currentHolidays = [];

async function loadHolidays(year) {
  try {
    const apiList = await fetchPublicHolidays(year);
    const customList = await new Promise((resolve, reject) => {
      getData(`/holidays?year=${year}`, resolve, reject);
    });

    const apiHolidayList = Array.isArray(apiList)
      ? apiList.map(h => ({ ...h, source: 'api' }))
      : [];

    const customHolidayList = Array.isArray(customList)
      ? customList.map(h => ({ ...h, source: 'custom' }))
      : [];

    const apiDates = new Set(apiHolidayList.map(h => h.date));
    const filteredCustom = customHolidayList.filter(h => !apiDates.has(h.date));

    const merged = [...apiHolidayList, ...filteredCustom];

    currentHolidayDetail = merged;
    currentHolidays = merged.map(h => h.date);

    renderCalendar(year);
    renderHolidayList(merged);

  } catch (error) {
    console.error("🚨 loadHolidays 에러:", error);
  }
}

//자동 공휴일목록 호출 함수
async function fetchPublicHolidays(year) {
  try {
    const response = await fetch(`https://mealbackend-cmub.onrender.com/api/public-holidays?year=${year}`);
    if (!response.ok) {
      throw new Error(`HTTP 오류! 상태: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`❗ 공공 공휴일 호출 실패 (${year})`, err);
    return [];
  }
}

//달력 그리기 함수
function renderCalendar(year) {
  console.log("📅 달력 호출됨:", year);
  const wrapper = document.getElementById("calendar-wrapper");
  wrapper.innerHTML = "";

  for (let month = 0; month < 12; month++) {
    const table = document.createElement("table");
    table.className = "month-calendar";

    const caption = document.createElement("caption");
    caption.innerText = `${month + 1}월`;
    table.appendChild(caption);

    const thead = document.createElement("thead");
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const headRow = document.createElement("tr");
    days.forEach(d => {
      const th = document.createElement("th");
      th.innerText = d;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let row = document.createElement("tr");

    for (let i = 0; i < firstDay; i++) {
      row.appendChild(document.createElement("td"));
    }

    for (let date = 1; date <= lastDate; date++) {
      const td = document.createElement("td");
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      td.innerText = date;

      const dayOfWeek = new Date(year, month, date).getDay();
      if (dayOfWeek === 0) td.classList.add("sunday");

      if (currentHolidays.includes(dateStr)) {
        td.classList.add("holiday");

        const h = currentHolidayDetail.find(h => h.date === dateStr);
        if (h) td.title = h.description;
      }

      row.appendChild(td);

      if ((firstDay + date) % 7 === 0 || date === lastDate) {
        tbody.appendChild(row);
        row = document.createElement("tr");
      }
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
  }
}

//공휴일 수동 추가 함수
async function addHoliday() {
  const dateInput = document.getElementById("holidayPicker");
  const descInput = document.getElementById("holidayDescription");

  const date = dateInput.value;
  const description = descInput.value.trim();

  if (!date) {
    alert("📅 날짜를 선택하세요.");
    return;
  }
  if (!description) {
    alert("📝 설명을 입력하세요.");
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      postData("/holidays", { date, description }, resolve, reject);
    });

    alert("✅ 공휴일이 추가되었습니다.");
    const year = new Date(date).getFullYear();
    loadHolidays(year);

    // 입력창 초기화
    dateInput.value = "";
    descInput.value = "";
  } catch (err) {
    console.error("🚨 공휴일 추가 실패:", err);
    alert("❌ 공휴일 추가 중 오류가 발생했습니다.");
  }
}

//공휴일 삭제 함수
async function deleteHoliday(date) {
  if (!confirm(`📅 ${date} 공휴일을 삭제하시겠습니까?`)) return;

  try {
    await new Promise((resolve, reject) => {
      deleteData(`/holidays?date=${date}`, resolve, reject); 
    });

    alert("🗑 공휴일이 삭제되었습니다.");
    const year = new Date(date).getFullYear();
    loadHolidays(year); // 삭제 후 목록 새로고침
  } catch (err) {
    console.error("🚨 공휴일 삭제 실패:", err);
    alert("❌ 공휴일 삭제 중 오류가 발생했습니다.");
  }
}



//공휴일 렌더링 함수
function renderHolidayList(holidayList) {
  console.log("📋 공휴일 정보 호출됨:", holidayList.length, "건");
  const container = document.getElementById("holiday-list");
  container.innerHTML = ""; // 초기화

  if (!Array.isArray(holidayList) || holidayList.length === 0) {
    container.innerHTML = "<p>📭 표시할 공휴일이 없습니다.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "holiday-list-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>날짜</th>
      <th>설명</th>
      <th>구분</th>
      <th>조작</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  holidayList.forEach(h => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.innerText = h.date;

    const tdDesc = document.createElement("td");
    tdDesc.innerText = h.description;

    const tdSource = document.createElement("td");
    tdSource.innerText = h.source === "custom" ? "수동" : "공공";

    const tdAction = document.createElement("td");
    if (h.source === "custom") {
      const btn = document.createElement("button");
      btn.innerText = "삭제";
      btn.onclick = () => deleteHoliday(h.date);
      tdAction.appendChild(btn);
    } else {
      tdAction.innerText = "-";
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdDesc);
    tr.appendChild(tdSource);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}


