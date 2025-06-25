// static/admin_dashboard.js

const chartInstances = {};  // canvasId → Chart 인스턴스 저장용

document.addEventListener("DOMContentLoaded", () => {
    // const today = new Date();
    // const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    // const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
    // document.getElementById("startDate").value = firstDay.toISOString().slice(0, 10);
    // document.getElementById("endDate").value = lastDay.toISOString().slice(0, 10);
  
    setDefaultDateRange();
    loadStats();
    loadGraphData(); // ✅ 그래프 데이터를 요청
    loadDeptStats();
    setDefaultWeeklyDate(); 
    loadWeeklyDeptStats();
  });
  
// ✅ 통계 조회 버튼 클릭 시
function loadStats() {
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;

    getData(`/admin/stats/period?start=${start}&end=${end}`, renderStats, (err) => {
        console.error("❌ 통계 불러오기 실패:", err);
        alert("❌ 통계를 불러올 수 없습니다. 콘솔 확인 바랍니다.");
    });
}
  
function renderStats(data) {
    const tbody = document.getElementById("stats-body");
    tbody.innerHTML = "";

    const weekGroups = {};  // ✅ 주간 단위로 그룹화
    let monthlyTotal = { breakfast: 0, lunch: 0, dinner: 0 };

    // ✅ 주간 단위로 그룹 나누기
    data.forEach(row => {
        const weekKey = getWeekKey(row.date);
        if (!weekGroups[weekKey]) {
            weekGroups[weekKey] = [];
        }
        weekGroups[weekKey].push(row);

        // 월간 누적
        monthlyTotal.breakfast += row.breakfast;
        monthlyTotal.lunch += row.lunch;
        monthlyTotal.dinner += row.dinner;
    });

    // ✅ 주간별로 출력 및 소계
    for (const [weekKey, rows] of Object.entries(weekGroups)) {
        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.className = "normal-row";
            tr.innerHTML = `
                <td>${row.date}</td>
                <td>${row.day}</td>
                <td>${row.breakfast}</td>
                <td>${row.lunch}</td>
                <td>${row.dinner}</td>
            `;
            tbody.appendChild(tr);
        });

        // ✅ 주간 소계
        const subtotal = rows.reduce((sum, r) => {
            sum.breakfast += r.breakfast;
            sum.lunch += r.lunch;
            sum.dinner += r.dinner;
            return sum;
        }, { breakfast: 0, lunch: 0, dinner: 0 });

        const subtotalRow = document.createElement("tr");
        subtotalRow.className = "subtotal-row";
        subtotalRow.innerHTML = `
            <td colspan="2">${weekKey} 소계</td>
            <td>${subtotal.breakfast}</td>
            <td>${subtotal.lunch}</td>
            <td>${subtotal.dinner}</td>
        `;
        tbody.appendChild(subtotalRow);
    }

    // ✅ 총계
    const totalRow = document.createElement("tr");
    totalRow.className = "total-row";
    totalRow.innerHTML = `
        <td colspan="2">기간별 총계</td>
        <td>${monthlyTotal.breakfast}</td>
        <td>${monthlyTotal.lunch}</td>
        <td>${monthlyTotal.dinner}</td>
    `;
    tbody.appendChild(totalRow);
}
  
  // 주차 key 생성 함수
function getWeekKey(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();

    // 주차 계산: ISO 주차 기준 (주 시작은 월요일)
    const jan4 = new Date(year, 0, 4);  // 1월 4일 (항상 1주차 포함)
    const dayOfWeek = jan4.getDay() || 7;  // 일요일 0 → 7 처리
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - dayOfWeek + 1);  // 1주차의 월요일

    const diff = (date - week1Start) / (1000 * 60 * 60 * 24);
    const weekNo = Math.floor(diff / 7) + 1;

    return `${year}-${weekNo.toString().padStart(2, '0')}주차`;
}

  // ✅ 기본 날짜를 "이번 달 1일 ~ 말일"로 설정
function setDefaultDateRange() {
    const now = getKSTDate();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const format = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    document.getElementById("startDate").value = format(first);
    document.getElementById("endDate").value = format(last);
}
  
function downloadStatsExcel() {
    showToast("📥 엑셀 다운로드 준비 중...");
    window.location.href = `${API_BASE_URL}/admin/stats/period/excel?start=${startDate.value}&end=${endDate.value}`;
}


// 📊 그래프 그리기용 함수
function loadGraphData() {
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;
  
    getData(`/admin/graph/week_trend?start=${start}&end=${end}`, (rawData) => {
    
        const data = groupDataByWeekAndMeal(rawData);  // ✅ 이걸 빠뜨렸었음
        drawLineGraph("graph-week-current", data.weekCurrent, "금주 신청 추이");
        drawLineGraph("graph-week-next", data.weekNext, "차주 신청 추이");
        drawLineGraph("graph-dow-average", data.dowAvg, "요일별 평균 신청");
        drawLineGraph("graph-weekly-trend", data.weekTrend, "주간별 신청 트렌드");
    }, (err) => {
      console.error("❌ 그래프 데이터 실패:", err);
      alert("❌ 그래프 데이터를 불러오는 데 실패했습니다.");
    });
}
  
  // 📈 꺾은선 그래프 그리기
function drawLineGraph(canvasId, data, title) {
    const ctx = document.getElementById(canvasId).getContext("2d");

    const labels = data.labels || [];
    const breakfast = data.breakfast || [];
    const lunch = data.lunch || [];
    const dinner = data.dinner || [];

    // ✅ 기존 차트 제거 (필수!)
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: "아침",
            data: breakfast,
            borderWidth: 2,
            fill: false
          },
          {
            label: "점심",
            data: lunch ,
            borderWidth: 2,
            fill: false
          },
          {
            label: "저녁",
            data: dinner,
            borderWidth: 2,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: title,
                font: {
                   size: 40,
                }
            },
            tooltip: {
                callbacks: {
                  label: function(context) {
                    return `${context.dataset.label}: ${context.formattedValue}`;
                  }
                }
            },
            legend: {
                position: 'right',
                labels: {
                  font: {
                    size: 20  // ✅ 범례 텍스트 크게
                  }
                }
            },
            datalabels: {
                color: '#000',
                anchor: 'end',
                align: 'top',
                font: {
                    weight: 'bold',
                    size: 20
                },
                formatter: (value) => value
            }
            
        },
        scales: {
            x: {
                ticks: {
                  font: {
                    size: 20  // ✅ X축 글자
                  }
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  font: {
                    size: 25  // ✅ Y축 글자
                  }
                }
            }
        }
      },
      plugins: [ChartDataLabels]  // ✅ 필수
      
    });

    // ✅ 생성된 차트 인스턴스를 저장
    chartInstances[canvasId] = chart;
}

function groupDataByWeekAndMeal(rawData) {
    const weekCurrent = {
        labels: ["월", "화", "수", "목", "금"],
        breakfast: [0, 0, 0, 0, 0],
        lunch: [0, 0, 0, 0, 0],
        dinner: [0, 0, 0, 0, 0]
      };
      
      const weekNext = {
        labels: ["월", "화", "수", "목", "금"],
        breakfast: [0, 0, 0, 0, 0],
        lunch: [0, 0, 0, 0, 0],
        dinner: [0, 0, 0, 0, 0]
      };


    const dowAvg = { labels: ["월", "화", "수", "목", "금"], breakfast: [0,0,0,0,0], lunch: [0,0,0,0,0], dinner: [0,0,0,0,0], count: [0,0,0,0,0] };
    
    
    const today = getKSTDate();
    const monday = getMonday(today);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    const weekGroup = {};  // 주차별 묶음
    const dateSet = new Set(); // ✅ [추가] 전체 날짜 수집용

    rawData.forEach(row => {
        const date = new Date(row.label);
        const dow = parseInt(row.weekday); // 0=일 ~ 6=토

        dateSet.add(row.label); // ✅ [추가] 전체 날짜 기록

        if (dow >= 1 && dow <= 5) {
            const idx = dow - 1;

            // 금주
            if (isInWeek(date, monday)) {
                weekCurrent.labels[idx] = getDayLabel(dow);
                weekCurrent.breakfast[idx] = row.breakfast;
                weekCurrent.lunch[idx] = row.lunch;
                weekCurrent.dinner[idx] = row.dinner;
            }

            // 차주
            if (isInWeek(date, nextMonday)) {
                weekNext.labels[idx] = getDayLabel(dow);
                weekNext.breakfast[idx] = row.breakfast;
                weekNext.lunch[idx] = row.lunch;
                weekNext.dinner[idx] = row.dinner;
            }

            // 요일 평균
            dowAvg.breakfast[idx] += row.breakfast;
            dowAvg.lunch[idx] += row.lunch;
            dowAvg.dinner[idx] += row.dinner;
            dowAvg.count[idx]++;
        }

        // 주간 트렌드
        const weekKey = getYearWeek(date);
        if (!weekGroup[weekKey]) {
            weekGroup[weekKey] = { breakfast: 0, lunch: 0, dinner: 0 };
        }
        weekGroup[weekKey].breakfast += row.breakfast;
        weekGroup[weekKey].lunch += row.lunch;
        weekGroup[weekKey].dinner += row.dinner;
    });

    // 요일 평균 계산
    const dowAverageResult = { labels: dowAvg.labels, breakfast: [], lunch: [], dinner: [] };

    for (let i = 0; i < 5; i++) {
        dowAverageResult.breakfast.push(dowAvg.count[i] ? Math.round(dowAvg.breakfast[i] / dowAvg.count[i]) : 0);
        dowAverageResult.lunch.push(dowAvg.count[i] ? Math.round(dowAvg.lunch[i] / dowAvg.count[i]) : 0);
        dowAverageResult.dinner.push(dowAvg.count[i] ? Math.round(dowAvg.dinner[i] / dowAvg.count[i]) : 0);
    }

     // ✅ [수정 시작] 빠진 주차 보정 포함한 주간 트렌드 처리
    const weekTrend = { labels: [], breakfast: [], lunch: [], dinner: [] };


    const weekKeysSet = new Set();
    if (dateSet.size > 0) {
        const sortedDates = Array.from(dateSet).sort();
        const startDate = new Date(sortedDates[0]);
        const endDate = new Date(sortedDates[sortedDates.length - 1]);

        let current = new Date(getMonday(startDate));
        const end = new Date(getMonday(endDate));
        end.setDate(end.getDate() + 7); // 마지막 주 포함

        while (current <= end) {
            const weekKey = getYearWeek(current);
            weekKeysSet.add(weekKey);
            current.setDate(current.getDate() + 7); // 다음 주
        }
    }

    const allWeeks = Array.from(weekKeysSet).sort();
    allWeeks.forEach(weekKey => {
        const entry = weekGroup[weekKey] || { breakfast: 0, lunch: 0, dinner: 0 };
        weekTrend.labels.push(weekKey);
        weekTrend.breakfast.push(entry.breakfast);
        weekTrend.lunch.push(entry.lunch);
        weekTrend.dinner.push(entry.dinner);
    });
    // ✅ [수정 끝]

    return {
        weekCurrent,
        weekNext,
        dowAvg: dowAverageResult,
        weekTrend
    };
}
  
// 날짜 → 요일 변환
function getDayLabel(day) {
    return ['일', '월', '화', '수', '목', '금', '토'][day];
}
  
// 해당 날짜가 포함된 주차 표시 (예: "2025-W14")
function getYearWeek(date) {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = Math.ceil((((d - week1) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

function isInWeek(date, monday) {
    const start = new Date(monday);
    const end = new Date(monday);
    end.setDate(start.getDate() + 5);
    return date >= start && date < end;
}

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function renderDeptStats(data) {
  const tbody = document.getElementById("dept-stats-body");
  tbody.innerHTML = "";

  const direct = [];
  const partner = [];
  const visitor = [];

  // ✅ 부서별 데이터 분리
  data.forEach(row => {
    const item = {
      dept: row.dept,
      breakfast: row.breakfast,
      lunch: row.lunch,
      dinner: row.dinner
    };
    if (row.type === "직영") {
      direct.push(item);
    } else if(row.type === "협력사"){
      partner.push(item);
    } else{
      visitor.push(item);
    }

  });

  // ✅ 정렬 함수
  const sortByDept = (a, b) => a.dept.localeCompare(b.dept);

  // ✅ 출력 및 누적 함수
  const renderRows = (rows, label) => {
    rows.sort(sortByDept).forEach(row => {
      const tr = document.createElement("tr");
      const total = row.breakfast + row.lunch + row.dinner;
      tr.innerHTML = `
        <td>${row.dept}</td>
        <td>${total}</td>
        <td>${row.breakfast}</td>
        <td>${row.lunch}</td>
        <td>${row.dinner}</td>
      `;
      tbody.appendChild(tr);
    });

    const subtotal = rows.reduce((sum, r) => ({
      breakfast: sum.breakfast + r.breakfast,
      lunch: sum.lunch + r.lunch,
      dinner: sum.dinner + r.dinner
    }), { breakfast: 0, lunch: 0, dinner: 0 });

    const tr = document.createElement("tr");
    tr.className = "subtotal-row";
    const total = subtotal.breakfast + subtotal.lunch + subtotal.dinner;
    tr.innerHTML = `
      <td>${label} 소계</td>
      <td>${total}</td>
      <td>${subtotal.breakfast}</td>
      <td>${subtotal.lunch}</td>
      <td>${subtotal.dinner}</td>
    `;
    tbody.appendChild(tr);

    return subtotal;
  };

  // ✅ 렌더링 순서대로 실행
  const subDirect = renderRows(direct, "직영");
  const subPartner = renderRows(partner, "협력사");
  const subVisitor = renderRows(visitor, "방문자");

  // ✅ 총계
  const tr = document.createElement("tr");
  tr.className = "total-row";
  const total = subDirect.breakfast + subPartner.breakfast + subVisitor.breakfast +
                subDirect.lunch + subPartner.lunch + subVisitor.lunch +
                subDirect.dinner + subPartner.dinner + subVisitor.dinner;

  tr.innerHTML = `
    <td>총계</td>
    <td>${total}</td>
    <td>${subDirect.breakfast + subPartner.breakfast + subVisitor.breakfast}</td>
    <td>${subDirect.lunch + subPartner.lunch + subVisitor.lunch}</td>
    <td>${subDirect.dinner + subPartner.dinner + subVisitor.dinner}</td>
  `;
  tbody.appendChild(tr);
}

// ✅ 부서별 신청현황 로딩 함수 (html의 버튼에서 호출됨)
function loadDeptStats() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    alert("시작일과 종료일을 선택해주세요.");
    return;
  }

  getData(`/admin/stats/dept_summary?start=${start}&end=${end}`, renderDeptStats, (err) => {
    console.error("❌ 부서별 신청현황 불러오기 실패:", err);
    alert("❌ 부서별 신청현황 데이터를 불러오는 데 실패했습니다.");
  });
}

function downloadDeptStatsExcel() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  showToast("📥 부서별 엑셀 다운로드 준비 중...");
  window.location.href = `${API_BASE_URL}/admin/stats/dept_summary/excel?start=${start}&end=${end}`;
}


function loadWeeklyDeptStats() {
  const base = document.getElementById("weeklyBaseDate").value;
  if (!base) return alert("기준 날짜를 선택해주세요.");

  const range = getWeeklyDateRange(base); // ✅ 월~금 날짜 배열 반환

  const start = range[0];
  const end = range[range.length - 1];
 

  // 식수 신청 + 공휴일 데이터 요청
  getData(`/admin/stats/weekly_dept?start=${start}&end=${end}`, (mealData) => {
    
    const year = new Date(start).getFullYear();  // ✅ 시작 날짜 기준 연도 추출

    fetchHolidayList(`/holidays?year=${year}`, (holidayData) => {
      const holidayDates = holidayData;  // ✅ ['2025-04-10', ...]
      console.log("🔍 공휴일 목록:", holidayDates);  // ✅ 콘솔 확인용
      console.log("🔍 공휴일 원본 데이터:", holidayData);
      renderWeeklyDeptStats(mealData, holidayDates, range);  // ✅ 공휴일 정보 넘김
    });
  }, (err) => {
    console.error("❌ 주간 현황 조회 실패:", err);
    alert("❌ 주간 현황 데이터를 불러오지 못했습니다.");
  });
}

function getWeeklyDateRange(dateStr) {
  const base = new Date(dateStr);
  const day = base.getDay(); // 0(일)~6(토)
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day + 6) % 7)); // 월요일

  const result = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

// function renderWeeklyDeptStats(data, holidays, range) {
//   const tbody = document.getElementById("weekly-dept-body");
//   const thead = document.getElementById("weekly-dept-thead");
//   tbody.innerHTML = "";
//   thead.innerHTML = "";

//   createWeeklyTableHeaders(range, holidays);

//   const direct = [], partner = [], visitor = [];

//   // ✅ 1. 타입별로 구분
//   data.forEach(item => {
//     if (item.type === "직영") direct.push(item);
//     else if (item.type === "협력사") partner.push(item);
//     else visitor.push(item);
//   });

//   // ✅ 2. 식수 수량 추출
//   function extractQuantity(name) {
//     const match = name.match(/\((\d+)\)$/);
//     return match ? parseInt(match[1]) : 1;
//   }

//   // ✅ 3. 행 렌더링
//   function processRows(rows) {
//     const sums = range.map(() => ({ b: 0, l: 0, d: 0 }));

//     rows.sort((a, b) => a.dept.localeCompare(b.dept)).forEach(row => {
//       const tr = document.createElement("tr");

//       // ✅ 방문자/협력사 → 총합 / 직영 → 인원수
//       const totalCount = row.type === "직영"
//         ? row.total
//         : range.reduce((sum, date) => {
//             const meals = row.days[date] || { b: [], l: [], d: [] };
//             return sum +
//               meals.b.reduce((s, n) => s + extractQuantity(n), 0) +
//               meals.l.reduce((s, n) => s + extractQuantity(n), 0) +
//               meals.d.reduce((s, n) => s + extractQuantity(n), 0);
//           }, 0);

//         // ✅ 조식: 인원 + 명단
//       tr.innerHTML = `
//         <td class="weekly-dept-cell">${row.dept}</td>
//         <td class="weekly-count-cell">${totalCount}</td>
//       `;
//       range.forEach((date, i) => {
//         const v = row.days[date] || { b: [], l: [], d: [] };

//         const bQty = v.b.reduce((acc, name) => acc + extractQuantity(name), 0);
//         const lQty = v.l.reduce((acc, name) => acc + extractQuantity(name), 0);
//         const dQty = v.d.reduce((acc, name) => acc + extractQuantity(name), 0);

//         sums[i].b += bQty;
//         sums[i].l += lQty;
//         sums[i].d += dQty;

//         // ✅ 조식
//         tr.innerHTML += `
//           <td class="weekly-count-cell">${bQty}</td>
//           <td class="weekly-name-cell">${v.b.join(", ") || "-"}</td>
//         `;
//         // ✅ 중식
//         tr.innerHTML += `<td class="weekly-count-cell">${lQty}</td>`;
//         // ✅ 석식
//         tr.innerHTML += `
//           <td class="weekly-count-cell">${dQty}</td>
//           <td class="weekly-name-cell">${v.d.join(", ") || "-"}</td>
//         `;
//       });

//       tbody.appendChild(tr);
//     });

//     return sums;
//   }

//   // ✅ 출력 순서 및 요약 행 추가
//   const directSums = processRows(direct);
//   appendSummaryRow("직영 소계", directSums, tbody);

//   const partnerSums = processRows(partner);
//   appendSummaryRow("협력사 소계", partnerSums, tbody);

//   const visitorSums = processRows(visitor);
//   appendSummaryRow("방문자 소계", visitorSums, tbody);

//   const totalSums = range.map((_, i) => ({
//     b: directSums[i].b + partnerSums[i].b + visitorSums[i].b,
//     l: directSums[i].l + partnerSums[i].l + visitorSums[i].l,
//     d: directSums[i].d + partnerSums[i].d + visitorSums[i].d
//   }));

//   appendSummaryRow("총계", totalSums, tbody, true);
// }

// ✅ 유틸: 이름(3)에서 숫자 3 추출
function extractQuantity(name) {
  const match = name.match(/\((\d+)\)$/);
  return match ? parseInt(match[1]) : 1;
}

// ✅ 핵심 렌더링 함수
function renderWeeklyDeptStats(data, holidays, range) {
  const tbody = document.getElementById("weekly-dept-body");
  const thead = document.getElementById("weekly-dept-thead");
  tbody.innerHTML = "";
  thead.innerHTML = "";

  // ✅ 공휴일 포함한 3행 헤더 생성
  createWeeklyTableHeaders(range, holidays);

  // ✅ 부서 유형 분류
  const direct = [], directTrip = [], partner = [], visitor = [];

  data.forEach(row => {
    if (row.type === "직영" && row.dept.includes("(출장)")) {
      directTrip.push(row);
    } else if (row.type === "직영") {
      direct.push(row);
    } else if (row.type === "협력사") {
      partner.push(row);
    } else {
      visitor.push(row);
    }
  });


  // ✅ 실제 테이블 렌더링 함수
  function processRows(rows) {
    const sums = range.map(() => ({ b: 0, l: 0, d: 0 }));

    rows.sort((a, b) => a.dept.localeCompare(b.dept)).forEach(row => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="weekly-dept-cell">${row.display_dept || row.dept}</td>
        <td class="weekly-count-cell">${row.total || 0}</td>
      `;

      range.forEach((date, i) => {
        const isHoliday = holidays.includes(date);
        const style = isHoliday ? ' style="background-color:#ffe6e6"' : '';

        const v = row.days[date] || { b: [], l: [], d: [] };

        const bQty = v.b.reduce((acc, n) => acc + extractQuantity(n), 0);
        const lQty = v.l.reduce((acc, n) => acc + extractQuantity(n), 0);
        const dQty = v.d.reduce((acc, n) => acc + extractQuantity(n), 0);

        sums[i].b += bQty;
        sums[i].l += lQty;
        sums[i].d += dQty;

        const bNames = v.b.length ? v.b.join(", ") : "-";
        const dNames = v.d.length ? v.d.join(", ") : "-";

        tr.innerHTML += `
          <td class="weekly-count-cell"${style}>${bQty}</td>
          <td class="weekly-name-cell"${style}>${bNames}</td>
          <td class="weekly-count-cell"${style}>${lQty}</td>
          <td class="weekly-count-cell"${style}>${dQty}</td>
          <td class="weekly-name-cell"${style}>${dNames}</td>
        `;
      });

      tbody.appendChild(tr);
    });

    return sums;
  }

  // ✅ 직영 출력
  const sum1 = processRows(direct);
  appendSummaryRow("직영 소계", sum1, tbody);

const sum1_trip = processRows(directTrip);
const hasTripMeal = sum1_trip.some(day => day.b > 0 || day.l > 0 || day.d > 0);
if (hasTripMeal) {
  appendSummaryRow("직영(출장자)", sum1_trip, tbody);
}

  // ✅ 협력사 출력
  const sum2 = processRows(partner);
  appendSummaryRow("협력사 소계", sum2, tbody);

  // ✅ 방문자 출력
  const sum3 = processRows(visitor);
  appendSummaryRow("방문자 소계", sum3, tbody);

  // ✅ 총계 출력
  const totalSums = range.map((_, i) => ({
    b: sum1[i].b + sum1_trip[i].b + sum2[i].b + sum3[i].b,
    l: sum1[i].l + sum1_trip[i].l + sum2[i].l + sum3[i].l,
    d: sum1[i].d + sum1_trip[i].d + sum2[i].d + sum3[i].d
  }));
  appendSummaryRow("총계", totalSums, tbody, true);
}


function createWeeklyTableHeaders(range, holidays) {
  const thead = document.getElementById("weekly-dept-thead");
  const isHoliday = d => holidays.includes(d);

  const tr1 = document.createElement("tr");
  const tr2 = document.createElement("tr");
  const tr3 = document.createElement("tr");

  tr1.innerHTML = `<th rowspan="3">부서</th><th rowspan="3">현 인원수</th>`;
  tr2.innerHTML = "";
  tr3.innerHTML = "";

  range.forEach(d => {
    const date = new Date(d);
    const label = `${date.getMonth() + 1}월 ${date.getDate()}일 (${["일","월","화","수","목","금","토"][date.getDay()]})`;
    
    const holidayClass = isHoliday(d) ? ' class="holiday-header"' : '';
    tr1.innerHTML += `<th colspan="5"${holidayClass}>${label}</th>`;

    tr2.innerHTML += `
      <th colspan="2"${holidayClass}>조식</th>
      <th${holidayClass}>중식</th>
      <th colspan="2"${holidayClass}>석식</th>
    `;
    tr3.innerHTML += `
      <th${holidayClass}>인원</th><th${holidayClass}>명단</th>
      <th${holidayClass}>인원</th>
      <th${holidayClass}>인원</th><th${holidayClass}>명단</th>
    `;
  });

  thead.appendChild(tr1);
  thead.appendChild(tr2);
  thead.appendChild(tr3);
}

function appendSummaryRow(label, sums, tbody, isTotal = false) {
  if (!Array.isArray(sums)) {
    console.error("📛 appendSummaryRow: sums가 배열이 아님!", sums);
    return;
  }

  const tr = document.createElement("tr");
  tr.className = isTotal ? "total-row" : "subtotal-row";

  // ✅ 앞 두 칸: 소계/총계 라벨, 인원수는 생략
  tr.innerHTML = `
    <td class="weekly-type-cell" colspan="2">${label}</td>
  `;

  // ✅ 요일별 조/중/석 인원만 출력 (명단 제외)
  sums.forEach((day) => {
    tr.innerHTML += `
      <td class="weekly-count-cell">${day.b || 0}</td>
      <td class="weekly-count-cell">-</td>  <!-- 명단 없음 -->
      <td class="weekly-count-cell">${day.l || 0}</td>
      <td class="weekly-count-cell">${day.d || 0}</td>
      <td class="weekly-count-cell">-</td>  <!-- 명단 없음 -->
    `;
  });

  tbody.appendChild(tr);
}

function setDefaultWeeklyDate() {
  const today = getKSTDate();
  const monday = getMonday(today);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  document.getElementById("weeklyBaseDate").value = `${yyyy}-${mm}-${dd}`;
}

function downloadWeeklyDeptExcel() {
  const base = document.getElementById("weeklyBaseDate").value;
  if (!base) return alert("기준 날짜를 선택해주세요.");
  const range = getWeeklyDateRange(base);
  const start = range[0];
  const end = range[range.length - 1];

  showToast("📥 엑셀 다운로드 준비 중...");
  window.location.href = `${API_BASE_URL}/admin/stats/weekly_dept/excel?start=${start}&end=${end}`;
}