// js/auth.js

document.addEventListener("DOMContentLoaded", function () {
  const adminPages = [
    "admin_dashboard.html",
    "admin_check.html",
    "admin_edit.html",
    "admin_employees.html",
    "admin_holiday.html",
    "admin_logs.html",
    "admin_stats.html",
    "admin_visitor.html"
  ];

  const currentPage = location.pathname.split("/").pop();

  // admin 페이지에 해당될 경우만 검사
  if (adminPages.includes(currentPage)) {
    const savedUser = localStorage.getItem("currentUser");

    if (!savedUser) {
      alert("로그인이 필요합니다.");
      location.href = "index.html";
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      if (user.level !== 3) {
        alert("접근 권한이 없습니다!");
        location.href = "index.html";
      }
    } catch (err) {
      console.error("사용자 정보 파싱 오류:", err);
      alert("관리자 계정으로 다시 로그인해주세요.");
      location.href = "index.html";
    }
  }
});