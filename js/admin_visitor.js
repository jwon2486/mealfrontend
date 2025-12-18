let lastSubmittedDate = null;
let flag = 1;

// document.addEventListener("DOMContentLoaded", () => {
//     // const dateInput = document.getElementById("visit-date");
//     // const weeklydateInput = document.getElementById("visit-week-date");

//     // // ✅ localStorage에 저장된 값 우선 적용
//     // const storedflag = localStorage.getItem("flag");
//     // const storedDate = localStorage.getItem("lastVisitDate");
//     // const storedWeekly = localStorage.getItem("lastWeeklyVisitDate");
    
//     // if (storedDate || storedflag === 2) {
//     //   dateInput.value = storedDate;
//     //   if (weeklydateInput) weeklydateInput.value = storedDate;
//     // }
//     // else if(storedWeekly || storedflag === 3)
//     // {
//     //   weeklydateInput = storedWeekly;
//     //   if (dateInput) dateInput.value = storedWeekly;
//     // }
//     // else{
//     //   // ✨ 수정: 기존 값이 비어 있을 때만 기본값을 설정하도록 조건 추가
//     //   // ✅ 오늘 날짜 덮어쓰기 방지
//     //   if (!dateInput.value || dateInput.value === "") {
//     //     alert("날짜 데이터값 없음");
//     //     const today = getKSTDate();
//     //     const adjusted = getNearestWeekday(today);
//     //     const monday = adjusted.toISOString().split("T")[0];
//     //     dateInput.value = monday;
        
//     //     if (!weeklydateInput.value) {
//     //       weeklydateInput.value = monday;
//     //     }
//     //   }
//     // }



//     loadLoginInfo();         // 로그인 유저 표시
//     //setTodayDefault();       // 날짜 기본값 설정
//     updateWeekday();         // 요일 표시
//     loadAdminVisitData();   // 주간 신청 내역 불러오기
  
//     document.getElementById("visit-date").addEventListener("change", () => {
//       const input = document.getElementById("visit-date");
//       const picked = new Date(input.value);
       
//       if (picked.getDay() === 0 || picked.getDay() === 6) {
//         alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
//         const adjusted = getNearestWeekday(picked);
//         input.value = adjusted.toISOString().split("T")[0];
//       }
      
//       // ✅ 날짜 변경 시 주간 테이블 기준일도 자동 갱신
//       document.getElementById("visit-week-date").value = dateInput.value;

//         updateWeekday();
//         loadAdminVisitData(); // 날짜 바뀌면 해당 주 신청 내역 갱신
//     });

//     document.getElementById("visit-data-save-btn").addEventListener("click", () => {
//         loadAdminVisitData();  // ✅ 명시적으로 조회 버튼 눌렀을 때 실행
//     });

//     document.getElementById("load-visit-data-btn").addEventListener("click", () => {
        
//         loadAdminVisitData();  // ✅ 명시적으로 조회 버튼 눌렀을 때 실행
//     });
    
// });

document.addEventListener("DOMContentLoaded", () => {
    const storedDate = sessionStorage.getItem("lastVisitDate");
    if (storedDate) {

      const todayStr = getKSTDate().toISOString().split("T")[0];
      
      if (storedDate !== todayStr) {
        document.getElementById("visit-date").value = storedDate;
        document.getElementById("visit-week-date").value = storedDate;
      }
      else {
        setTodayDefault();
      }
    }
    else {
      setTodayDefault();
    }
  
    updateWeekday();
    loadLoginInfo();
    loadAdminVisitData();
});
  
  // ✅ 날짜 변경 시 주간 테이블 날짜도 동기화
document.getElementById("visit-date").addEventListener("change", () => {
    const input = document.getElementById("visit-date");
    const picked = new Date(input.value);
  
    if (picked.getDay() === 0 || picked.getDay() === 6) {
      alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
      const adjusted = getNearestWeekday(picked);
      input.value = adjusted.toISOString().split("T")[0];
    }
  
    document.getElementById("visit-week-date").value = input.value;
    updateWeekday();
    loadAdminVisitData();
});
  
  // ✅ 주간 테이블 날짜 변경 시 바로 조회
document.getElementById("visit-week-date").addEventListener("change", () => {
    const input = document.getElementById("visit-week-date");
    const picked = new Date(input.value);
  
    if (picked.getDay() === 0 || picked.getDay() === 6) {
      alert("토요일 또는 일요일은 선택할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
      const adjusted = getNearestWeekday(picked);
      input.value = adjusted.toISOString().split("T")[0];
    }
  
    document.getElementById("visit-date").value = input.value;
    updateWeekday();
    loadAdminVisitData();
});

  
// ✅ 요일 자동 표기
function updateWeekday() {
    const date = document.getElementById("visit-date").value;
    if (!date) return;
    document.getElementById("visit-day").innerText = getWeekdayName(date);
    updateDeadlineColors();  // ✅ 마감 색상 갱신 추가
}
  
// ✅ 로그인 정보 표시 (관리자 전용)
function loadLoginInfo() {
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    if (user && user.userName) {
      document.getElementById("login-user").innerText = `👑 관리자 모드`;
    }
}
  
// ✅ 이름 입력 → 사번 자동 입력
function checkEmployeeName() {
    const name = document.getElementById("applicant-name").value.trim();
    if (!name) {
      alert("이름을 입력해주세요.");
      return;
    }
  
    getData(`/admin/employees?name=${name}`, (res) => {
      const matches = Array.isArray(res) ? res : res?.data;
  
      if (!matches || matches.length === 0) {
        alert("일치하는 사원이 없습니다.");
        return;
      }
  
      if (matches.length === 1) {
        document.getElementById("applicant-id").value = matches[0].id;
        return;
      } 
      else{
        showEmployeeSelectPopup(matches);  // ✅ 팝업 방식으로 선택
      }
  
    });
}

function showEmployeeSelectPopup(matches) {
    const popup = window.open("", "사원 선택", "width=500,height=400");
  
    const html = `
      <html>
      <head>
        <link rel="stylesheet" href="css/admin_visitor_style.css">
      </head>
      <body>
        <h3>📌 이름이 동일한 사원이 여러 명입니다</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>사번</th>
                <th>이름</th>
                <th>부서</th>
                <th>선택</th>
              </tr>
            </thead>
            <tbody>
              ${matches.map(e => `
                <tr>
                  <td>${e.id}</td>
                  <td>${e.name}</td>
                  <td>${e.dept}</td>
                  <td><button onclick="window.opener.selectEmployee('${e.id}', '${e.name}'); window.close();">선택</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  
    popup.document.write(html);
    popup.document.close();
} 


// ✅ popup에서 선택 버튼 클릭 시 호출됨
function selectEmployee(id, name) {
    document.getElementById("applicant-id").value = id;
    document.getElementById("applicant-name").value = name;
}
  
// ✅ 관리자 저장
function submitAdminVisit() {
    const date = document.getElementById("visit-date").value;
    const id = document.getElementById("applicant-id").value.trim();
    const name = document.getElementById("applicant-name").value.trim();
    const breakfast = +document.getElementById("b-count").value;
    const lunch = +document.getElementById("l-count").value;
    const dinner = +document.getElementById("d-count").value;
    const reason = document.getElementById("visit-reason").value.trim();
    const type = document.getElementById("visit-type").value;
  
    if (!date || !id || !name || !reason || !type || (breakfast + lunch + dinner === 0)) {
      showToast("❗ 모든 입력값을 확인해주세요.");
      alert("❗ 모든 입력값을 확인해주세요.");
      return;
    }
  
    const checkUrl = `${API_BASE_URL}/visitors/check?date=${date}&id=${id}&type=${type}`;
    const mealData = { breakfast, lunch, dinner };
    const expiredList = getExpiredMeals_Admin(date, mealData);

    if (expiredList.length === 3) {
        alert("⛔ 모든 식사는 마감되어 신청할 수 없습니다.");
        return;
      }


  
    localStorage.setItem("lastVisitDate", date);  // ✅ 날짜를 브라우저에 저장
    localStorage.setItem("flag", 2);

    lastSubmittedDate = date;

    const isAdmin = true;  // 👉 요청자는 관리자임
    const userType = document.getElementById("visit-type").value; // 👉 신청자는 '방문자' or '협력사'


    // ✅ 저장 전 공휴일 확인
    getData(`/holidays?year=${date.substring(0, 4)}`, (holidays) => {
      if (holidays.some(h => h.date === date)) {
        alert(`❌ ${date}는 공휴일입니다. 신청할 수 없습니다.`);
        return;
      }

      getData(checkUrl, (res) => {
          if (res.exists) {
              const proceed = confirm("📌 해당 날짜에 이미 신청한 내역이 있습니다. 수정하시겠습니까?");
          if (!proceed) return;
          }

          // ✅ 기존 값이 존재할 경우 마감된 식사는 기존 값을 사용
          const existing = res.record || { breakfast: 0, lunch: 0, dinner: 0 };
          
          const data = {
              applicant_id: id,
              applicant_name: name,
              date,
              breakfast: expiredList.includes("breakfast") ? existing.breakfast : breakfast,
              lunch:     expiredList.includes("lunch")     ? existing.lunch     : lunch,
              dinner:    expiredList.includes("dinner")    ? existing.dinner    : dinner,
              reason,
              type: userType,         // ✅ 저장될 신청자 타입
              requested_by_admin: isAdmin  // ✅ 권한 정보는 별도 전달
          };

          saveAdminVisit(data);

        // 로그저장
          const isChanged = existing.breakfast !== data.breakfast || existing.lunch !== data.lunch || existing.dinner !== data.dinner;
          
          if (isChanged) {
            const before = `조식(${existing.breakfast}), 중식(${existing.lunch}), 석식(${existing.dinner})`;
            const after  = `조식(${data.breakfast}), 중식(${data.lunch}), 석식(${data.dinner})`;
    
            const logPayload = {
                visitor_id: existing.id || null,
                applicant_id: id,
                applicant_name: name,
                dept: null,
                date: data.date,
                before_state: before,
                after_state: after,
                changed_at: new Date().toString()
            };
    
            postData("/visitor_logs", logPayload);
        }
      });
   });
}

function saveAdminVisit(data) {
    postData("/visitors", data, () => {
      showToast("✅ 저장 완료");
      alert("✅ 저장 완료");
      //clearInput();
  
      if (lastSubmittedDate) {
        document.getElementById("visit-date").value = lastSubmittedDate; // lastSubmittedDate 수정할지는 추후 정함
        document.getElementById("visit-week-date").value = lastSubmittedDate;
      }
  
      updateWeekday();
      loadAdminVisitData();
    });
}

function deleteAdminVisit(id) {
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;

  const date = tr.querySelector(".date-cell").innerText;
  const name = tr.querySelector("td:nth-child(3)").innerText;
  const b = +tr.querySelector(".b-cell").innerText;
  const l = +tr.querySelector(".l-cell").innerText;
  const d = +tr.querySelector(".d-cell").innerText;

  const confirmMsg = `📛 아래 내역을 삭제하시겠습니까?\n\n${date}\n조식: ${b}, 중식: ${l}, 석식: ${d}`;
  if (!confirm(confirmMsg)) return;

  //postData(`/visitor_logs/delete`, logPayload);  // 서버에서 로그 저장 처리

  deleteData(`${API_BASE_URL}/visitors/${id}`, () => {
    showToast("✅ 삭제 완료");
    alert("✅ 삭제 완료");
    loadAdminVisitData();
  });

  localStorage.setItem("lastVisitDate", date);
  localStorage.setItem("lastWeeklyVisitDate", date);

}

function isDeadlinePassed_Admin(date, mealType, quantity = 1) {
    const now = getKSTDate();
    const mealDate = new Date(date);
  
    if (mealType === "breakfast") {
      mealDate.setDate(mealDate.getDate() - 1);
      mealDate.setHours(20, 0, 0, 0);
    } else if (mealType === "lunch") {
      mealDate.setHours(12, 0, 0, 0);
    } else if (mealType === "dinner") {
      mealDate.setHours(17, 0, 0, 0);
    }
  
    return now > mealDate;
}

function updateDeadlineColors() {
    const date = document.getElementById("visit-date").value;
    if (!date) return;
  
    const breakfastInput = document.getElementById("b-count");
    const lunchInput = document.getElementById("l-count");
    const dinnerInput = document.getElementById("d-count");
  
    [breakfastInput, lunchInput, dinnerInput].forEach(input => {
      input.classList.remove("expired-input");
      input.readOnly = false;
      input.style.backgroundColor = "";
      input.title = "";
    });
  
    const now = getKSTDate();
    const mealDate = new Date(date);
  
    const bLimit = new Date(mealDate);
    bLimit.setDate(mealDate.getDate() - 1);
    bLimit.setHours(20, 0, 0, 0);
    if (now > bLimit) {
      breakfastInput.readOnly = true;
      breakfastInput.style.backgroundColor = "#eee";
      breakfastInput.title = "조식은 마감되었습니다.";
    }
  
    const lLimit = new Date(mealDate);
    lLimit.setHours(12, 0, 0, 0);
    if (now > lLimit) {
      lunchInput.readOnly = true;
      lunchInput.style.backgroundColor = "#eee";
      lunchInput.title = "중식은 마감되었습니다.";
    }
  
    const dLimit = new Date(mealDate);
    dLimit.setHours(17, 0, 0, 0);
    if (now > dLimit) {
      dinnerInput.readOnly = true;
      dinnerInput.style.backgroundColor = "#eee";
      dinnerInput.title = "석식은 마감되었습니다.";
    }
}

// ✅ 마감시간 (관리자용)
function getExpiredMeals_Admin(date, mealData) {
    const now = getKSTDate();
    const mealDate = new Date(date);
    const expired = [];
  
    const bLimit = new Date(mealDate);
    bLimit.setDate(mealDate.getDate() - 1);
    bLimit.setHours(20, 0, 0, 0);
    if (mealData.breakfast > 0 && now > bLimit) expired.push("breakfast");
  
    const lLimit = new Date(mealDate);
    lLimit.setHours(12, 0, 0, 0);
    if (mealData.lunch > 0 && now > lLimit) expired.push("lunch");
  
    const dLimit = new Date(mealDate);
    dLimit.setHours(17, 0, 0, 0);
    if (mealData.dinner > 0 && now > dLimit) expired.push("dinner");
  
    return expired;
}
  
// ✅ 관리자 주간 신청 내역 불러오기
function loadAdminVisitData() {
    const dateInput = document.getElementById("visit-week-date");
    if (!dateInput || !dateInput.value) {
      console.warn("📛 날짜가 지정되지 않았습니다.");
      return;
    }
    const selectedDate = dateInput.value;

    // const selectedDate = document.getElementById("visit-week-date").value;
    const { start, end } = getWeekStartAndEnd(selectedDate);
    const params = `start=${start}&end=${end}`;

  
    getData(`/visitors/weekly?${params}`,
        (result) => {
          const tbody = document.getElementById("visit-summary-body");
          tbody.innerHTML = "";
      
          if (!result || result.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="10" style="text-align:center; color: gray;">신청 내역이 없습니다.</td>`;
            tbody.appendChild(tr);
            return;
          }
      
          result.forEach(row => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-id", row.id); // ✅ 행 식별용
      
            // 선택적 마감표시 배경색
            const rowExpired = isRowExpired_Admin(row);
            if (rowExpired) tr.style.backgroundColor = "#ffe5e5";
      
            tr.innerHTML = `
              <td class="date-cell">${row.date}</td>
              <td>${getWeekdayName(row.date)}</td>
              <td>${row.applicant_name}</td>
              <td>${row.type}</td>
              <td class="b-cell ${isDeadlinePassed_Admin(row.date, 'breakfast', row.breakfast) ? 'expired-cell' : ''}">${row.breakfast}</td>
              <td class="l-cell ${isDeadlinePassed_Admin(row.date, 'lunch', row.lunch) ? 'expired-cell' : ''}">${row.lunch}</td>
              <td class="d-cell ${isDeadlinePassed_Admin(row.date, 'dinner', row.dinner) ? 'expired-cell' : ''}">${row.dinner}</td>
              <td class="r-cell">${row.reason}</td>
              <td><button class="edit-btn" onclick="editAdminVisit('${row.id}')">✏️</button></td>
              <td><button onclick="deleteAdminVisit('${row.id}')">🗑️</button></td>
            `;
            tbody.appendChild(tr);
          });
        },
        (err) => {
          console.error("❌ 주간 신청 내역 불러오기 실패:", err);
          showToast("❌ 관리자 신청 데이터를 불러오는 데 실패했습니다.");
        }
    );
}

function editAdminVisit(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
  
    const date = tr.querySelector("td.date-cell").innerText;
    const b = tr.querySelector(".b-cell").innerText;
    const l = tr.querySelector(".l-cell").innerText;
    const d = tr.querySelector(".d-cell").innerText;
    const r = tr.querySelector(".r-cell")?.innerText || "";
  
    const bExpired = isDeadlinePassed_Admin(date, "breakfast", b);
    const lExpired = isDeadlinePassed_Admin(date, "lunch", l);
    const dExpired = isDeadlinePassed_Admin(date, "dinner", d);
  
    tr.querySelector(".b-cell").innerHTML = `<input type="number" min="0" max="50" value="${b}" ${bExpired ? 'readonly style="background:#eee;"' : ''}>`;
    tr.querySelector(".l-cell").innerHTML = `<input type="number" min="0" max="50" value="${l}" ${lExpired ? 'readonly style="background:#eee;"' : ''}>`;
    tr.querySelector(".d-cell").innerHTML = `<input type="number" min="0" max="50" value="${d}" ${dExpired ? 'readonly style="background:#eee;"' : ''}>`;
    if (tr.querySelector(".r-cell")) {
      tr.querySelector(".r-cell").innerHTML = `<input type="text" value="${r}">`;
    }
  
    const editBtn = tr.querySelector("button.edit-btn");
    editBtn.innerText = "💾";
    editBtn.onclick = () => saveAdminVisitEdit(id);
}

function saveAdminVisitEdit(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
  
    const date = tr.querySelector("td.date-cell").innerText;
    const b = tr.querySelector(".b-cell input")?.value || 0;
    const l = tr.querySelector(".l-cell input")?.value || 0;
    const d = tr.querySelector(".d-cell input")?.value || 0;
    const r = tr.querySelector(".r-cell input")?.value || "협력사 신청";
  
    const breakfast = +b;
    const lunch = +l;
    const dinner = +d;
  
    if ((breakfast + lunch + dinner) === 0 || !r.trim()) {
      showToast("❗ 수량 또는 사유 입력이 누락되었습니다.");
      alert("❗ 수량 또는 사유 입력이 누락되었습니다.");
      return;
    }

    localStorage.setItem("lastWeeklyVisitDate", date);  // ✅ 날짜를 브라우저에 저장
    localStorage.setItem("flag", 3);

    // ✅ 먼저 수정 저장
    // const updated = { breakfast, lunch, dinner, reason: r.trim() };
  
    const data = { breakfast, lunch, dinner, reason: r.trim() };
    putData(`/visitors/${id}`, data, () => {
      showToast("✅ 수정 완료");
      alert("✅ 수정 완료")
    
      // ✅ 로그 저장 API 호출
      //postData(`/visitor_logs`, logPayload);
      
      loadAdminVisitData();
    }); 

    // // ✅ 변경 전 데이터 fetch
    // getData(`/visitors/${id}`, (original) => {
    //   if (!original) {
    //     alert("📛 기존 데이터를 불러올 수 없습니다.");
    //     return;
    //   }
    //   // ✅ 변경 전과 변경 후 비교하여 로그용 메시지 생성
    //   const before = [`조식(${original.breakfast})`, `중식(${original.lunch})`, `석식(${original.dinner})`].join(", ");
    //   const after  = [`조식(${breakfast})`, `중식(${lunch})`, `석식(${dinner})`].join(", ");
      
    //   const logPayload = {
    //     visitor_id: id,
    //     applicant_id: original.applicant_id,
    //     applicant_name: original.applicant_name,
    //     dept: original.dept,
    //     date: date,
    //     before_state: before,
    //     after_state: after,
    //     changed_at: new Date().toISOString()
    //   };

    //   // ✅ 먼저 수정 저장
    //   const updated = { breakfast, lunch, dinner, reason: r.trim() };
  
    // // const data = { breakfast, lunch, dinner, reason: r.trim() };
    //   putData(`/visitors/${id}`, updated, () => {
    //     showToast("✅ 수정 완료");
    //     alert("✅ 수정 완료")

    //     // ✅ 로그 저장 API 호출
    //     postData(`/visitor_logs`, logPayload);

    //     loadAdminVisitData();
    //   }); 
    // });
}

function isRowExpired_Admin(row) {
    return (
      isDeadlinePassed_Admin(row.date, 'breakfast', row.breakfast) &&
      isDeadlinePassed_Admin(row.date, 'lunch', row.lunch) &&
      isDeadlinePassed_Admin(row.date, 'dinner', row.dinner)
    );
}
  
// 뒤로가기
function goToMain() {
    sessionStorage.clear();
    localStorage.clear();
    location.href = "index.html";
}
  
function getNearestWeekday(dateObj) {
    const day = dateObj.getDay();
    if (day === 6) dateObj.setDate(dateObj.getDate() + 2); // 토요일
    else if (day === 0) dateObj.setDate(dateObj.getDate() + 1); // 일요일
    return dateObj;
}

    // 오늘 날짜 기본 설정
function setTodayDefault() {

    const today = getKSTDate();
    const adjusted = getNearestWeekday(today); // ✅ 주말 보정된 날짜
  
    const dateField = document.getElementById("visit-date");
    const weekField = document.getElementById("visit-week-date");
  
    if (!dateField.value) dateField.value = adjusted.toISOString().split("T")[0];
    if (!weekField.value) weekField.value = adjusted.toISOString().split("T")[0];
  
    updateWeekday();
}