document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/admin/excel_view");
    const rawData = await response.json();

    if (!Array.isArray(rawData) || rawData.length === 0) {
      alert("표시할 식사신청 데이터가 없습니다.");
      return;
    }

    // 날짜 목록 추출 및 정렬
    const dates = [...new Set(rawData.map(row => row["식사일자"]))].sort();

    // 사용자 기준 데이터 묶기: {이름|부서|구분: {2025-06-01: [조식, 중식], ...}}
    const userMap = {};
    rawData.forEach(row => {
      const key = `${row["이름"]}|${row["부서"]}|${row["구분"]}`;
      if (!userMap[key]) userMap[key] = {};
      if (!userMap[key][row["식사일자"]]) userMap[key][row["식사일자"]] = new Set();
      userMap[key][row["식사일자"]].add(row["식사구분"]);
    });

    // 테이블 요소
    const thead = document.querySelector("#table-head");
    const tbody = document.querySelector("#edit-body");

    // 1단 헤더: 날짜 (colspan=3)
    const topRow = document.createElement("tr");
    topRow.innerHTML = `<th rowspan="2">부서</th><th rowspan="2">이름</th><th rowspan="2">구분</th>`;
    dates.forEach(date => {
      topRow.innerHTML += `<th colspan="3">${formatDateWithDay(date)}</th>`;
    });
    thead.appendChild(topRow);

    // 2단 헤더: 조/중/석
    const subRow = document.createElement("tr");
    dates.forEach(() => {
      subRow.innerHTML += "<th>조식</th><th>중식</th><th>석식</th>";
    });
    thead.appendChild(subRow);

    // 데이터 렌더링
    Object.entries(userMap).forEach(([key, mealMap]) => {
      const [name, dept, type] = key.split("|");
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${dept}</td><td>${name}</td><td>${type}</td>`;

      dates.forEach(date => {
        const set = mealMap[date] || new Set();
        ["조식", "중식", "석식"].forEach(meal => {
          const td = document.createElement("td");
          td.textContent = set.has(meal) ? "✅" : "❌";
          tr.appendChild(td);
        });
      });

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("❌ 데이터 불러오기 실패:", error);
    alert("서버로부터 데이터를 불러올 수 없습니다.");
  }
});

function formatDateWithDay(dateString) {
  const date = new Date(dateString);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const day = weekdays[date.getDay()];
  const formatted = date.toISOString().slice(5, 10).replace("-", "/");
  return `${formatted}(${day})`;
}
