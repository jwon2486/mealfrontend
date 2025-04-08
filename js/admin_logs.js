// admin_logs.js
function loadLogs() {
    const start = document.getElementById("logStartDate").value;
    const end = document.getElementById("logEndDate").value;
    const name = document.getElementById("logEmpName").value.trim();
    const dept = document.getElementById("logEmpDept").value.trim();
  
    if (!start || !end) {
      const week = getCurrentWeekRange();
      start = week.start;
      end = week.end;
      document.getElementById("logStartDate").value = start;
      document.getElementById("logEndDate").value = end;
    }
  
    const url = `/admin/logs?start=${start}&end=${end}&name=${name}&dept=${dept}`;
    getData(url, renderLogs, (err) => {
      console.error("❌ 로그 조회 실패:", err);
      showToast("❌ 로그를 불러오는 중 오류 발생");
    });
  }
  
  function renderLogs(logs) {
    const tbody = document.getElementById("log-body");
    tbody.innerHTML = "";
  
    if (!Array.isArray(logs) || logs.length === 0) {
      const row = `<tr><td colspan="7" style="text-align:center;">🔍 해당 조건에 해당하는 로그가 없습니다.</td></tr>`;
      tbody.innerHTML = row;
      showToast("❗ 해당 조건에 해당하는 로그가 없습니다.");
      // return;
    }

    // ✅ 날짜 기준 오름차순 정렬 추가
    logs.sort((a, b) => new Date(a.date) - new Date(b.date));
  
    logs.forEach(log => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${log.date}</td>
        <td>${translateMealType(log.meal_type)}</td>
        <td>${log.dept || "-"}</td>
        <td>${log.name || "-"}</td>
        <td>${log.before_status === 1 ? "✅ 신청" : "❌ 미신청"}</td>
        <td>${log.after_status === 1 ? "✅ 신청" : "❌ 미신청"}</td>
        <td>${log.changed_at || "-"}</td>
      `;
      tbody.appendChild(row);
    });
  }

function translateMealType(type) {
    if (type === "breakfast") return "조식";
    if (type === "lunch") return "중식";
    if (type === "dinner") return "석식";
    return type;
}

function downloadExcel() {
  const start = document.getElementById("logStartDate").value;
  const end = document.getElementById("logEndDate").value;
  const name = document.getElementById("logEmpName").value || "";
  const dept = document.getElementById("logEmpDept").value || "";

  if (!start || !end) {
    alert("📅 시작일과 종료일을 입력하세요.");
    return;
  }

  const url = `/admin/logs/download?start=${start}&end=${end}&name=${name}&dept=${dept}`;
  window.open(url, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
    const { start, end } = getCurrentWeekRange(); // 📌 util.js 함수 사용
    document.getElementById("logStartDate").value = start;
    document.getElementById("logEndDate").value = end;
    loadLogs();
});
  