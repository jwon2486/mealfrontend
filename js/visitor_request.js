// visitor_request.js

let lastSubmittedDate = null;
let flag = 1;

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

  // updateWeekday();
  // loadLoginInfo();
  // loadAdminVisitData();


    // const dateInput = document.getElementById("visit-date");
    // const weeklydateInput = document.getElementById("visit-week-date");

    // // ✅ localStorage에 저장된 값 우선 적용
    // const storedflag = localStorage.getItem("flag");
    // const storedDate = localStorage.getItem("lastVisitDate");
    // const storedWeely = localStorage.getItem("lastWeeklyVisitDate");
    
    // if (storedDate || storedflag === 2) {
    //   dateInput.value = storedDate;
    //   if (weeklydateInput) weeklydateInput.value = storedDate;
    // } else if(storedWeely || storedflag === 3)
    // {
    //   weeklydateInput = storedWeely;
    //   if (dateInput) dateInput.value = storedWeely;
    // }
    // else{
    //   // ✨ 수정: 기존 값이 비어 있을 때만 기본값을 설정하도록 조건 추가
    //   // ✅ 오늘 날짜 덮어쓰기 방지
    //   if (!dateInput.value || dateInput.value === "") {
    //     alert("날짜 데이터값 없음");
    //     const today = getKSTDate();
    //     const adjusted = getNearestWeekday(today);
    //     const monday = adjusted.toISOString().split("T")[0];
    //     dateInput.value = monday;
        
    //     if (!weeklydateInput.value) {
    //       weeklydateInput.value = monday;
    //     }
    //   }
    // }
    // // const temp = new date();
    // // alert(temp.now);

    loadLoginInfo();         // 로그인 유저 표시
    //setTodayDefault();       // 날짜 기본값 설정
    updateWeekday();         // 요일 표시
    loadWeeklyVisitData();   // 주간 신청 내역 불러오기
  
 
    // // 협력사 로그인 시 사유 항목 숨기고 자동 입력
    //document.getElementById("load-visit-data-btn").addEventListener("click", loadWeeklyVisitData);


    const userType = sessionStorage.getItem("type"); // "직영" / "협력사"
    const currentUserId = sessionStorage.getItem("id");
    const currentDept = sessionStorage.getItem("dept");
    const pageTitle = document.getElementById("page-title"); // ✅ 화면 타이틀 분기 처리
    const pageButton = document.getElementById("page-button"); // ✅ 화면 타이틀 분기 처리

    if (userType === "협력사") {
      if (pageTitle) {
        pageTitle.innerText = "식수 신청 시스템";
        pageButton.innerText = "🔙 로그아웃"
      }
      //const reasonTh = document.getElementById("reason-th");
      //const reasonTd = document.getElementById("visit-reason")?.closest("td");

      //if (reasonTh) reasonTh.style.display = "none";
      //if (reasonTd) reasonTd.style.display = "none";

      
      // ✅ 추가: 주간 테이블 헤드도 숨기기
      const summaryTh = document.getElementById("weekly-reason-th");   
      if (summaryTh) summaryTh.style.display = "none";

    }
    else if (userType === "직영") {
      if (pageTitle){
         pageTitle.innerText = "방문자 식수 신청";
         pageButton.innerText = "🔙 뒤로가기"
      }
      // ✅ 직영: 숨겨졌던 사유 필드를 다시 표시
      const reasonTh = document.getElementById("reason-th");
      const reasonInput = document.getElementById("visit-reason");
      const weeklyReasonTh = document.getElementById("weekly-reason-th");
  
      if (reasonTh) reasonTh.style.display = "";
      if (reasonInput) reasonInput.style.display = "";
      if (weeklyReasonTh) weeklyReasonTh.style.display = "";
    }
});

document.getElementById("visit-date").addEventListener("change", () => {
  const input = document.getElementById("visit-date");
  const picked = new Date(input.value);
   
  if (picked.getDay() === 0 || picked.getDay() === 6) {
    alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
    const adjusted = getNearestWeekday(picked);
    input.value = adjusted.toISOString().split("T")[0];
  }

  
  
  // ✅ 날짜 변경 시 주간 테이블 기준일도 자동 갱신
  document.getElementById("visit-week-date").value = input.value;

  updateWeekday();
  loadWeeklyVisitData(); // 날짜 바뀌면 해당 주 신청 내역 갱신
});

// ✅ 주간 테이블 날짜 변경 시 바로 조회
document.getElementById("visit-week-date").addEventListener("change", () => {
    const input = document.getElementById("visit-week-date");
    const picked = new Date(input.value);

    if (picked.getDay() === 0 || picked.getDay() === 6) {
      alert("토요일 또는 일요일은 신청할 수 없습니다. 가장 가까운 월요일로 자동 설정됩니다.");
      const adjusted = getNearestWeekday(picked);
      input.value = adjusted.toISOString().split("T")[0];
    }

    // ✅ 날짜 변경 시 주간 테이블 기준일도 자동 갱신
    document.getElementById("visit-date").value = input.value;

    updateWeekday();
    loadWeeklyVisitData(); // 날짜 바뀌면 해당 주 신청 내역 갱신
});

document.getElementById("visit-data-save-btn").addEventListener("click", () => {
  loadWeeklyVisitData();  // ✅ 명시적으로 조회 버튼 눌렀을 때 실행
});

document.getElementById("load-visit-data-btn").addEventListener("click", () => {
  loadWeeklyVisitData();  // ✅ 명시적으로 조회 버튼 눌렀을 때 실행
});



function loadLoginInfo() {
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  if (user && user.userName) {
    document.getElementById("login-user").innerText = `👤 ${user.userName} (${user.dept})`;
    sessionStorage.setItem("id", user.userId);
    sessionStorage.setItem("name", user.userName);
    sessionStorage.setItem("type", user.type);
    sessionStorage.setItem("dept", user.dept);  // ✅ 부서 저장 추가
    sessionStorage.setItem("userId", user.userId);    // ✅ 추가
    sessionStorage.setItem("userName", user.userName);
    sessionStorage.setItem("userType", user.type);
    sessionStorage.setItem("level", user.level);
    const logButton = document.getElementById("visit-log-button");
    const userLevel = sessionStorage.getItem("level");

    if (logButton) {
      if (userLevel === "2") {
        logButton.style.display = "inline-block";
        logButton.addEventListener("click", () => {
          window.location.href = "visitor_logs.html";
        });
      } else {
        logButton.style.display = "none";
      }
    }

  }
}
  
  // 오늘 날짜 기본 설정
function setTodayDefault() {
  const today = getKSTDate(); // 현재 날짜 (KST)
  const currentDay = today.getDay(); // 요일 (0=일, 1=월,...6=토)

  // 다음주 월요일 계산
  const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(9, 0, 0, 0); // 시/분/초 초기화

  const dateStr = nextMonday.toISOString().split("T")[0];

  const dateField = document.getElementById("visit-date");
  const weekField = document.getElementById("visit-week-date");

  if (!dateField.value) dateField.value = dateStr;
  if (!weekField.value) weekField.value = dateStr;

  updateWeekday(); // 요일 표시 갱신
}
  
// 요일 자동 표기
function updateWeekday() {
    const date = document.getElementById("visit-date").value;
    if (!date) return;
    document.getElementById("visit-day").innerText = getWeekdayName(date);
    updateDeadlineColors();  // ✅ 마감 색상 갱신 추가
}

// ✅ 저장 버튼
function submitVisit() {
    //const login = getLoginInfo();
    const date = document.getElementById("visit-date").value;
    const breakfast = +document.getElementById("b-count").value;
    const lunch = +document.getElementById("l-count").value;
    const dinner = +document.getElementById("d-count").value;
    const reasonInput = document.getElementById("visit-reason");
    const userType = sessionStorage.getItem("type") || "방문자";
    let actualType = "방문자";
    
    // ✅ 다음 주 마감 검사
    if (isNextWeekDeadlinePassed(date)) {
      alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 신청할 수 없습니다.");
      return;
    }
  
    const currentDept = sessionStorage.getItem("dept");
    const isException = currentDept === "신명전력";

    const reason = (userType === "협력사" && !isException)
                  ? "협력사 신청"
                  : reasonInput.value.trim();
  
    // ✅ 사유는 직영일 때만 필수로 검사
    if (!date || (breakfast + lunch + dinner === 0) || 
        (userType !== "협력사" && reason === "")) {
      showToast("❗ 날짜, 식사 수량, 사유를 모두 입력해주세요.");
      alert("❗ 날짜, 식사 수량, 사유를 모두 입력해주세요.");
      return;
    }

    if(userType === "직영")
      actualType = "방문자";
    else if(userType === "협력사")
      actualType = "협력사";
        

    localStorage.setItem("lastVisitDate", date);  // ✅ 날짜를 브라우저에 저장
    localStorage.setItem("flag", 2);

    lastSubmittedDate = date;

    // ✅ 먼저 중복 여부 체크
    const checkUrl = `${API_BASE_URL}/visitors/check?date=${date}&id=${sessionStorage.getItem("id")}&type=${actualType}`;

    const mealData = { breakfast, lunch, dinner };
    const expiredList = getExpiredMeals(date, mealData);

    if (expiredList.length === 3) {
      alert("⛔ 모든 식사는 마감되어 신청할 수 없습니다.");
      return;
    }
    else if(expiredList.length >= 0)
    

    // ✅ 저장 전 공휴일 체크
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

        const visitData = {
          applicant_id: sessionStorage.getItem("id"),
          applicant_name: sessionStorage.getItem("name"),
          date,
          breakfast: expiredList.includes("breakfast") ? existing.breakfast : breakfast,
          lunch:     expiredList.includes("lunch")     ? existing.lunch     : lunch,
          dinner:    expiredList.includes("dinner")    ? existing.dinner    : dinner,
          reason,
          type: actualType || "방문자", 
          requested_by_admin: false
        };

        saveVisit(visitData);  // ✅ 저장 함수 호출
        
        // ✅ 로그 조건: 변경 내역이 있는 경우만
            // ✅ 로그 조건: 변경 내역이 있는 경우만 기록
      // const isChanged = existing.breakfast !== visitData.breakfast ||
      //                   existing.lunch !== visitData.lunch ||
      //                   existing.dinner !== visitData.dinner;

      //   if (isChanged) {
      //     const before = `조식(${existing.breakfast}), 중식(${existing.lunch}), 석식(${existing.dinner})`;
      //     const after  = `조식(${visitData.breakfast}), 중식(${visitData.lunch}), 석식(${visitData.dinner})`;

      //       const logPayload = {
      //         visitor_id: existing.id || null,
      //         applicant_id: visitData.applicant_id,
      //         applicant_name: visitData.applicant_name,
      //         dept: null,
      //         date: visitData.date,
      //         before_state: before,
      //         after_state: after,
      //         changed_at: new Date().toISOString()
      //       };

      //       postData("/visitor_logs", logPayload);
      //   }

      });
    });
}



//이번주 수요일 자정(목요일 0시)인지 판별하는 함수:
function isNextWeekDeadlinePassed(selectedDate) {
  const now = getKSTDate();
  const mealDate = new Date(selectedDate);

  // 이번주 월요일
  const nowDay = now.getDay() === 0 ? 7 : now.getDay(); // Sunday=7
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - nowDay + 1);
  thisWeekMonday.setHours(0,0,0,0);

  // 이번주 수요일 16시
  const wednesday16 = new Date(thisWeekMonday);
  wednesday16.setDate(thisWeekMonday.getDate() + 2);
  wednesday16.setHours(16,0,0,0);

  // 이번주 일요일 23:59:59
  const sundayEnd = new Date(thisWeekMonday);
  sundayEnd.setDate(thisWeekMonday.getDate() + 6);
  sundayEnd.setHours(23,59,59,999);

  // 다음주 월요일~일요일 범위
  const nextWeekMonday = new Date(thisWeekMonday);
  nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);

  const nextWeekSunday = new Date(nextWeekMonday);
  nextWeekSunday.setDate(nextWeekMonday.getDate() + 6);

  // 🌿 디버그 로그
  console.log("🌿 현재시각:", now.toISOString());
  console.log("🌿 이번주 수요일16:", wednesday16.toISOString());
  console.log("🌿 이번주 일요일:", sundayEnd.toISOString());
  console.log("🌿 다음주 시작:", nextWeekMonday.toISOString());
  console.log("🌿 다음주 끝:", nextWeekSunday.toISOString());
  console.log("🌿 식사일:", mealDate.toISOString());

  // 다음주 식사인지?
  if (mealDate >= nextWeekMonday && mealDate <= nextWeekSunday) {
    // 이번주 수요일16 ~ 일요일 기간인지?
    if (now >= wednesday16 && now <= sundayEnd) {
      return true;
    }
  }
  return false;
}


//주차 계산 함수
function getWeekNumber(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - dayNum);
  const yearStart = new Date(date.getFullYear(),0,1);
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

//방문자 저장 관련 함수
function saveVisit(data) {
    // const selectedDate = document.getElementById("visit-date").value;  // ✅ 현재 선택 날짜 백업

    postData("/visitors", data, () => {
      showToast("✅ 저장되었습니다.");
      alert("✅ 저장되었습니다.");
      clearInput();
      
    
      if (lastSubmittedDate) {
        // ✅ 날짜 복원
        document.getElementById("visit-date").value = lastSubmittedDate;
        document.getElementById("visit-week-date").value = lastSubmittedDate;
      }

      updateWeekday();  
      loadWeeklyVisitData();  // 저장 후 갱신
    });
}

 
// 입력 초기화
function clearInput() {
    document.getElementById("b-count").value = 0;
    document.getElementById("l-count").value = 0;
    document.getElementById("d-count").value = 0;
    
    const reasonInput = document.getElementById("visit-reason");
    if (reasonInput) reasonInput.value = "";
}
  
// 👉 주간 신청 내역 불러오기
function loadWeeklyVisitData() {
    const userType = sessionStorage.getItem("type") || "방문자"; // ✅ 추가
    //const applicantId = getLoginInfo().id; 6월26일 테스트용 임시주석처리

    const dateInput = document.getElementById("visit-week-date");
    if (!dateInput || !dateInput.value) {
      console.warn("📛 날짜가 지정되지 않았습니다.");
      return;
    }
    const selectedDate = dateInput.value;
    
    //방문자 신청 정보 불러오는 함수라인
    // const selectedDate = document.getElementById("visit-week-date").value;
    //const { start, end } = getWeekStartAndEnd(selectedDate);
    const { start, end } = getWeekStartAndEnd(selectedDate);
    const params = `start=${start}&end=${end}`; // id 제외 → 전체 조회
    //const params = `start=${start}&end=${end}&mode=apply`;
  
    getData(`${API_BASE_URL}/visitors/weekly?${params}`,
      (result) => {
        console.log("📦 방문자 주간 데이터:", result);
        const tbody = document.getElementById("visit-summary-body");
        tbody.innerHTML = "";
  
        if (!result || result.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="8" style="text-align:center; color: gray;">신청 내역이 없습니다.</td>`;
          tbody.appendChild(tr);
          return;
        }

        (result || []).forEach(row => {
          const userType = sessionStorage.getItem("type") || "방문자";
          const currentDept = sessionStorage.getItem("dept");  // ✅ 여기 추가
          // result.forEach 안에 추가
          // 협력사: 같은 협력사 소속 신청만 표시 (부서 기준)
          if (userType === "협력사") {
            if (row.type !== "협력사" || row.dept !== currentDept) return;
          }

          // 직영: 직영 사용자들 신청만 표시
          if (userType === "직영") {
            if (row.type !== "방문자") return;
          }
          const tr = document.createElement("tr");
          const isOwner = row.applicant_id === sessionStorage.getItem("id");


          // const now = new Date();
          // const mealDate = new Date(row.date);
          // let isClosed = false;

          //   // 🔒 조식 마감 체크: 전일 15시
          // const bLimit = new Date(mealDate);
          // bLimit.setDate(bLimit.getDate() - 1);
          // bLimit.setHours(15, 0, 0, 0);
          // if (row.breakfast > 0 && now > bLimit) isClosed = true;

          // // 🔒 중식 마감 체크: 당일 10시
          // const lLimit = new Date(mealDate);
          // lLimit.setHours(10, 0, 0, 0);
          // if (row.lunch > 0 && now > lLimit) isClosed = true;

          // // 🔒 석식 마감 체크: 당일 15시
          // const dLimit = new Date(mealDate);
          // dLimit.setHours(15, 0, 0, 0);
          // if (row.dinner > 0 && now > dLimit) isClosed = true;

          // if (isClosed) {
          //   tr.style.backgroundColor = "#ffe5e5";  // 연붉은 배경색 표시
          // }
          
          // 🔧 셀별 색상 여부 계산
          const bExpired = isDeadlinePassed(row.date, "breakfast", row.breakfast);
          const lExpired = isDeadlinePassed(row.date, "lunch", row.lunch);
          const dExpired = isDeadlinePassed(row.date, "dinner", row.dinner);
          const rowExpired = bExpired && lExpired && dExpired;
          const isPastDate = new Date(row.date) < getKSTDate();  // ✅ 과거 날짜 여부
          const todayStr = getKSTDate().toISOString().split("T")[0];
          const isTodayOrLater = row.date >= todayStr;

          const isRowClosed = isNextWeekDeadlinePassed(row.date) || rowExpired || !isTodayOrLater;
          

          if (isRowClosed) tr.style.backgroundColor = "#ffe5e5"; // 전체 행 붉은색


          tr.setAttribute("data-id", row.id); // ✅ 행 식별용
          tr.innerHTML = `
          <td class="date-cell">${row.date}</td>
          <td>${getWeekdayName(row.date)}</td>
          <td class="b-cell ${bExpired ? 'expired-cell' : ''}">${row.breakfast}</td>
          <td class="l-cell ${lExpired ? 'expired-cell' : ''}">${row.lunch}</td>
          <td class="d-cell ${dExpired ? 'expired-cell' : ''}">${row.dinner}</td>
          <td class="r-cell ${isRowClosed ? 'expired-cell' : ''}">${row.reason}</td>
          <td>${row.dept || "-"}</td>
          <td>${row.applicant_name || "-"}</td>
          <td>
          ${(isOwner && !(bExpired && lExpired && dExpired))
            ? `<button class="edit-btn" onclick="editVisit('${row.id}')">✏️</button>`
            : `<span style="color:gray;">🔒마감</span>`}
          </td>
          <td>
          ${(isOwner && !bExpired && !lExpired && !dExpired)
            ? `<button onclick="deleteVisit('${row.id}')">🗑</button>`
            : `<span style="color:gray;">🔒마감</span>`}
          </td>

        `;
          tbody.appendChild(tr);
        });
      },
      (err) => {
        console.error("❌ 주간 신청 내역 불러오기 실패:", err);
        showToast("❌ 방문자 신청 데이터를 불러오는 데 실패했습니다.");
        //alert("❌ 방문자 신청 데이터를 불러오는 데 실패했습니다.");
      }
    );
}

//방문객 삭제 관련 함수
function deleteVisit(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;

    const date = tr.querySelector(".date-cell").innerText;
    const b = +tr.querySelector(".b-cell").innerText;
    const l = +tr.querySelector(".l-cell").innerText;
    const d = +tr.querySelector(".d-cell").innerText;

    const expiredList = getExpiredMeals(date, { breakfast: b, lunch: l, dinner: d });
    // ✅ 다음 주 마감 검사
    if (isNextWeekDeadlinePassed(date)) {
      alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 수정할 수 없습니다.");
      loadWeeklyVisitData();  // 원래 상태 복원
      return;
    }

    // ✅ 삭제 제한 조건
    if (expiredList.length > 0) {
      alert(`⛔ 조/중/석 중 ${expiredList.join(", ")}은(는) 마감되어 삭제할 수 없습니다.`);
      return;
    }
  
    if (!confirm("정말 삭제하시겠습니까?")) return;
  
    deleteData(`${API_BASE_URL}/visitors/${id}`, () => {
      showToast("✅ 삭제 완료");
      alert("✅ 삭제 완료");
      loadWeeklyVisitData();
    });

    localStorage.setItem("lastVisitDate", date);
    localStorage.setItem("lastWeeklyVisitDate", date);
}


// ✅ 마감된 항목만 반환하는 함수
function getExpiredMeals(date, mealData) {
  const now = getKSTDate();
  const mealDate = new Date(date);
  mealDate.setHours(0, 0, 0, 0);  // 🔧 이 줄 추가!
  const expired = [];

  const bLimit = new Date(mealDate);
  bLimit.setDate(mealDate.getDate() - 1);
  bLimit.setHours(15, 0, 0, 0);
  if (mealData.breakfast > 0 && now > bLimit){
    expired.push("breakfast");
    // alert("breakfast");
  }

  const lLimit = new Date(mealDate);
  lLimit.setHours(10, 0, 0, 0);
  if (mealData.lunch > 0 && now > lLimit){
    expired.push("lunch");
    // alert("lunch");
  } 

  const dLimit = new Date(mealDate);
  dLimit.setHours(15, 0, 0, 0);
  if (mealData.dinner > 0 && now > dLimit){
    expired.push("dinner");
    // alert("dinner");
  }

  return expired;  // ex: ["lunch", "dinner"]
}

// 사용 안함.
function checkTimeLimit(date, breakfast, lunch, dinner) {
    const now = getKSTDate();
    const mealDate = new Date(date);
    mealDate.setHours(0, 0, 0, 0);  // ← 여기 추가!!
    const errors = [];


  
    const bLimit = new Date(mealDate);
    bLimit.setDate(bLimit.getDate() - 1);
    bLimit.setHours(15, 0, 0, 0);
    if (breakfast > 0 && now > bLimit) errors.push("조식");
  
    const lLimit = new Date(mealDate);
    lLimit.setHours(10, 0, 0, 0);
    if (lunch > 0 && now > lLimit) errors.push("중식");
  
    const dLimit = new Date(mealDate);
    dLimit.setHours(15, 0, 0, 0);
    if (dinner > 0 && now > dLimit) errors.push("석식");
    
  
    if (errors.length > 0) {
      showToast(`❗ ${errors.join(", ")}은(는) 신청 마감되었습니다.`);
      alert(errors.join(", ") + '은 마감시간이 자났습니다.');
      return false;
    }
    return true;

}

function isDeadlinePassed(date, mealType, quantity) {
  //if (quantity === 0) return false;
  const now = getKSTDate();
  const mealDate = new Date(date);
  mealDate.setHours(0, 0, 0, 0);  // ← 여기 추가!!

  if (mealType === "breakfast") {
    mealDate.setDate(mealDate.getDate() - 1);
    mealDate.setHours(9, 0, 0, 0);
  } else if (mealType === "lunch") {
    mealDate.setHours(10, 30, 0, 0);
  } else if (mealType === "dinner") {
    mealDate.setHours(14, 30, 0, 0);
  }

  return now > mealDate;
}

function updateDeadlineColors() {
  const date = document.getElementById("visit-date").value;
  if (!date) return;

  const breakfastInput = document.getElementById("b-count");
  const lunchInput = document.getElementById("l-count");
  const dinnerInput = document.getElementById("d-count");

  const now = getKSTDate();
  const mealDate = new Date(date);

  // 초기화
  [breakfastInput, lunchInput, dinnerInput].forEach(input => {
    input.classList.remove("expired-input");
    input.readOnly = false;
    input.style.backgroundColor = "";
    input.title = "";
  });

  // 🟢 1) 식사별 마감 처리
  const bLimit = new Date(mealDate);
  bLimit.setDate(mealDate.getDate() - 1);
  bLimit.setHours(9,0,0,0);
  if (now > bLimit) {
    breakfastInput.classList.add("expired-input");
    breakfastInput.readOnly = true;
    breakfastInput.style.backgroundColor = "#ffe5e5";
    breakfastInput.title = "⛔ 조식은 신청 마감되었습니다.";
  }

  const lLimit = new Date(mealDate);
  lLimit.setHours(10,30,0,0);
  if (now > lLimit) {
    lunchInput.classList.add("expired-input");
    lunchInput.readOnly = true;
    lunchInput.style.backgroundColor = "#ffe5e5";
    lunchInput.title = "⛔ 중식은 신청 마감되었습니다.";
  }

  const dLimit = new Date(mealDate);
  dLimit.setHours(14,30,0,0);
  if (now > dLimit) {
    dinnerInput.classList.add("expired-input");
    dinnerInput.readOnly = true;
    dinnerInput.style.backgroundColor = "#ffe5e5";
    dinnerInput.title = "⛔ 석식은 신청 마감되었습니다.";
  }

  

  // 🟢 2) 최종: 다음주 마감 처리
  if (isNextWeekDeadlinePassed(date)) {
    [breakfastInput, lunchInput, dinnerInput].forEach(input => {
      input.readOnly = true;
      input.style.backgroundColor = "#ffe5e5";
      input.title = "⛔ 다음 주 식사는 이번 주 수요일 이후에는 신청할 수 없습니다.";
    });
  }
}

  
// ✅ 1. 수정 버튼 클릭 시 해당 행을 수정 모드로 전환
function saveVisitEdit(id) {
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;

  const date = tr.querySelector(".date-cell").innerText;

  // 🔒 다음 주 마감 검사
  if (isNextWeekDeadlinePassed(date)) {
    alert("⛔ 다음 주 식사는 이번 주 수요일 이후에는 수정할 수 없습니다.");
    loadWeeklyVisitData();
    return;
  }

  // ✅ 1. 현재 화면에서 원본 값을 구성
  const bEditable = !isDeadlinePassed(date, "breakfast");
  const lEditable = !isDeadlinePassed(date, "lunch");
  const dEditable = !isDeadlinePassed(date, "dinner");

  // 조/중/석식 원래 값은 span 또는 input[type=hidden]에 있음
  const original = {
    breakfast: +tr.querySelector(".b-cell span")?.innerText || +tr.querySelector(".b-cell input")?.value || 0,
    lunch:     +tr.querySelector(".l-cell span")?.innerText || +tr.querySelector(".l-cell input")?.value || 0,
    dinner:    +tr.querySelector(".d-cell span")?.innerText || +tr.querySelector(".d-cell input")?.value || 0,
    reason:    tr.querySelector(".r-cell input")?.defaultValue || tr.querySelector(".r-cell span")?.innerText || ""
  };

  // ✅ 2. 새 입력값 읽기 (수정 가능한 것만)
  const breakfast = bEditable
    ? +tr.querySelector(".b-cell input")?.value
    : original.breakfast;

  const lunch = lEditable
    ? +tr.querySelector(".l-cell input")?.value
    : original.lunch;

  const dinner = dEditable
    ? +tr.querySelector(".d-cell input")?.value
    : original.dinner;

  const reasonInput = tr.querySelector(".r-cell input");
  const reason = reasonInput ? reasonInput.value.trim() : original.reason;

  // ✅ 사유는 필수
  if (!reason) {
    alert("❗ 사유를 입력해주세요.");
    return;
  }

  // ✅ 3. payload: 변경된 항목만 포함
  const payload = {};
  if (bEditable && breakfast !== original.breakfast) payload.breakfast = breakfast;
  if (lEditable && lunch     !== original.lunch)     payload.lunch     = lunch;
  if (dEditable && dinner    !== original.dinner)    payload.dinner    = dinner;
  if (reason !== original.reason)                    payload.reason    = reason;

  if (Object.keys(payload).length === 0) {
    alert("변경된 내용이 없습니다.");
    loadWeeklyVisitData();
    return;
  }

  // ✅ 4. 변경 로그 작성 (선택)
  const changeText = compareVisitorChanges(original, { breakfast, lunch, dinner });
  if (changeText) {
    postData("/visitor_logs", {
      visitor_id: id,
      applicant_id: sessionStorage.getItem("id"),
      applicant_name: sessionStorage.getItem("name"),
      dept: sessionStorage.getItem("dept"),
      date,
      before_state: `조(${original.breakfast}), 중(${original.lunch}), 석(${original.dinner})`,
      after_state:  `조(${breakfast}), 중(${lunch}), 석(${dinner})`,
      changed_at: new Date().toISOString()
    });
  }

  // ✅ 5. PUT 요청
  putData(`${API_BASE_URL}/visitors/${id}`, payload, () => {
    showToast("✅ 수정 완료");
    loadWeeklyVisitData();
  });
}




  // ✅ 기존 값 불러오기
  // getData(`/visitors/${id}`, (original) => {
  //   if (!original) {
  //     alert("📛 기존 데이터를 불러올 수 없습니다.");
  //     return;
  //   }

  //   const before = `조식(${original.breakfast}), 중식(${original.lunch}), 석식(${original.dinner})`;
  //   const after  = `조식(${breakfast}), 중식(${lunch}), 석식(${dinner})`;

  //   const logPayload = {
  //     visitor_id: id,
  //     applicant_id: original.applicant_id,
  //     applicant_name: original.applicant_name,
  //     dept: original.dept,
  //     date,
  //     before_state: before,
  //     after_state: after,
  //     changed_at: new Date().toISOString()
  //   };

  //   // ✅ 수정 먼저 저장
  //   const data = { breakfast, lunch, dinner, reason };

  //   putData(`${API_BASE_URL}/visitors/${id}`, data, () => {
  //     showToast("✅ 수정 완료");
  //     alert("✅ 수정 완료");
      
  //     postData("/visitor_logs", logPayload);  // ✅ 로그 저장
  //     loadWeeklyVisitData();
  //   });
  // });




function isRowExpired(row) {
  return (
    isDeadlinePassed(row.date, 'breakfast', row.breakfast) &&
    isDeadlinePassed(row.date, 'lunch', row.lunch) &&
    isDeadlinePassed(row.date, 'dinner', row.dinner)
  );
}

function getNearestWeekday(dateObj) {
  const day = dateObj.getDay();
  if (day === 6) dateObj.setDate(dateObj.getDate() + 2); // 토요일
  else if (day === 0) dateObj.setDate(dateObj.getDate() + 1); // 일요일
  return dateObj;
}

// ✅ 변경 로그용 비교 함수
/**function compareVisitorChanges(prev, current) {
  const changes = [];

  if (prev.breakfast !== current.breakfast) {
    changes.push(`조식(${prev.breakfast}→${current.breakfast})`);
  }
  if (prev.lunch !== current.lunch) {
    changes.push(`중식(${prev.lunch}→${current.lunch})`);
  }
  if (prev.dinner !== current.dinner) {
    changes.push(`석식(${prev.dinner}→${current.dinner})`);
  }

  return changes.length > 0 ? changes.join(", ") : null;
}
**/
// 뒤로 가기
function goToMain() {
    localStorage.removeItem("lastVisitDate");
    localStorage.removeItem("lastWeeklyVisitDate");  // ✅ 날짜를 브라우저에 삭제
    sessionStorage.clear();  // ✅ 모든 로그인 정보 제거
    // window.location.reload();
    // window.currentUser = null;
    window.location.href = "index.html";
}
  