// js/auth.js

document.addEventListener("DOMContentLoaded", function () {
  // 1. 관리자 전용 페이지 목록
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

  // 2. 일반 로그인만 필요한 페이지 목록 (방문자 신청 등)
  const memberPages = [
    "visitor_request.html"
  ];

  const currentPage = location.pathname.split("/").pop();
  const savedUser = sessionStorage.getItem("currentUser");

  // A. 관리자 페이지 검사
  if (adminPages.includes(currentPage)) {
    if (!savedUser) {
      alert("로그인이 필요합니다.");
      location.href = "index.html";
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      if (user.level !== 3) {
        alert("접근 권한이 없습니다! 관리자만 접근 가능합니다.");
        location.href = "index.html";
      }
    } catch (err) {
      console.error("사용자 정보 파싱 오류:", err);
      alert("관리자 계정으로 다시 로그인해주세요.");
      location.href = "index.html";
    }
  }

  // B. 일반 회원용 보호 페이지 검사 (방문자 신청 등)
  else if (memberPages.includes(currentPage)) {
    if (!savedUser) {
      alert("로그인이 필요한 서비스입니다.");
      location.href = "index.html";
    }
  }
});