// import { getData, postData, fetchHolidayList, normalizeDate } from "./util.js";

let holidayList = [];  // 서버에서 불러온 공휴일 날짜 배열
let flag_type = "직영";

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
        };

        // alert(data.type);
        
        
        sessionStorage.setItem("flagType", data.type);
        flag_type = sessionStorage.getItem("flagType");
        //alert(flag_type + 'flag');


        sessionStorage.setItem("currentUser", JSON.stringify(window.currentUser));

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

        

        document.getElementById("login-container").style.display = "none";
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


    }, (err) => {
        alert("❌ 로그인 실패: " + err.message);
    });
    
        
}

let isAllSelected = false;  // 현재 상태 기억

function toggleSelectAll() {
    const btnList = document.querySelectorAll(".meal-btn");
    let changed = false;

    btnList.forEach(btn => {
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        if (isDeadlinePassed(date, type)) return; // 마감된 건 무시

        const shouldSelect = !isAllSelected;

        // 상태 전환 필요할 때만 toggle
        const selected = btn.classList.contains("selected");
        if (shouldSelect && !selected) {
            toggleMeal(btn);
            changed = true;
        } else if (!shouldSelect && selected) {
            toggleMeal(btn);
            changed = true;
        }
    });

    // 상태 반전
    if (changed) {
        isAllSelected = !isAllSelected;
        const toggleBtn = document.getElementById("toggleSelectBtn");
        toggleBtn.innerText = isAllSelected ? "전체 선택 해제" : "전체 선택";
    }
}

function logout() {
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("flag_type");
    window.location.reload();

    // 모든 화면 초기화
    document.getElementById("login-container").style.display = "block";
    document.getElementById("mainArea").style.display = "none";
    document.getElementById("meal-body").innerHTML = "";
    document.getElementById("welcome").innerText = "";
    document.getElementById("weekRangeText").innerText = "";
    document.getElementById("mealSummary").innerText = "";
    

    
}

// ✅ 로그아웃 처리
function logout() {
    sessionStorage.clear();
    window.currentUser = null;

    // 모든 화면 초기화
    document.getElementById("login-container").style.display = "block";
    document.getElementById("date-picker-container").style.display = "none";
    document.getElementById("meal-container").style.display = "none";
    document.getElementById("meal-body").innerHTML = "";
    document.getElementById("welcome").innerText = "";
    document.getElementById("weekRangeText").innerText = "";
    document.getElementById("mealSummary").innerText = ""; 
    document.getElementById("deadline-info").style.display = "none";
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
    tableBody.innerHTML = ""; // 기존 내용 삭제

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    dates.forEach(dateStr => {
        const date = new Date(dateStr);
        const weekday = weekdays[date.getDay()];
        const isHoliday = holidayList.includes(normalizeDate(dateStr));

        const row = document.createElement("tr");

        // 날짜 셀
        const dateCell = document.createElement("td");
        dateCell.innerText = dateStr;
        if (isHoliday) {
            dateCell.style.color = "red";
            dateCell.style.backgroundColor = "#ffe6e6";
        }

        const dayCell = document.createElement("td");
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
            btn.innerText = "❌미신청";

            const cell = document.createElement("td");

            // ✅ 클릭 제한
            if (isHoliday) {
                //btn.style.backgroundColor = "#ffe6e6";
                btn.style.color = "red";
                btn.disabled = false;
                btn.title = "공휴일 신청 불가";
                btn.onclick = () => alert("⛔ 공휴일에는 식수 신청이 불가능합니다.");

                // ✅ 버튼이 들어있는 셀도 붉은색 배경
                cell.style.backgroundColor = "#ffe6e6";
            }
            else if (isDeadlinePassed(dateStr, type)) {
                //btn.disabled = true;
                btn.style.backgroundColor = "#ffe6e6";
                btn.style.color = "#666";
                btn.title = "신청 마감됨";
                btn.innerText = "❌ 마감";
                btn.onclick = () => alert(`${type}은 신청 마감 시간이 지났습니다.`);
            }
            else{
                btn.onclick = () => toggleMeal(btn);
            }
            
           // btn.onclick = function () {
           //     if (isDeadlinePassed(dateStr, type)) {
                    // ✅ 마감된 버튼 클릭 시 토스트만 표시
                    //showToast(`⚠️ ${type}은 신청 마감 시간이 지났습니다.`);
                    //alert(`${type}은 신청 마감 시간이 지났습니다.`);
          //      } else {
                    // ✅ 마감 전이면 정상적으로 토글 동작
           //         toggleMeal(this);
           //     }
           // };
            
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

    // 상단 사용자 이름 및 주간 범위 표시
    document.getElementById("welcome").innerHTML = `${userName}님, 안녕하세요.&nbsp;&nbsp;선택 일자: ${start} ~ ${end}`;
  //document.getElementById("weekRangeText").innerText = `선택 날짜: ${start} ~ ${end} `;

    renderMealTable(dates); // 버튼 테이블 새로 생성

    const url = `/meals?user_id=${userId}&start=${start}&end=${end}`;
    getData(url, (data) => {
        dates.forEach(date => {
            const dayData = data[date];
            if (!dayData) return;

            ["조식", "중식", "석식"].forEach(type => {
                const key = type === "조식" ? "breakfast" : type === "중식" ? "lunch" : "dinner";
                if (dayData[key]) {
                    const btn = document.querySelector(`.meal-btn[data-date="${date}"][data-type="${type}"]`);
                    if (btn && !btn.classList.contains("selected")) toggleMeal(btn);
                }
            });
        });

        // ✅ 합계 다시 계산
        updateMealSummary(); 
    
    });
    // ✅ 체크박스 상태도 같이 불러오기
    loadSelfCheck(userId, start);
}



// ✅ 저장 요청 (선택된 버튼 → 서버로 전송)
function saveMeals() {
  const checkbox = document.getElementById("selfCheck"); // ✅ 여기에서 먼저 선언
  const checkedValue = checkbox && checkbox.checked ? 1 : 0;

  // 이후 서버로 전송
  fetch("/selfcheck", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: window.currentUser.userId,
      date: window.currentWeekStartDate,
      checked: checkedValue
    })
  })
  .then(res => res.json())
  .then(() => console.log("✅ selfcheck 저장 성공"))
  .catch(err => console.error("❌ selfcheck 저장 실패:", err));
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
            dinner: 0
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
    const now = getKSTDate ? getKSTDate() : new Date();
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
function setDefaultWeek() {
    const today = new getKSTDate();
    const monday = new Date(today);
    const day = today.getDay();

    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(today.getDate() + diff + 7);  // 🔄 다음 주 월요일로 이동

    document.getElementById("weekPicker").value = monday.toISOString().split("T")[0];
}

// ✅ 마감시간 규칙
function isDeadlinePassed(dateStr, mealType) {
    const now = getKSTDate();
    const mealDate = new Date(dateStr);
    mealDate.setHours(0, 0, 0, 0); // ✅ 추가: 날짜 비교 오류 방지

    // 기준: 2주 뒤 월요일 이후면 마감 없음
    const day = now.getDay(); // 0(일)~6(토)
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);  // 명시적으로 정규화

    const twoWeeksLaterMonday = new Date(thisMonday);
    twoWeeksLaterMonday.setDate(thisMonday.getDate() + 14);

    // ✅ 1. 과거 날짜면 무조건 마감
    if (mealDate < new Date(now.toDateString())) {
        return true;
    }

    // ✅ 2. 2주 후 월요일 이후면 마감 없음
    if (mealDate >= twoWeeksLaterMonday) {
        return false;
    }

    if (isThisWeek(dateStr)) {
        // ✅ 이번 주 식사는 기존 마감 규칙 사용
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
    } else {
        // ✅ 다음 주 식사는 이번 주 수요일 16:00까지만 신청 가능

        // 이번 주 월요일 계산
        const thisMonday = new Date(now);
        const day = thisMonday.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        thisMonday.setDate(now.getDate() + diff);
        thisMonday.setHours(0, 0, 0, 0);

        // 이번 주 수요일 16시 마감 시각 계산
        const thisWednesdayDeadline = new Date(thisMonday);
        thisWednesdayDeadline.setDate(thisMonday.getDate() + 2); // 수요일
        thisWednesdayDeadline.setHours(16, 0, 0, 0);

        return now > thisWednesdayDeadline;
    }
}


// ✅ 자동 로그인 및 주차 변경 이벤트
document.addEventListener("DOMContentLoaded", function () {
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

        // ✅ 관리자 버튼 노출 여부 처리
        const adminBtn = document.getElementById("adminButton");
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


    fetchHolidayList(`/api/public-holidays?year=${year}`, (holidays) => {
        //window.holidayList = holidays;
        holidayList = holidays;

        if (savedUser) {
            window.currentUser = JSON.parse(savedUser);
            document.getElementById("userId").value = window.currentUser.userId;
            document.getElementById("userName").value = window.currentUser.userName;

            document.getElementById("login-container").style.display = "none";
            document.getElementById("mainArea").style.display = "block";
            document.getElementById("welcome").innerText =
                `${window.currentUser.userName}님 (${window.currentUser.dept} / ${window.currentUser.rank}) 안녕하세요.`;
            
            loadWeekData();
            //login(); // 자동 로그인
        }
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


function goToVisitor() {
    location.href = "visitor_request.html";
}

function goToAdminDashboard() {
    location.href = "admin_dashboard.html";
}

function goToTeamEdit() {
    location.href = "team_edit.html";
}

//체크박스 상태 불렁는 함수
function loadSelfCheck(userId, date) {
  const checkbox = document.getElementById("selfCheck");
  if (!checkbox) return;

  fetch(`/selfcheck?user_id=${userId}&date=${date}`)
    .then(response => response.json())
    .then(data => {
      checkbox.checked = data.checked === 1;
    })
    .catch(error => {
      console.error("❌ selfcheck 불러오기 실패:", error);
    });
}

// ✅ 전역 함수 등록
window.login = login;
window.logout = logout;
window.saveMeals = saveMeals;
window.loadWeekData = loadWeekData;
window.goToVisitor = goToVisitor;
window.goToTeamEdit = goToTeamEdit;
