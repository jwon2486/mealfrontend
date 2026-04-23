function loadDeptVisitorLogs() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  const dept = user.dept;
  const name = document.getElementById("logName").value.trim();
  let start = document.getElementById("logStartDate").value;
  let end = document.getElementById("logEndDate").value;

  if (!start || !end) {
    const week = getCurrentWeekRange();
    start = week.start;
    end = week.end;
    document.getElementById("logStartDate").value = start;
    document.getElementById("logEndDate").value = end;
  }

  const url = `/admin/visitor_logs?start=${start}&end=${end}&dept=${dept}&name=${name}`;
  const container = document.getElementById("dept-log-body");
  container.innerHTML = "";

  getData(url, (logs) => {
    if (!logs || logs.length === 0) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center;">📭 로그 없음</td></tr>`;
      return;
    }

    logs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    logs.forEach(row => {
      const before = `조식(${row.before_breakfast}), 중식(${row.before_lunch}), 석식(${row.before_dinner})`;
      const after = `조식(${row.breakfast}), 중식(${row.lunch}), 석식(${row.dinner})`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.dept || "-"}</td>
        <td>${row.applicant_name}</td>
        <td>${before}</td>
        <td>${after}</td>
        <td>${formatToKoreanTime(row.updated_at)}</td>
      `;
      container.appendChild(tr);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const { start, end } = getCurrentWeekRange();
  document.getElementById("logStartDate").value = start;
  document.getElementById("logEndDate").value = end;

  loadDeptVisitorLogs();
});

/**
 * ISO 형식의 날짜 문자열을 한국 시간 형식(YYYY-MM-DD HH:mm:ss)으로 변환하는 함수
 */
function formatToKoreanTime(dateStr) {
    if (!dateStr) return "-";
    
    const date = new Date(dateStr);
    
    // 유효하지 않은 날짜인 경우 처리
    if (isNaN(date.getTime())) return "-"; 

    return date.toLocaleString("ko-KR", { 
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false // 24시간제로 표시하려면 false, 오전/오후로 표시하려면 true
    });
}
