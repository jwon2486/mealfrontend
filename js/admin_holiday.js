// admin_holiday.js 리팩토링 버전: 공공 공휴일 API 병합 및 공휴일 설명 입력 지원

let apiHolidayList = [];
let customHolidayList = [];
let currentHolidayDetail = [];
let currentHolidays = [];
// admin_holiday.js 상단에 추가
const HOLIDAY_API_BASE_URL = "https://mealbackend-cmub.onrender.com";

// 초기 실행
window.addEventListener("DOMContentLoaded", () => {
  populateYearSelector();
  const year = new Date().getFullYear();
  document.getElementById("yearSelector").value = year;
  loadHolidays(year);
});

function populateYearSelector() {
  const selector = document.getElementById("yearSelector");
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 3; y <= thisYear + 3; y++) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = `${y}년`;
    selector.appendChild(option);
  }
}

function updateCalendar() {
  const year = document.getElementById("yearSelector").value;
  loadHolidays(year);
}

async function loadHolidays(year) {
  const [apiList, customList] = await Promise.all([
    fetchPublicHolidays(year),
    getData(`/holidays?year=${year}`)
  ]);

  apiHolidayList = apiList.map(h => ({ ...h, source: 'api' }));
  customHolidayList = customList.map(h => ({ ...h, source: 'custom' }));

  const apiDates = new Set(apiHolidayList.map(h => h.date));
  const filteredCustom = customHolidayList.filter(h => !apiDates.has(h.date));

  const merged = [...apiHolidayList, ...filteredCustom];
  currentHolidayDetail = merged;
  currentHolidays = merged.map(h => h.date);

  renderCalendar(year);
  renderHolidayList(merged);
}

async function fetchPublicHolidays(year) {
  try {
    const res = await fetch(`${HOLIDAY_API_BASE_URL}/api/public-holidays?year=${year}`);
    const data = await res.json();

    // 응답이 배열인지 확인 (보통: [{date: "2025-08-15", description: "광복절"}, ...])
    if (!Array.isArray(data)) {
      console.warn("❗ 공공 공휴일 응답 형식 이상", data);
      return [];
    }

    return data.map(h => ({
      date: h.date,
      description: h.description || "공휴일"
    }));
  } catch (err) {
    console.warn(`❗ 공공 공휴일 호출 실패 (${year})`, err);
    return [];
  }
}
function renderCalendar(year) {
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
    for (let i = 0; i < firstDay; i++) row.appendChild(document.createElement("td"));

    for (let date = 1; date <= lastDate; date++) {
      const td = document.createElement("td");
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      td.innerText = date;
      td.setAttribute("data-date", dateStr);

      if (new Date(year, month, date).getDay() === 0) td.classList.add("sunday");
      if (currentHolidays.includes(dateStr)) td.classList.add("holiday");

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

function addHoliday() {
  const date = document.getElementById("holidayPicker").value;
  const description = document.getElementById("holidayDescription").value || "공휴일";

  if (!date) return alert("날짜를 선택하세요!");
  const isAPIDuplicate = apiHolidayList.some(h => h.date === date);
  if (isAPIDuplicate) return alert("공공데이터 공휴일과 중복되어 등록할 수 없습니다.");

  const isCustomDuplicate = customHolidayList.some(h => h.date === date);
  if (isCustomDuplicate) return alert("이미 등록된 수동 공휴일입니다.");

  postData("/holidays", { date, description },
    () => {
      loadHolidays(new Date(date).getFullYear());
      document.getElementById("holidayPicker").value = "";
      document.getElementById("holidayDescription").value = "";
      showToast("✅ 공휴일 추가 완료");
    },
    err => showToast("❌ 추가 실패: " + err.message)
  );
}

function deleteHoliday(date) {
  if (!confirm(`${date} 공휴일을 삭제하시겠습니까?`)) return;
  deleteData(`/holidays?date=${date}`,
    () => {
      loadHolidays(new Date(date).getFullYear());
      showToast("🗑 삭제 완료");
    }
  );
}

function renderHolidayList(holidays) {
  const list = document.getElementById("holidayItems");
  list.innerHTML = "";

  holidays.forEach(h => {
    const item = document.createElement("div");
    item.className = "holiday-item";
    item.innerHTML = `
      <span>${h.date} (${h.description})</span>
      ${h.source === 'custom' ? `<button onclick="deleteHoliday('${h.date}')">삭제</button>` : '<span class="readonly">공공</span>'}
    `;
    list.appendChild(item);
  });
}
