document.addEventListener("DOMContentLoaded", function () {
    setDefaultAdminWeek();
});

// 관리자 로그인
function adminLogin() {
    let adminId = document.getElementById("adminId").value;
    let adminName = document.getElementById("adminName").value;

    if (adminId !== "admin" || adminName !== "admin") {
        alert("관리자 계정으로 로그인하세요.");
        return;
    }

    document.getElementById("admin-date-picker-container").style.display = "block";
    document.getElementById("search-container").style.display = "block";
    document.getElementById("admin-meal-container").style.display = "block";
    document.getElementById("holiday-container").style.display = "block";
    loadAdminWeekData();
}

// 기본적으로 다음 주가 선택되도록 설정
function setDefaultAdminWeek() {
    let today = new Date();
    let nextMonday = new Date(today.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7)));
    document.getElementById("adminWeekPicker").value = nextMonday.toISOString().split('T')[0];
}

// 특정 주의 직원 신청 내역 불러오기
function loadAdminWeekData() {
    let adminMealBody = document.getElementById("admin-meal-body");
    adminMealBody.innerHTML = "";

    let dummyEmployees = [
        { dept: "영업부", id: "1001", name: "홍길동", date: "2024-05-06", breakfast: "신청", lunch: "미신청", dinner: "신청" },
        { dept: "생산팀", id: "1002", name: "이순신", date: "2024-05-07", breakfast: "미신청", lunch: "신청", dinner: "신청" }
    ];

    dummyEmployees.forEach(emp => {
        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${emp.dept}</td>
            <td>${emp.id}</td>
            <td>${emp.name}</td>
            <td>${emp.date}</td>
            <td><button onclick="toggleAdminMeal(this)">${emp.breakfast}</button></td>
            <td><button onclick="toggleAdminMeal(this)">${emp.lunch}</button></td>
            <td><button onclick="toggleAdminMeal(this)">${emp.dinner}</button></td>
        `;
        adminMealBody.appendChild(row);
    });
}

// "신청/미신청" 토글 기능
function toggleAdminMeal(btn) {
    btn.textContent = (btn.textContent === "미신청") ? "신청" : "미신청";
}

// 공휴일 추가
function addHoliday() {
    let holidayDate = document.getElementById("holidayPicker").value;
    if (!holidayDate) {
        alert("날짜를 선택하세요.");
        return;
    }
    let listItem = document.createElement("li");
    listItem.textContent = holidayDate;
    document.getElementById("holiday-list").appendChild(listItem);
}

// 엑셀 다운로드 (단순 콘솔 출력으로 예제 제공)
function downloadExcel() {
    console.log("엑셀 다운로드 실행");
    alert("엑셀 다운로드 완료!");
}