/**
 * 에스엔시스 통합 식수 마감 조건 관리 전용 Script (Authorized Supervision)
 */

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1단계 권한 감시: 세션에서 로그인한 유저 상태를 확인
    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }

    // 최고관리자(level 3)가 존재하지 않거나 권한이 미달될 경우 접근 전면 즉시 차단
    if (!currentUser || currentUser.level !== 3) {
        alert("⛔ 접근 권한이 탈락되었습니다. 최고 관리자 계정으로 다시 로그인하십시오.");
        window.location.href = "index.html";
        return;
    }

    // 최고관리자 서명 패스 시 CSS 불투명도 레이어를 걷어내고 폼 표출
    document.body.classList.add("authorized");

    // 2단계 데이터 바인딩: 백엔드 DB에 기록된 기존 세팅값 전송받아 바인딩
    fetch("/admin/api/deadlines")
        .then(res => {
            if (!res.ok) throw new Error("서버로부터 설정을 읽어오지 못했습니다.");
            return res.json();
        })
        .then(data => {
            if (data && data.breakfast_time) {
                document.getElementById("breakfast_time").value = data.breakfast_time;
                document.getElementById("breakfast_days_before").value = data.breakfast_days_before;
                document.getElementById("lunch_time").value = data.lunch_time;
                document.getElementById("lunch_days_before").value = data.lunch_days_before;
                document.getElementById("dinner_time").value = data.dinner_time;
                document.getElementById("dinner_days_before").value = data.dinner_days_before;
                document.getElementById("next_week_day_of_week").value = data.next_week_day_of_week;
                document.getElementById("next_week_time").value = data.next_week_time;
            }
        })
        .catch(err => {
            console.error("⚠️ 설정값 로드 실패:", err.message);
        });
});

/**
 * 변경된 마감 설정 폼 데이터 종합 수집 후 백엔드 전송 요청 (감시자 토큰 동봉)
 */
function saveSettings() {
    if (!currentUser || currentUser.level !== 3) {
        alert("최고 관리자 세션 권한이 만료되었습니다. 다시 로그인하십시오.");
        window.location.href = "index.html";
        return;
    }

    // 서버 이중 차단용 마패(requester_id) 및 신규 입력 폼 데이터 캡처 구조화
    const payload = {
        requester_id: currentUser.userId, // 변조 차단용 암행어사 마패 역할 토큰
        settings: {
            breakfast_time: document.getElementById("breakfast_time").value,
            breakfast_days_before: document.getElementById("breakfast_days_before").value,
            lunch_time: document.getElementById("lunch_time").value,
            lunch_days_before: document.getElementById("lunch_days_before").value,
            dinner_time: document.getElementById("dinner_time").value,
            dinner_days_before: document.getElementById("dinner_days_before").value,
            next_week_day_of_week: document.getElementById("next_week_day_of_week").value,
            next_week_time: document.getElementById("next_week_time").value
        }
    };

    // 시간 값 및 요일 필수 검증 입력 누락 방어 체크
    const s = payload.settings;
    if (!s.breakfast_time || !s.lunch_time || !s.dinner_time || !s.next_week_time) {
        alert("⚠️ 누락된 마감 시각 항목이 있습니다. 모든 시간을 올바르게 선택해 주세요.");
        return;
    }

    // 백엔드로 안전 전송 프로세스 실행
    fetch("/admin/api/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (res.status === 403 || res.status === 401) {
            throw new Error("🚨 권한 변조 적발 감시: 서버 보안 필터 패널티에 의해 처리가 완전히 차단되었습니다.");
        }
        if (!res.ok) throw new Error("네트워크 서버 통신 중 오류가 발생했습니다.");
        return res.json();
    })
    .then(data => {
        alert(data.message || "식수 마감 규칙이 성공적으로 저장되었습니다.");
    })
    .catch(err => {
        alert(err.message);
        window.location.href = "index.html";
    });
}