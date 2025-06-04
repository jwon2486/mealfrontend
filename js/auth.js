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

  const teamPages = [
    "team_edit.html"  // ✅ 중간관리자 페이지 추가
  ];

  const currentPage = location.pathname.split("/").pop();
  const protectedPages = [...adminPages, ...teamPages];

  if (protectedPages.includes(currentPage)) {
    const savedUser = localStorage.getItem("currentUser");

    if (!savedUser) {
      alert("로그인이 필요합니다.");
      location.href = "index.html";
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      if (adminPages.includes(currentPage) && user.level !== 3) {
        alert("관리자만 접근할 수 있습니다.");
        location.href = "index.html";
        return;
      }

      if (teamPages.includes(currentPage) && user.level !== 2) {
        alert("중간관리자만 접근할 수 있습니다.");
        location.href = "index.html";
        return;
      }
    } catch (err) {
      console.error("사용자 정보 파싱 오류:", err);
      alert("로그인 정보를 다시 확인해주세요.");
      location.href = "index.html";
    }
  }
});
