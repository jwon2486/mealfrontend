// import { getData, postData, fetchHolidayList, normalizeDate } from "./util.js";

let holidayList = [];  // 서버에서 불러온 공휴일 날짜 배열
let holidayMap = {};   // ⬅️ 날짜(YYYY-MM-DD) → 설명 텍스트
let flag_type = "직영";
let isSelfcheckLate = false;  // ✅ 본인확인했지만 제한시간보다 늦게 체크했을때
window.mealCreatedAtMap = window.mealCreatedAtMap || {};          // { 'YYYY-MM-DD': 'YYYY-MM-DD HH:MM:SS' }
window.selfcheckCreatedAtMap = window.selfcheckCreatedAtMap || {}; // { 'YYYY-MM-DD(주 시작)': 'YYYY-MM-DD HH:MM:SS' }




// ✅ 로그인 처리
function login(event) {
    console.log("🧪 login() 함수 실행됨");
    if (event) event.preventDefault();

    const userId = document.getElementById("userId").value.trim();
    const userName = document.getElementById("userName").value.trim();

    if (!userId || !userName) {
        alert("사번과 이름을 입력해주세요.");
        return;
    }

    // 관리자 로그인
    if (userId === "admin" && userName === "admin") {
        window.location.href = "admin_dashboard.html";
        return;
    }

    const url = `/login_check?id=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}`;

    
    getData(url, (data) => {


        if (!data.valid) {
            alert("❌ 등록되지 않은 사용자입니다.");
            return;
        }

        // ✅ 로그인 성공: 사용자 정보 저장
            window.currentUser = {
            userId: data.id,
            userName: data.name,
            dept: data.dept,
            rank: data.rank,
            type: data.type,
            level: data.level,  // ✅ level 추가
            region: data.region
        };
        if (data && data.created_at) window.currentUser.created_at = data.created_at;

        // alert(data.type);
        
        
        sessionStorage.setItem("flagType", data.type);
        flag_type = sessionStorage.getItem("flagType");
        //alert(flag_type + 'flag');


        sessionStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        // 🔥 로그인 성공 직후 topbar 업데이트
        const topUserText = document.getElementById("topUserText");
        if (topUserText) {
        topUserText.textContent = `${data.name}님`;
        }

        // 로그인 성공 후
        if (document.getElementById("rememberMe").checked) {
            localStorage.setItem("savedUserId", userId);
            localStorage.setItem("savedUserName", userName);
        } else {
            localStorage.removeItem("savedUserId");
            localStorage.removeItem("savedUserName");
        }
        
        document.getElementById("deadline-info").style.display = "block";

        // ✅ 버튼 초기화 및 표시 처리
const adminBtn = document.getElementById("adminBtn");
const teamEditBtn = document.getElementById("teamEditButton");
if (adminBtn) adminBtn.style.display = "none";
if (teamEditBtn) teamEditBtn.style.display = "none";

if (window.currentUser.level === 3 && adminBtn) {
    adminBtn.style.display = "inline-block";
}
if (window.currentUser.level === 2 && teamEditBtn) {
    teamEditBtn.style.display = "inline-block";
}

        // ✅ 사용자 type에 따라 화면 분기
        if (data.type === "협력사" || data.type === "방문자") {
            window.location.href = "visitor_request.html";
            return;
        }

        

        document.getElementById("login-wrapper").style.display = "none";
        document.getElementById("mainArea").style.display = "block";
        document.getElementById("deadline-info").style.display = "block";  // 추가
        
        // ✅ 내부 요소들도 명시적으로 보이게 설정
        document.getElementById("date-picker-container").style.display = "block";
        document.getElementById("meal-container").style.display = "block";
        document.getElementById("weekPicker").style.display = "inline-block";
        document.getElementById("welcome").style.display = "block";
        document.getElementById("weekRangeText").style.display = "block";
        document.getElementById("mealSummary").style.display = "block";
        document.getElementById("welcome").innerText = `${data.name}님 (${data.dept}), 안녕하세요.`;


        
        setDefaultWeek(); // 🟡 로그인 시 기본 주차 설정
        loadWeekData();

        // ✅ 식단표 게시판 초기화/권한 반영
        if (typeof initMenuBoard === "function") initMenuBoard();

    }, (err) => {
        //alert("❌ 로그인 실패: " + err.message);
        alert("❌ 로그인 실패: " + '올바른 정보를 입력해주세요!');
    });
    
        
}

let isAllSelected = false;  // 현재 상태 기억

function toggleSelectAll() {
    const btnList = document.querySelectorAll(".meal-btn");
    let changed = false;

    btnList.forEach(btn => {
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        // ① 마감된 식사 제외
        if (isDeadlinePassed(date, type)) return;

        // ② 공휴일인 경우 제외
        if (holidayList.includes(normalizeDate(date))) return;

        const shouldSelect = !isAllSelected;
        const selected = btn.classList.contains("selected");

        if (shouldSelect && !selected) {
            toggleMeal(btn);
            changed = true;
        } else if (!shouldSelect && selected) {
            toggleMeal(btn);
            changed = true;
        }
    });
    // 반전
    if (changed) {
        isAllSelected = !isAllSelected;
        const toggleBtn = document.getElementById("toggleSelectBtn");
        toggleBtn.innerText = isAllSelected ? "전체 선택 해제" : "전체 선택";
    }
}

// ✅ 최종 로그아웃 (세션만 정리, 저장 로그인 정보는 유지)
function logout() {
  // 1) 세션(로그인 상태)만 제거
  sessionStorage.removeItem("currentUser");
  sessionStorage.removeItem("flagType");
  sessionStorage.removeItem("selfcheckCreatedAtMap"); // 선택: 본인확인 캐시 초기화

  window.currentUser = null;

  // 2) 화면 전환 (메인 숨기고 로그인 보여주기)
  const mainArea = document.getElementById("mainArea");
  const loginWrapper = document.getElementById("login-wrapper");

  if (mainArea) mainArea.style.display = "none";
  if (loginWrapper) loginWrapper.style.display = "flex";

  // 3) 메인 화면 데이터/UI 초기화
  const mealBody = document.getElementById("meal-body");
  if (mealBody) mealBody.innerHTML = "";

  const weekPicker = document.getElementById("weekPicker");
  if (weekPicker) weekPicker.value = "";

  const welcome = document.getElementById("welcome");
  if (welcome) welcome.innerText = "";

  const weekRangeText = document.getElementById("weekRangeText");
  if (weekRangeText) weekRangeText.innerText = "";

  const mealSummary = document.getElementById("mealSummary");
  if (mealSummary) mealSummary.innerText = "";

  const selfCheck = document.getElementById("selfCheck");
  if (selfCheck) {
    selfCheck.checked = false;
    selfCheck.disabled = false;
    selfCheck.title = "";
  }
  const topUserText = document.getElementById("topUserText");
  if (topUserText) {
  topUserText.textContent = "로그인 필요";
  }

  // 4) 권한 버튼 숨김 (id 혼재 케이스 둘 다 처리)
  //관리자 버튼 숨김
  const adminBtn = document.getElementById("adminBtn");
  if (adminBtn) adminBtn.style.display = "none";
  // 팀 관리 버튼 숨김
  const teamEditButton = document.getElementById("teamEditButton");
  if (teamEditButton) teamEditButton.style.display = "none";

  if (typeof showToast === "function") showToast("로그아웃 되었습니다.");
}

//토스트 출력 창은 새로고침등이 발생할땐 숨김
function showToast(msg){
  const toast = document.getElementById("toast");

  toast.textContent = msg;
  toast.style.display = "block";

  setTimeout(()=>{
    toast.textContent = "";
    toast.style.display = "none";
  }, 2500);
}


// ✅ 선택된 주간 날짜 배열 반환
function getCurrentWeekDates() {
    const selected = document.getElementById("weekPicker").value;
    const selectedDate = new Date(selected);


    const dayOfWeek = selectedDate.getDay(); // 0(일) ~ 6(토)

    // 🟡 월요일 계산 (일요일이면 -6, 나머진 1-day)
    const diffToMonday = dayOfWeek === 0 ? +1 : 1 - dayOfWeek;
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() + diffToMonday);

    const dates = [];
    for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push(date.toISOString().split("T")[0]);
    }

    return dates;
}

// ✅ 주간 식수 신청 테이블 동적 생성
function renderMealTable(dates) {
    const tableBody = document.getElementById("meal-body");
    tableBody.innerHTML = "";

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    dates.forEach(dateStr => {
        const date = new Date(dateStr);
        const weekday = weekdays[date.getDay()];
        const isHoliday = holidayList.includes(normalizeDate(dateStr));

        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        dateCell.className = "date";
        dateCell.innerText = dateStr;

        if (isHoliday) {
        dateCell.style.color = "red";
        dateCell.style.backgroundColor = "#ffe6e6";

        // ⬇️ 공휴일 설명 (없으면 "(공휴일)"로 표시)
        const key  = normalizeDate(dateStr);
        const desc = (holidayMap && holidayMap[key]) ? holidayMap[key] : "";
        const sub  = document.createElement("div");
        sub.className = "holiday-desc";
        sub.innerText = desc ? `(${desc})` : "(공휴일)";//
        //sub.style.fontSize = "1rem";//
        //sub.style.marginTop = "0px";////
        dateCell.appendChild(sub);
        }

        const dayCell = document.createElement("td");
        dayCell.className = "day";
        dayCell.innerText = weekday;
        if (isHoliday) {
            dayCell.style.color = "red";
            dayCell.style.backgroundColor = "#ffe6e6";
        }

        row.appendChild(dateCell);
        row.appendChild(dayCell);

        ["조식", "중식", "석식"].forEach(type => {
            const btn = document.createElement("button");
            btn.className = "meal-btn";
            btn.dataset.date = dateStr;
            btn.dataset.type = type;

            const cell = document.createElement("td");

            if (type === "조식") cell.className = "breakfast";
            if (type === "중식") cell.className = "lunch";
            if (type === "석식") cell.className = "dinner";

            if (isBlockedWeek) {
                btn.disabled = true;
                btn.innerText = "🚫 차단됨";
                btn.style.backgroundColor = "#ccc";
                btn.style.color = "#666";
                btn.title = "앞 주 신청 및 본인 확인이 없어 차단됨";
            } else if (isHoliday) {
                btn.style.color = "red";
                btn.innerText = "❌공휴일";
                btn.disabled = false;
                btn.title = "공휴일 신청 불가";
                btn.onclick = () => alert("⛔ 공휴일에는 식수 신청이 불가능합니다.");
                cell.style.backgroundColor = "#ffe6e6";
            } else if (isDeadlinePassed(dateStr, type)) {
                btn.style.backgroundColor = "#ffe6e6";
                btn.style.color = "#666";
                btn.title = "신청 마감됨";
                btn.innerText = "❌ 마감";
                // ✅ 차단 여부에 따라 메시지 분리
            btn.onclick = () => {
            if (isBlockedWeek) {
                alert("전주 본인확인 미체크로 인해 식사 수정이 불가능합니다");
            } else if (isSelfcheckLate) {
                alert("마감시간 이후 본인확인체크하여 식사 신청/변경이 불가능합니다.");
            } else {
                alert(`${type}은 신청 마감 시간이 지났습니다.`);
            }
            };}else {
                btn.innerText = "❌미신청";
                btn.onclick = () => toggleMeal(btn);
            }

            cell.appendChild(btn);
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });
}

// ✅ 버튼 스타일 토글 (신청/미신청 전환)
function toggleMeal(btn) {
    if (btn.classList.contains("selected")) {
        btn.classList.remove("selected");
        btn.innerText = "❌미신청";
        btn.style.backgroundColor = "#e0e0e0";
        btn.style.color = "#000";
    } else {
        btn.classList.add("selected");
        btn.innerText = "✅신청";
        btn.style.backgroundColor = "#28a745";
        btn.style.color = "#fff";
    }
    
    // ✅ 합계 다시 계산
    updateMealSummary(); 
    const currentWeekDates = getCurrentWeekDates();

}

// ✅ 주간 신청 내역 서버에서 불러오기 → 버튼에 반영
function loadWeekData() {
    if (!window.currentUser) return;

    const userId = window.currentUser.userId;
    const userName = window.currentUser.userName;
    const dates = getCurrentWeekDates();
    const start = dates[0];
    const end = dates[dates.length - 1];

    window.currentWeekStartDate = start;
    window.currentWeekEndDate = end;

    checkPreviousWeek(userId, start, () => {
        // ✅ selfcheck 먼저 불러오기
        loadSelfCheck(userId, start, () => {
            // ⬇️ 여기서부터 테이블 렌더링
            document.getElementById("welcome").innerHTML =
                `${userName}님, 안녕하세요.&nbsp;&nbsp;선택 일자: ${start} ~ ${end}`;

            renderMealTable(dates);

            // ✅ meals 불러오기
            const url = `/meals?user_id=${userId}&start=${start}&end=${end}`;
            getData(url, (data) => {
                if (!isBlockedWeek) {
                    dates.forEach(date => {
                        const dayData = data[date];
                        if (!dayData) return;

                        if (dayData && dayData.created_at) {
                            window.mealCreatedAtMap[date] = dayData.created_at;
                        }

                        ["조식", "중식", "석식"].forEach(type => {
                            const key = type === "조식" ? "breakfast" : type === "중식" ? "lunch" : "dinner";
                            if (dayData[key]) {
                                const btn = document.querySelector(`.meal-btn[data-date="${date}"][data-type="${type}"]`);
                                if (btn && !btn.classList.contains("selected")) toggleMeal(btn);
                            }
                        });
                    });
                }
                updateMealSummary();
            });
        });
    });
}


function checkPreviousWeek(userId, currentWeekStart, callback) {
    // ---- 1주 전 주차(바로 전 주) 월요일~금요일 ----
    const lastMonday = new Date(currentWeekStart);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastStart = lastMonday.toISOString().split("T")[0];

    const lastFriday = new Date(lastMonday);
    lastFriday.setDate(lastMonday.getDate() + 4);
    const lastEnd = lastFriday.toISOString().split("T")[0];

    // ---- 2주 전 주차 월요일~금요일 ----
    const prevMonday = new Date(currentWeekStart);
    prevMonday.setDate(prevMonday.getDate() - 14);
    const prevStart = prevMonday.toISOString().split("T")[0];

    const prevFriday = new Date(prevMonday);
    prevFriday.setDate(prevMonday.getDate() + 4);
    const prevEnd = prevFriday.toISOString().split("T")[0];

    // ✅ 두 주의 meals + selfcheck 모두 조회
    Promise.all([
        // 바로 전 주 식사
        new Promise((resolve, reject) =>
            getData(`/meals?user_id=${userId}&start=${lastStart}&end=${lastEnd}`, resolve, reject)
        ),
        // 2주 전 식사
        new Promise((resolve, reject) =>
            getData(`/meals?user_id=${userId}&start=${prevStart}&end=${prevEnd}`, resolve, reject)
        ),
        // 바로 전 주 본인확인(월요일)
        new Promise((resolve, reject) =>
            getData(`/selfcheck?user_id=${userId}&date=${lastStart}`, resolve, reject)
        ),
        // 2주 전 본인확인(월요일)
        new Promise((resolve, reject) =>
            getData(`/selfcheck?user_id=${userId}&date=${prevStart}`, resolve, reject)
        )
    ])
    .then(([mealData1, mealData2, checkData1, checkData2]) => {
        // 두 주 중 한 주라도 식사 신청이 있으면 hasMeal = true
        const hasMeal = [mealData1, mealData2].some(mealData =>
            Object.values(mealData).some(day =>
                day.breakfast || day.lunch || day.dinner
            )
        );

        // 두 주 중 한 주라도 본인확인 체크가 있으면 isChecked = true
        const isChecked =
            checkData1.checked === 1 || checkData2.checked === 1;

        if (window.currentUser.region === "에코센터") {
            // ✅ 둘 다 없을 때만 차단
            isBlockedWeek = !hasMeal && !isChecked;
        } else {
            isBlockedWeek = false;
        }

        if (callback) callback();
    })
    .catch(err => console.error("❌ checkPreviousWeek(1~2주 전) 실패:", err));
}




function disableCurrentWeekButtons() {
    document.querySelectorAll(".meal-btn").forEach(btn => {
        btn.disabled = true;
        btn.innerText = "차단됨";
        btn.style.backgroundColor = "#ccc";
        btn.title = "앞 주 신청 및 본인 확인이 없어 차단됨";
    });
}




// ✅ 저장 요청 (선택된 버튼 → 서버로 전송)
function saveMeals() {
    const checkbox = document.getElementById("selfCheck");
    const checkedValue = checkbox && checkbox.checked ? 1 : 0;

    // ✅ [추가] 본인확인 없이 식사만 선택했는지 검사
    let hasMealSelected = false;
    document.querySelectorAll(".meal-btn.selected").forEach(() => {
        hasMealSelected = true;
    });



    // === 저장 버튼 가드: 다른 주/다음 주 마감 로직 ===
    const weekStartStr = window.currentWeekStartDate;
     // ✅ 2주 뒤 주차 이상이면 마감 규칙 무시하고 저장 허용
    if (!isTwoWeeksLaterOrMore(weekStartStr)) {
    // 1) '다음 주' 글로벌 마감: 이번 주 수요일 16:00 이후면 저장 차단
    if (isNextWeekGloballyClosed(weekStartStr)) {
    alert("마감시간이 지났기 때문에 변경이 불가능합니다. (다음 주 신청 마감: 이번 주 수요일 16:00)");
    return; // 저장 로직 중단
    }
    }
    // 2) 같은 주/다른 주 분기 + 과거주 저장 가능 기간 가드
    const __sameWeek = isSameWeekAsNow(weekStartStr);
    var __createdAt = null;

    if (!__sameWeek) {
    const { start, end } = getSaveWindowForWeekStart(weekStartStr);
    const __now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
    if (__now < start || __now > end) {
        alert(`지금은 저장 불가(마감 외 기간).\n신청 가능 기간: ${fmtKST(start)} ~ ${fmtKST(end)} (KST)`);
        return; // 저장 로직 중단
    }
    __createdAt = makeCreatedAt(); // created_at 포함 조건 충족
    }
    // 같은 주면 created_at 전송하지 않음


        if (hasMealSelected && checkedValue === 0) {
            alert("본인확인을 체크해주세요!");
            return;  // ⛔ 저장 로직 중단
        }
    postData("/selfcheck", {
    user_id: window.currentUser.userId,
    date: window.currentWeekStartDate,
    checked: checkedValue,
    ...(__createdAt ? { created_at: __createdAt } : {})
    },
    () => console.log("✅ selfcheck 저장 성공"),
    (err) => console.error("❌ selfcheck 저장 실패:", err));

        if (!window.currentUser) {
            const savedUser = sessionStorage.getItem("currentUser");
            if (savedUser) {
                window.currentUser = JSON.parse(savedUser);  // 복원 시도
            } else {
                alert("로그인 정보가 만료되었습니다. 다시 로그인해주세요.");
                location.href = "index.html";
                return;
            }
        }

    const userId = window.currentUser.userId;
    const userName = window.currentUser.userName;
    const dept =  window.currentUser.dept;
    const meals = [];
    const dates = getCurrentWeekDates();

    dates.forEach(date => {
        const meal = {
            user_id: userId,
            name: userName,
            dept,
            date,
            breakfast: 0,
            lunch: 0,
            dinner: 0,
            ...(__createdAt ? { created_at: __createdAt } : {})
        };

        // 버튼 상태 조회
        document.querySelectorAll(`.meal-btn[data-date="${date}"]`).forEach(btn => {
            const type = btn.dataset.type;
            if (btn.classList.contains("selected")) {
                if (type === "조식") meal.breakfast = 1;
                if (type === "중식") meal.lunch = 1;
                if (type === "석식") meal.dinner = 1;
            }
        });

        meals.push(meal); // 무조건 포함
    });

    console.log("🧪 전송할 meals:", meals);  // 추가

    


    // 서버에 POST 요청
    postData("/meals", { meals },
        () => {
            showToast("✅ 저장 완료");
            alert("✅ 저장되었습니다.");
            loadWeekData(); // 저장 후 다시 불러오기
        },
        (err) => showToast("❌ 저장 실패: " + err.message)
    );
}

function updateMealSummary() {
    let breakfast = 0, lunch = 0, dinner = 0;
  
    document.querySelectorAll(".meal-btn.selected").forEach(btn => {
      const type = btn.dataset.type;
      if (type === "조식") breakfast++;
      else if (type === "중식") lunch++;
      else if (type === "석식") dinner++;
    });
  
    const total = breakfast + lunch + dinner;
  
    const summaryText = `총 식수 ${total} (조식 ${breakfast}, 중식 ${lunch}, 석식 ${dinner})`;
    document.getElementById("mealSummary").innerText = summaryText;
}
  

// // ✅ fetch - GET
// function getData(url, onSuccess, onError) {
//     fetch(url)
//         .then(res => res.ok ? res.json() : Promise.reject(res))
//         .then(onSuccess)
//         .catch(err => {
//             console.error("GET 오류:", err);
//             if (onError) onError(err);
//         });
// }

// ✅ fetch - POST
// function postData(url, data, onSuccess, onError) {
//     fetch(url, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(data)
//     })
//         .then(res => res.ok ? res.json() : Promise.reject(res))
//         .then(onSuccess)
//         .catch(err => {
//             console.error("POST 오류:", err);
//             if (onError) onError(err);
//         });
// }

//이번주 날짜 함수
function isThisWeek(dateStr) {
    //const now = getKSTDate ? getKSTDate() : new Date();
    const now = (typeof getKSTDate === "function") ? getKSTDate() : new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const target = new Date(dateStr);
    return target >= monday && target <= sunday;
}



// ✅ 오늘 기준으로 다음 주 월요일 날짜 반환
// function setDefaultWeek() {
//   const today = new getKSTDate();
//   const day = today.getDay();
//   const diffToMonday = day === 0 ? -6 : 1 - day;

//   const monday = new Date(today);

//   // 에코센터: 다음 주 월요일, 그 외: 이번 주 월요일
//   if (window.currentUser?.region === "에코센터") {
//     monday.setDate(today.getDate() + diffToMonday + 7);
//   } else {
//     monday.setDate(today.getDate() + diffToMonday);
//   }

//   document.getElementById("weekPicker").value = monday.toISOString().split("T")[0];
// }

function setDefaultWeek() {
  const today = (typeof getKSTDate === "function") ? getKSTDate() : new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(today);

  // 에코센터: 다음 주 월요일, 그 외: 이번 주 월요일
  if (window.currentUser?.region === "에코센터") {
    monday.setDate(today.getDate() + diffToMonday + 7);
  } else {
    monday.setDate(today.getDate() + diffToMonday);
  }

  document.getElementById("weekPicker").value = monday.toISOString().split("T")[0];
}



// ✅ 마감시간 규칙
function isDeadlinePassed(dateStr, mealType) {
    const now = getKSTDate();
    const mealDate = new Date(dateStr);
    mealDate.setHours(0, 0, 0, 0);

    if (isTwoWeeksLaterOrMore(dateStr)) {
    return false; // 마감 규칙 무시 → 버튼 항상 활성화
    }
    

    // ① 이번 주(현재 진행 중인 주)의 식사인가?
    if (isThisWeek(dateStr)) {
    const isEco = window.currentUser?.region === "에코센터";
    if (!isEco) {
        // 에코센터가 아니면 → 일반 식사별 마감만 적용
        let deadline = new Date(mealDate);
        if (mealType === "조식") {
            deadline.setDate(mealDate.getDate() - 1);
            deadline.setHours(9, 0, 0, 0);
        } else if (mealType === "중식") {
            deadline.setHours(10, 30, 0, 0);
        } else if (mealType === "석식") {
            deadline.setHours(14, 30, 0, 0);
        }
        return now > deadline;
    }
        // 이번 주 월요일(YYYY-MM-DD) 키로 selfcheck.created_at 조회
        const weekMonday = mondayOfNow(); 
        const createdAtStr = window.selfcheckCreatedAtMap[weekMonday];

        // (A) 이번 주에 대한 selfcheck 기록 자체가 없으면 ⇒ 마감
        if (!createdAtStr) return true;

        // (B) selfcheck를 저번 주 수요일 16:00 이후에 했다면 ⇒ 마감
        const createdAt = new Date(createdAtStr.replace(' ', 'T') + '+09:00');
        if (createdAt > lastWeekWednesdayCutoff()) {
        isSelfcheckLate = true;   // ✅ 추가
        return true;
        }

        // (C) 통과했다면, 식사별 당일/전날 마감시각 적용
        let deadline = new Date(mealDate);
        if (mealType === "조식") {
            deadline.setDate(mealDate.getDate() - 1); // 전날 09:00
            deadline.setHours(9, 0, 0, 0);
        } else if (mealType === "중식") {
            deadline.setHours(10, 30, 0, 0);          // 당일 10:30
        } else if (mealType === "석식") {
            deadline.setHours(14, 30, 0, 0);          // 당일 14:30
        }
        return now > deadline;
    }

    // ② 다음 주 식사: 이번 주 수요일 16:00 이후면 전체 마감
    const thisMonday = new Date(now);
    const day = thisMonday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    thisMonday.setDate(now.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);

    const thisWednesdayDeadline = new Date(thisMonday);
    thisWednesdayDeadline.setDate(thisMonday.getDate() + 2); // 수요일
    thisWednesdayDeadline.setHours(16, 0, 0, 0);

    return now > thisWednesdayDeadline;
}

// === KST & Deadline Utilities (week-level created_at window) ===
const pad2 = n => String(n).padStart(2,'0');
const fmtKST = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const ymdKST = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseYMDKST = ymd => new Date(`${ymd}T00:00:00+09:00`);

function mondayOf(d) {
  const copy = new Date(d);
  const idx = (copy.getDay()+6)%7; // Mon=0..Sun=6
  copy.setHours(0,0,0,0);
  copy.setDate(copy.getDate()-idx);
  return copy;
}
function mondayOfNow() {
  const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
  return ymdKST(mondayOf(now));
}

// 선택 주(월요일) 기준 저장 가능 기간: [2주 전 월 00:00:00, 1주 전 수 15:59:59]
function getSaveWindowForWeekStart(weekStartStr) {
  const weekStart = parseYMDKST(weekStartStr);
  const start = new Date(weekStart); start.setDate(start.getDate()-14); start.setHours(0,0,0,0);
  const end   = new Date(weekStart); end.setDate(end.getDate()-5);     end.setHours(15,59,59,999);
  return { start, end };
}

function isSameWeekAsNow(weekStartStr) {
  return weekStartStr === mondayOfNow();
}

// “이번 주 수요일 16:00” 이후면 다음 주는 글로벌 마감
function isNextWeekGloballyClosed(weekStartStr) {
  const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
  const thisMon = parseYMDKST(mondayOfNow());
  const nextMon = new Date(thisMon); nextMon.setDate(nextMon.getDate()+7);
  const isNextWeek = (weekStartStr === ymdKST(nextMon));
  if (!isNextWeek) return false;

  const wedCutoff = new Date(thisMon);    // 이번 주 수요일 16:00
  wedCutoff.setDate(thisMon.getDate()+2);
  wedCutoff.setHours(16,0,0,0);
  return now > wedCutoff;
}

function makeCreatedAt() {
  const d = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
  return fmtKST(d); // 'YYYY-MM-DD HH:MM:SS'
}



// ✅ 자동 로그인 및 주차 변경 이벤트
document.addEventListener("DOMContentLoaded", function () {
    // ✅ [수정] selfcheckCreatedAtMap 세션 복원 (가장 먼저 실행되도록 이동)
    const savedSelfcheckMap = sessionStorage.getItem("selfcheckCreatedAtMap");
    if (savedSelfcheckMap) {
        window.selfcheckCreatedAtMap = JSON.parse(savedSelfcheckMap);
    }
    setDefaultWeek(); // ✅ 이번 주 자동 설정
    const savedUser = sessionStorage.getItem("currentUser");
    const year = new Date().getFullYear();

    // ✅ localStorage에 저장된 로그인 정보 불러오기
    const savedId = localStorage.getItem("savedUserId");
    const savedName = localStorage.getItem("savedUserName");

    if (savedId && savedName) {
        const userIdInput = document.getElementById("userId");
        const userNameInput = document.getElementById("userName");
        const rememberCheckbox = document.getElementById("rememberMe");

        if (userIdInput && userNameInput && rememberCheckbox) {
            userIdInput.value = savedId;
            userNameInput.value = savedName;
            rememberCheckbox.checked = true;
        }
    }


    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        flag_type = sessionStorage.getItem("flagType");
        const topUserText = document.getElementById("topUserText");
    if (topUserText && window.currentUser) {
    topUserText.textContent = `${window.currentUser.userName}님`;
    }

        // ✅ 관리자 버튼 노출 여부 처리
        const adminBtn = document.getElementById("adminBtn");
        if (window.currentUser?.level === 3 && adminBtn) {
            adminBtn.style.display = "inline-block";
        }
        // ✅ 부서원 신청 관리 버튼 노출 조건
        const teamEditBtn = document.getElementById("teamEditButton");
        if (window.currentUser?.level === 2 && teamEditBtn) {
        teamEditBtn.style.display = "inline-block";
        }
       
        if (flag_type !== "직영"){
            //const userId = sessionStorage.getItem("id");
            //const userType = sessionStorage.getItem("type");
    
            // 로그인 정보 없으면 로그인 페이지로 리디렉션
            // if (!userId || !userType) {
            //     alert("로그인이 필요합니다.");
            //     location.href = "index.html";
            //     return;
            // }
    
            // 협력사나 방문자가 index.html에 접근한 경우 강제 이동
            if (flag_type !== "직영" && location.pathname.includes("index.html")) {
                logout();
                window.location.reload();
                //location.href = "visitor_request.html";
            }
        }
    }


    const nextYear = year + 1;

fetchHolidayList(`/api/public-holidays?year=${year}`, (holidaysThisYear) => {
  fetchHolidayList(`/api/public-holidays?year=${nextYear}`, (holidaysNextYear) => {

    // 1) 두 해 결과 합치기
    const merged = []
      .concat(Array.isArray(holidaysThisYear) ? holidaysThisYear : [])
      .concat(Array.isArray(holidaysNextYear) ? holidaysNextYear : []);

    // 2) holidayList/holidayMap 구성 (기존 로직 그대로 확장)
    holidayList = merged.map(h =>
      (typeof h === "string") ? normalizeDate(h) : normalizeDate(h.date)
    );

    holidayMap = {};
    merged.forEach(h => {
      const key  = (typeof h === "string") ? normalizeDate(h) : normalizeDate(h.date);
      const desc = (typeof h === "string") ? "" : (h.description || h.desc || h.name || "");
      holidayMap[key] = desc;
    });

    // 3) 기존 savedUser 자동로그인 흐름 그대로 유지
    if (savedUser) {
      window.currentUser = JSON.parse(savedUser);
      document.getElementById("userId").value = window.currentUser.userId;
      document.getElementById("userName").value = window.currentUser.userName;

      document.getElementById("login-wrapper").style.display = "none";
      document.getElementById("mainArea").style.display = "block";
      document.getElementById("welcome").innerText =
        `${window.currentUser.userName}님 (${window.currentUser.dept} / ${window.currentUser.rank}) 안녕하세요.`;

      loadWeekData();

      // ✅ 식단표 게시판 초기화/권한 반영
      if (typeof initMenuBoard === "function") initMenuBoard();
    }
  });
});
// 주 선택 시 자동 갱신
    document.getElementById("weekPicker").addEventListener("change", loadWeekData);
});

document.getElementById("rememberMe").addEventListener("change", function () {
    if (!this.checked) {
        // 체크 해제되면 input 초기화
        document.getElementById("userId").value = "";
        document.getElementById("userName").value = "";
    }
});

function lastWeekWednesdayCutoff() {
    const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    // 이번 주 월요일
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0,0,0,0);

    // 저번 주 수요일 16:00
    const lastWed = new Date(thisMonday);
    lastWed.setDate(thisMonday.getDate() - 5); // 저번 주 수요일
    lastWed.setHours(16,0,0,0);
    return lastWed;
}


function goToVisitor() {
    location.href = "visitor_request.html";
}

function goToAdminDashboard() {
    location.href = "admin_dashboard.html";
}

function goToTeamEdit() {
    location.href = "team_edit.html";
}

function isTwoWeeksLaterOrMore(weekStartStr) {
    const now = (typeof getKSTDate === 'function') ? getKSTDate() : new Date();
    const thisMonday = mondayOf(now); // 이번 주 월요일
    const twoWeeksLaterMonday = new Date(thisMonday);
    twoWeeksLaterMonday.setDate(thisMonday.getDate() + 14); // 2주 뒤 월요일

    return new Date(weekStartStr) >= twoWeeksLaterMonday;
}

//체크박스 상태 불러오는 함수
function loadSelfCheck(userId, date, callback) {
  const checkbox = document.getElementById("selfCheck");
  if (!checkbox) {
    if (callback) callback();
    return;
  }

  getData(`/selfcheck?user_id=${userId}&date=${date}`,
    (data) => {
      if (data && data.created_at) {
        window.selfcheckCreatedAtMap[date] = data.created_at;
        sessionStorage.setItem("selfcheckCreatedAtMap", JSON.stringify(window.selfcheckCreatedAtMap));
      }
      checkbox.checked = data.checked === 1;

      // 주차 종료일 이후면 비활성화
      const currentDate = new Date();
      const weekStart = new Date(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4);

      checkbox.disabled = currentDate > weekEnd;
      checkbox.title = checkbox.disabled ? "이미 지난 주의 본인 확인은 수정할 수 없습니다." : "";

      if (callback) callback();   // 🔥 호출 보장
    },
    (error) => {
      console.error("❌ selfcheck 불러오기 실패:", error);
      if (callback) callback();   // 실패해도 테이블은 그려야 하므로 실행
    }
  );
}



// ✅ 전역 함수 등록
window.login = login;
window.logout = logout;
window.saveMeals = saveMeals;
window.loadWeekData = loadWeekData;
window.goToVisitor = goToVisitor;
window.goToTeamEdit = goToTeamEdit;
let isBlockedWeek = false;  // ✅ 차단 여부 전역 저장


/* ==========================================
   🖼️ 식단표 게시판 (Refactor)
========================================== */

function isAdminUser() {
  try {
    const user =
      window.currentUser ||
      JSON.parse(sessionStorage.getItem("currentUser") || "null");
    return !!user && String(user.level) === "3";
  } catch (error) {
    console.error("❌ 관리자 권한 확인 실패:", error);
    return false;
  }
}

function getApiBaseUrl() {
  if (typeof API_BASE_URL === "string" && API_BASE_URL.trim()) {
    return API_BASE_URL.replace(/\/+$/, "");
  }
  if (window.API_BASE_URL && String(window.API_BASE_URL).trim()) {
    return String(window.API_BASE_URL).replace(/\/+$/, "");
  }
  return "";
}

function buildApiUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const base = getApiBaseUrl();
  if (!base) return path;

  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

function safeParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function resolveMenuImageUrl(imageUrl) {
  if (!imageUrl) return "";
  return /^https?:\/\//i.test(imageUrl) ? imageUrl : buildApiUrl(imageUrl);
}

async function requestMenuBoard(path, options = {}) {
  const response = await fetch(buildApiUrl(path), options);
  const rawText = await response.text();
  const json = safeParseJson(rawText);

  if (!response.ok) {
    const message =
      (json && (json.error || json.message)) ||
      rawText ||
      `식단표 요청 실패 (${response.status})`;
    throw new Error(message);
  }

  return json;
}

function openMenuImageModal(src, title) {
  if (!src) return;

  let modal = document.getElementById("menuModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "menuModal";
    modal.className = "menu-modal";
    modal.innerHTML = `
      <div class="menu-modal__backdrop" data-close="1"></div>
      <div class="menu-modal__panel" role="dialog" aria-modal="true" aria-label="식단표 원본 보기">
        <div class="menu-modal__header">
          <div class="menu-modal__title" id="menuModalTitle"></div>
          <button type="button" class="menu-modal__close" aria-label="닫기" data-close="1">✕</button>
        </div>
        <div class="menu-modal__body">
          <img id="menuModalImg" alt="식단표 원본" />
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.getAttribute("data-close") === "1") {
        modal.classList.remove("open");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const menuModal = document.getElementById("menuModal");
        if (menuModal) menuModal.classList.remove("open");
      }
    });
  }

  const image = document.getElementById("menuModalImg");
  const titleNode = document.getElementById("menuModalTitle");

  if (image) image.src = src;
  if (titleNode) titleNode.textContent = title || "식단표";

  modal.classList.add("open");
}

async function fetchMenuBoardItems() {
  const items = await requestMenuBoard("/api/menu-board", {
    method: "GET"
  });

  if (!Array.isArray(items)) {
    throw new Error("식단표 목록 형식이 올바르지 않습니다.");
  }

  return items.map((item) => ({
    ...item,
    image_url: resolveMenuImageUrl(item.image_url)
  }));
}

function createMenuThumb(item, adminMode) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "menu-thumb";
  button.dataset.id = item.id;
  button.dataset.src = item.image_url || "";
  button.dataset.title = item.title || "식단표";
  button.title = item.title || "식단표";

  if (adminMode) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "menu-select";
    checkbox.value = item.id;
    checkbox.setAttribute("aria-label", "삭제할 게시글 선택");

    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    checkbox.addEventListener("change", () => {
      button.classList.toggle("menu-mark-delete", checkbox.checked);
    });

    button.appendChild(checkbox);
  }

  const image = document.createElement("img");
  image.alt = item.title || "식단표 썸네일";
  image.src = item.image_url || "";

  const caption = document.createElement("div");
  caption.className = "menu-item-title";
  caption.textContent = item.title || "식단표";

  button.appendChild(image);
  button.appendChild(caption);

  return button;
}

async function renderMenuBoard() {
  const list = document.getElementById("menuList");
  if (!list) return;

  try {
    list.innerHTML = `<div class="menu-empty">불러오는 중...</div>`;

    const items = await fetchMenuBoardItems();
    const adminMode = isAdminUser();

    list.innerHTML = "";

    if (items.length === 0) {
      list.innerHTML = `<div class="menu-empty">등록된 식단표가 없습니다.</div>`;
      return;
    }

    items.forEach((item) => {
      list.appendChild(createMenuThumb(item, adminMode));
    });
  } catch (error) {
    console.error("❌ 식단표 목록 렌더링 실패:", error);
    list.innerHTML = `<div class="menu-empty">식단표를 불러오지 못했습니다.</div>`;
  }
}

async function uploadMenuBoardImage(file) {
  if (!file) {
    throw new Error("업로드할 파일이 없습니다.");
  }

  const defaultTitle = file.name.replace(/\.[^.]+$/, "");
  const title = prompt(
    "식단표 제목을 입력하세요. (예: 3월 3주차 식단표)",
    defaultTitle
  );

  if (title === null) {
    return { cancelled: true };
  }

  const formData = new FormData();
  formData.append("image", file);
  formData.append("title", title.trim() || defaultTitle);

  const result = await requestMenuBoard("/api/menu-board/upload", {
    method: "POST",
    body: formData
  });

  if (result && result.item) {
    result.item.image_url = resolveMenuImageUrl(result.item.image_url);
  }

  return result || {};
}

async function deleteMenuBoardItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("삭제할 항목이 없습니다.");
  }

  return await requestMenuBoard("/api/menu-board/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ids })
  });
}

async function deleteSelectedMenuBoardItems() {
  const checkedList = Array.from(
    document.querySelectorAll("#menuList .menu-select:checked")
  );

  if (checkedList.length === 0) {
    alert("삭제할 게시글을 체크하세요.");
    return;
  }

  if (!confirm(`선택한 ${checkedList.length}개 게시글을 삭제할까요?`)) {
    return;
  }

  const ids = checkedList.map((checkbox) => checkbox.value);

  try {
    const result = await deleteMenuBoardItems(ids);
    alert(result?.message || "삭제 완료");
    await renderMenuBoard();
  } catch (error) {
    console.error("❌ 식단표 삭제 실패:", error);
    alert(`❌ 식단표 삭제 실패: ${error.message}`);
  }
}

function applyMenuBoardRoleUI() {
  const isAdmin = isAdminUser();
  const adminBar = document.getElementById("menuBoardAdminBar");
  const uploadBtn = document.getElementById("menuUploadBtn");
  const deleteBtn = document.getElementById("menuDeleteBtn");
  const input = document.getElementById("menuUploadInput");

  if (adminBar) {
    adminBar.style.display = isAdmin ? "flex" : "none";
  }

  if (uploadBtn) {
    uploadBtn.style.display = isAdmin ? "inline-flex" : "none";
  }

  if (deleteBtn) {
    deleteBtn.style.display = isAdmin ? "inline-flex" : "none";
    if (!isAdmin) deleteBtn.textContent = "삭제";
  }

  if (input) {
    input.style.display = "none";
    input.value = "";
  }
}

function bindMenuBoardEvents() {
  const list = document.getElementById("menuList");
  const uploadBtn = document.getElementById("menuUploadBtn");
  const deleteBtn = document.getElementById("menuDeleteBtn");
  const input = document.getElementById("menuUploadInput");

  if (list && !list.dataset.menuBoardBound) {
    list.dataset.menuBoardBound = "1";

    list.addEventListener("click", (event) => {
      const button = event.target.closest("button.menu-thumb");
      if (!button) return;

      if (list.classList.contains("select-mode")) {
        const checkbox = button.querySelector(".menu-select");
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          button.classList.toggle("menu-mark-delete", checkbox.checked);
        }
        return;
      }

      const src = button.dataset.src || "";
      const title = button.dataset.title || "식단표";
      openMenuImageModal(src, title);
    });
  }

  if (uploadBtn && input && !uploadBtn.dataset.menuBoardBound) {
    uploadBtn.dataset.menuBoardBound = "1";

    uploadBtn.addEventListener("click", () => {
      if (!isAdminUser()) {
        alert("관리자만 업로드할 수 있습니다.");
        return;
      }
      input.click();
    });
  }

  if (input && !input.dataset.menuBoardBound) {
    input.dataset.menuBoardBound = "1";

    input.addEventListener("change", async (event) => {
      if (!isAdminUser()) {
        alert("관리자만 업로드할 수 있습니다.");
        event.target.value = "";
        return;
      }

      const file = event.target.files && event.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 업로드 가능합니다.");
        event.target.value = "";
        return;
      }

      try {
        const result = await uploadMenuBoardImage(file);
        event.target.value = "";

        if (result?.cancelled) return;

        alert(result?.message || "업로드 완료");
        await renderMenuBoard();
      } catch (error) {
        console.error("❌ 식단표 업로드 실패:", error);
        alert(`❌ 식단표 업로드 실패: ${error.message}`);
        event.target.value = "";
      }
    });
  }

  if (deleteBtn && list && !deleteBtn.dataset.menuBoardBound) {
    deleteBtn.dataset.menuBoardBound = "1";

    deleteBtn.addEventListener("click", async () => {
      if (!isAdminUser()) {
        alert("관리자만 삭제할 수 있습니다.");
        return;
      }

      const inSelectMode = list.classList.contains("select-mode");

      if (!inSelectMode) {
        list.classList.add("select-mode");
        deleteBtn.textContent = "선택 삭제";
        alert("삭제할 게시글을 체크한 뒤 다시 눌러주세요.");
        return;
      }

      await deleteSelectedMenuBoardItems();
      list.classList.remove("select-mode");
      deleteBtn.textContent = "삭제";
    });
  }
}

function initMenuBoard() {
  applyMenuBoardRoleUI();
  bindMenuBoardEvents();
  renderMenuBoard();
}

// 페이지 최초 로드 시 1회 초기화
document.addEventListener("DOMContentLoaded", () => {
  initMenuBoard();
});
