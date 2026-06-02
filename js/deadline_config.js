// deadline_config.js

// 💡 [수정] 상대 경로 오인 방지 및 확실한 백엔드 도메인 결합 강제화
const API_URL = API_ROUTES.DEADLINES.startsWith("http") 
    ? API_ROUTES.DEADLINES 
    : `${API_BASE_URL}${API_ROUTES.DEADLINES}`;

// 비상용 초기값 (서버 연동 실패 시 기본값)
const FALLBACK_SETTINGS = {
    breakfast_days_before: 1,
    breakfast_time: '09:00',
    lunch_days_before: 0,
    lunch_time: '10:30',
    dinner_days_before: 0,
    dinner_time: '14:30',
    next_week_day_of_week: 3,
    next_week_time: '16:00'
};

document.addEventListener('DOMContentLoaded', () => {
    // 💡 [보안 확인] 최고 관리자 세션이 유효한지 검증 후 로드 진행
    const savedUser = sessionStorage.getItem("currentUser");
    if (!savedUser) {
        alert("관리자 권한이 필요합니다. 다시 로그인해주세요.");
        location.href = "index.html";
        return;
    }
    window.currentUser = JSON.parse(savedUser);

    loadSettings();
    
    // 저장 버튼 이벤트 리스너 등록
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
});

/**
 * 1. util.js의 requestApi를 통해 마감 설정 로드
 */
async function loadSettings() {
    try {
        console.log(`📡 마감시간 설정 동기화 경로 연동 중: ${API_URL}`);
        const data = await requestApi(API_URL);
        const settings = Array.isArray(data) ? data[0] : data;
        
        if (settings) {
            applySettingsToUI(settings);
        } else {
            throw new Error('올바른 설정 데이터 포맷이 아닙니다.');
        }
    } catch (error) {
        console.error('❌ 마감 설정 연동 실패. 비상용 기본값으로 구동합니다.', error);
        applySettingsToUI(FALLBACK_SETTINGS);
    }
}

/**
 * 2. 가져온 설정 데이터를 UI 및 '현재 설정 시간' 텍스트 뱃지에 반영
 */
function applySettingsToUI(settings) {
    document.getElementById('breakfast_days_before').value = settings.breakfast_days_before;
    document.getElementById('breakfast_time').value = settings.breakfast_time;
    document.getElementById('lunch_days_before').value = settings.lunch_days_before;
    document.getElementById('lunch_time').value = settings.lunch_time;
    document.getElementById('dinner_days_before').value = settings.dinner_days_before;
    document.getElementById('dinner_time').value = settings.dinner_time;
    document.getElementById('next_week_day_of_week').value = settings.next_week_day_of_week;
    document.getElementById('next_week_time').value = settings.next_week_time;

    updateCurrentSettingsText(settings);
}

/**
 * 3. 현재 설정 시간 텍스트 동적 변환 및 출력
 */
function updateCurrentSettingsText(settings) {
    const dayLabels = { 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일' };
    
    const bfDay = settings.breakfast_days_before == 1 ? '전날' : '당일';
    const lcDay = settings.lunch_days_before == 1 ? '전날' : '당일';
    const dnDay = settings.dinner_days_before == 1 ? '전날' : '당일';
    const nwDay = dayLabels[settings.next_week_day_of_week] || '미정';

    document.getElementById('current-breakfast').textContent = `현재 설정: ${bfDay} ${settings.breakfast_time}`;
    document.getElementById('current-lunch').textContent = `현재 설정: ${lcDay} ${settings.lunch_time}`;
    document.getElementById('current-dinner').textContent = `현재 설정: ${dnDay} ${settings.dinner_time}`;
    document.getElementById('current-nextweek').textContent = `현재 설정: ${nwDay} ${settings.next_week_time}`;
}

/**
 * 4. 변경된 설정을 util.js의 requestApi를 통해 서버에 전송
 */
async function saveSettings() {
    // 💡 [보안 패치]: app.py 백엔드가 요구하는 구조(requester_id 및 settings 블록)로 페이로드 재구성
    const settingsPayload = {
        breakfast_days_before: parseInt(document.getElementById('breakfast_days_before').value, 10),
        breakfast_time: document.getElementById('breakfast_time').value,
        lunch_days_before: parseInt(document.getElementById('lunch_days_before').value, 10),
        lunch_time: document.getElementById('lunch_time').value,
        dinner_days_before: parseInt(document.getElementById('dinner_days_before').value, 10),
        dinner_time: document.getElementById('dinner_time').value,
        next_week_day_of_week: parseInt(document.getElementById('next_week_day_of_week').value, 10),
        next_week_time: document.getElementById('next_week_time').value
    };

    const finalPayload = {
        requester_id: window.currentUser ? window.currentUser.userId : "", // 최고관리자 사번 증명
        settings: settingsPayload
    };

    try {
        await requestApi(API_URL, {
            method: 'POST',
            body: JSON.stringify(finalPayload)
        });

        alert('💾 마감 제어 규칙이 시스템 백엔드 데이터베이스에 안전하게 반영되었습니다.');
        updateCurrentSettingsText(settingsPayload);
    } catch (error) {
        console.error('저장 중 오류 발생:', error);
        alert(`❌ 저장 실패: ${error.message}`);
    }
}