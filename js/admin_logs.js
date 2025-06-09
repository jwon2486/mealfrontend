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
        <td>${formatToKoreanTime(log.changed_at)}</td> 
      `; //formatToKoreanTime: 데이터 저장 시간을 한국시간으로 표시
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

  const url = `${API_BASE_URL}/admin/logs/download?start=${start}&end=${end}&name=${name}&dept=${dept}`;
  window.open(url, "_blank");
}

// ✅ 방문자/협력사 로그 조회
function loadVisitorLogs() {
  
  let start = document.getElementById("logVisitorStartDate").value;
  let end = document.getElementById("logVisitorEndDate").value;
  const name = document.getElementById("logVisitorEmpName").value.trim();
  const dept = document.getElementById("logVisitorEmpDept").value.trim();
  const type = document.getElementById("logVisitorType").value;

  // 📌 기본값: 이번 주 월~금
  if (!start || !end) {
      const week = getCurrentWeekRange();
      start = week.start;
      end = week.end;
      document.getElementById("logVisitorStartDate").value = start;
      document.getElementById("logVisitorEndDate").value = end;
  }

  const url = `/admin/visitor_logs?start=${start}&end=${end}&name=${name}&dept=${dept}&type=${type}`;
  const container = document.getElementById("visitor-log-body");
  container.innerHTML = "";

  getData(url, (data) => {
    if (!data || data.length === 0) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center;">조회된 로그가 없습니다.</td></tr>`;
      return;
    }

    data.forEach(row => {
      const beforeStatus = `조식(${row.before_breakfast}), 중식(${row.before_lunch}), 석식(${row.before_dinner})`;
      const afterStatus = `조식(${row.breakfast}), 중식(${row.lunch}), 석식(${row.dinner})`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.dept || "-"}</td>
        <td>${row.applicant_name}</td>
        <td>${beforeStatus}</td>
        <td>${afterStatus}</td>
        <td>${formatToKoreanTime(row.updated_at)}</td>
      `;
      container.appendChild(tr);
    });
  });
}

function downloadVisitorExcel() {
  const start = document.getElementById("logVisitorStartDate").value;
  const end = document.getElementById("logVisitorEndDate").value;
  const name = document.getElementById("logVisitorEmpName").value || "";
  const dept = document.getElementById("logVisitorEmpDept").value || "";
  const type = document.getElementById("logVisitorType").value || "";

  if (!start || !end) {
    alert("📅 시작일과 종료일을 입력하세요.");
    return;
  }

  const url = `${API_BASE_URL}/admin/visitor_logs/download?start=${start}&end=${end}&name=${name}&dept=${dept}&type=${type}`;
  window.open(url, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
    const { start, end } = getCurrentWeekRange(); // 📌 util.js 함수 사용
    
    // 일반 로그 초기값
    document.getElementById("logStartDate").value = start;
    document.getElementById("logEndDate").value = end;

    // 방문자 로그 초기값
    document.getElementById("logVisitorStartDate").value = start;
    document.getElementById("logVisitorEndDate").value = end;

    loadLogs();
    loadVisitorLogs();
});

//프론트엔드 시간값 보정 함수
function formatToKoreanTime(datetimeStr) {
    if (!datetimeStr) return "-";
    const date = new Date(datetimeStr.replace(' ', 'T') + 'Z');
    return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
