// import { getData, postData, fetchHolidayList, normalizeDate } from "./util.js";

let holidayList = [];  // 서버에서 불러온 공휴일 날짜 배열

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

        // 로그인 성공
        window.currentUser = {
        userId: data.id,
        userName: data.name,
        dept: data.dept,
        rank: data.rank,
        };

        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

        document.getElementById("login-container").style.display = "none";
        document.getElementById("mainArea").style.display = "block";
        
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

function logout() {
    localStorage.removeItem("currentUser");
    window.location.reload();

    // 모든 화면 초기화
    document.getElementById("login-container").style.display = "block";
    document.getElementById("mainArea").style.display = "none";
    document.getElementById("meal-body").innerHTML = "";
    document.getElementById("welcome").innerText = "";
    document.getElementById("weekRangeText").innerText = "";
    document.getElementById("mealSummary").innerText = "";
}

/*function login(event) {
    if (event) event.preventDefault(); // 기본 submit 동작 막기

    const userId = document.getElementById("userId").value.trim();
    const userName = document.getElementById("userName").value.trim();

    if (!userId || !userName) {
        showToast("사번과 이름을 입력해주세요.");
        return;
    }

    if (userId === "admin" && userName === "admin") {
        window.location.href = "admin_dashboard.html";
        return;
    }

    // 사용자 정보 전역 저장 + localStorage 저장
    window.currentUser = { userId, userName };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    // 로그인 UI 숨기고 식수신청 UI 표시
    document.getElementById("login-container").style.display = "none";
    document.getElementById("date-picker-container").style.display = "block";
    document.getElementById("meal-container").style.display = "block";

    // ✅ 이름 및 범위 표시 요소 보이기 추가
    document.getElementById("welcome").style.display = "block";
    document.getElementById("weekRangeText").style.display = "block";

    loadWeekData(); // 로그인 후 자동 로드
}*/

// ✅ 로그아웃 처리
function logout() {
    localStorage.removeItem("currentUser");
    window.currentUser = null;

    // 모든 화면 초기화
    document.getElementById("login-container").style.display = "block";
    document.getElementById("date-picker-container").style.display = "none";
    document.getElementById("meal-container").style.display = "none";
    document.getElementById("meal-body").innerHTML = "";
    document.getElementById("welcome").innerText = "";
    document.getElementById("weekRangeText").innerText = "";
    document.getElementById("mealSummary").innerText = ""; 
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
            btn.innerText = "❌ 미신청";

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
                btn.style.backgroundColor = "#ccc";
                btn.style.color = "#666";
                btn.title = "신청 마감됨";
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
        btn.innerText = "❌ 미신청";
        btn.style.backgroundColor = "#e0e0e0";
        btn.style.color = "#000";
    } else {
        btn.classList.add("selected");
        btn.innerText = "✅ 신청";
        btn.style.backgroundColor = "#28a745";
        btn.style.color = "#fff";
    }
    
    // ✅ 합계 다시 계산
    updateMealSummary();
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
    document.getElementById("welcome").innerText = `${userName}님, 안녕하세요.`;
    document.getElementById("weekRangeText").innerText = `식수기간: ${start} ~ ${end} `;

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
}

// ✅ 저장 요청 (선택된 버튼 → 서버로 전송)
function saveMeals() {
    if (!window.currentUser) return;

    const userId = window.currentUser.userId;
    const userName = window.currentUser.userName;
    const dept =  window.currentUser.dept;
    const meals = [];

    // 선택된 버튼만 모아서 구성
    document.querySelectorAll(".meal-btn.selected").forEach(btn => {
        const date = btn.dataset.date;
        const type = btn.dataset.type;

        let meal = meals.find(m => m.date === date);
        if (!meal) {
            meal = { user_id: userId, name: userName, dept, date, breakfast: 0, lunch: 0, dinner: 0 };
            meals.push(meal);
        }

        if (type === "조식") meal.breakfast = 1;
        else if (type === "중식") meal.lunch = 1;
        else if (type === "석식") meal.dinner = 1;
    });

    console.log("🧪 전송할 meals:", meals);  // 추가

    // 서버에 POST 요청
    postData("/meals", { meals },
        () => {
            showToast("✅ 저장 완료");
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

// ✅ 오늘 기준으로 이번 주 월요일 날짜 반환
function setDefaultWeek() {
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay();

    // 일요일(0)은 월요일(-6), 월요일(1)은 그대로
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(today.getDate() + diff);

    document.getElementById("weekPicker").value = monday.toISOString().split("T")[0];
}

// ✅ 특정 식사 버튼이 마감되었는지 여부 반환
function isDeadlinePassed(dateStr, mealType) {
    const now = new Date(); // 현재 시간
    const mealDate = new Date(dateStr);

    // 마감 기준 시간 계산
    let deadline = new Date(mealDate);
    if (mealType === "조식") {
        // 전날 오후 3시
        deadline.setDate(mealDate.getDate() - 1);
        deadline.setHours(15, 0, 0, 0);
    } else if (mealType === "중식") {
        // 당일 오전 10시
        deadline.setHours(10, 0, 0, 0);
    } else if (mealType === "석식") {
        // 당일 오후 3시
        deadline.setHours(15, 0, 0, 0);
    }

    return now > deadline;
}

// ✅ 자동 로그인 및 주차 변경 이벤트
document.addEventListener("DOMContentLoaded", function () {
    
    setDefaultWeek(); // ✅ 이번 주 자동 설정
    
    const savedUser = localStorage.getItem("currentUser");
    const year = new Date().getFullYear();

    fetchHolidayList(`/holidays?year=${year}`, (holidays) => {
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

// ✅ 전역 함수 등록
window.login = login;
window.logout = logout;
window.saveMeals = saveMeals;
window.loadWeekData = loadWeekData;