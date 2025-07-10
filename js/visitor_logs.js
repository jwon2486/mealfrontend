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
