document.addEventListener("DOMContentLoaded", () => {
    checkAdminAccess();
    bindNavigationButtons();
    bindLogoutButton();
});

function checkAdminAccess() {
    const savedUser = sessionStorage.getItem("currentUser");

    if (!savedUser) {
        window.location.href = "index.html";
        return;
    }

    try {
        const user = JSON.parse(savedUser);

        if (Number(user.level) !== 3) {
            alert("관리자만 접근 가능합니다.");
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error("currentUser 파싱 오류:", error);
        sessionStorage.clear();
        window.location.href = "index.html";
    }
}

function bindNavigationButtons() {
    const navButtons = document.querySelectorAll(".nav-btn");

    navButtons.forEach((button) => {
        button.addEventListener("click", handleNavigation);
    });
}

function handleNavigation(event) {
    const target = event.currentTarget;
    const page = target.dataset.page;

    if (!page) {
        console.warn("이동할 페이지 정보가 없습니다.");
        return;
    }

    goToPage(page);
}

function goToPage(page) {
    window.location.href = page;
}

function bindLogoutButton() {
    const logoutBtn = document.getElementById("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", logoutAndGoToLogin);
}

function logoutAndGoToLogin() {
    sessionStorage.clear();
    window.location.href = "index.html";
}