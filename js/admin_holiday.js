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

async function fetchPublicHolidays(year) {
  try {
    const response = await fetch(`/api/public-holidays?year=${year}`);
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

function renderCalendar(year) {
  // 캘린더 렌더링 함수
  console.log("📅 캘린더 렌더링 시작: ", year);
}

function renderHolidayList(holidayList) {
  // 공휴일 리스트 출력
  console.log("📌 공휴일 리스트:", holidayList);
}
