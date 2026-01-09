

// ✅ 공통 fetch POST 함수
function postData(path, data, onSuccess, onError) {

    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json(); // JSON 응답 안의 {"error": "..."}
            throw new Error(err.error || `서버 오류 (${res.status})`);
        }
        return res.json();
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ 요청 실패:", err);
        alert(err + '❌ 요청 실패:');
        if (onError) {
            onError(err);
        } else {
            showToast("❌ 오류: " + err.message);
        }
    });
}

// ✅ 공통 PUT 요청 함수 (직원 수정용)
function putData(path, data, onSuccess, onError) {
    
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    
    fetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `수정 실패 (${res.status})`);
        }
        return res.json();
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ PUT 요청 실패:", err);
        if (onError) onError(err);
        else showToast("❌ 수정 오류: " + err.message);
    });
}

// ✅ 공통 Toast 메시지 함수
function showToast(message, duration = 2000) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.className = "toast show";
    setTimeout(() => {
        toast.className = "toast";
    }, duration);
}

// ✅ DELETE 요청용 함수 (postData의 삭제 버전)
function deleteData(path, onSuccess, onError) {

    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

    fetch(url, {
        method: "DELETE"
    })
    .then(res => {
        if (!res.ok) throw new Error("삭제 실패");
        return res.json();
    })
    .then(onSuccess)
    .catch(err => {
        console.error("❌ 삭제 오류:", err);
        if (onError) onError(err);
        else showToast("❌ 삭제 실패: " + err.message);
    });
}

function getData(path, onSuccess, onError) {
    
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    
    fetch(url)
        .then(async res => {
            const text = await res.text();  // 💬 원문 텍스트

            if (!res.ok) {
                console.error("❌ 서버 오류 응답:", text);
                if (onError) onError(new Error(text));
                else showToast("❌ 서버 오류: " + text);
                return;
            }

            // 🔄 JSON 파싱 시도
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error("⚠️ JSON 파싱 실패:", text);
                if (onError) onError(new Error("JSON 파싱 실패"));
                return;
            }

            // ✅ 안전하게 성공 콜백 실행
            try {
                onSuccess(data);
            } catch (e) {
                console.error("onSuccess 처리 중 오류:", e);
                if (onError) onError(e);
                else alert("❌ 데이터 처리 중 오류: " + e.message);
            }
        })
        .catch(err => {
            console.error("❌ GET 요청 실패:", err);
            if (onError) onError(err, "onSuccess");
            else showToast("❌ 데이터를 불러오는 중 오류: " + err.message);
        });
        
}

// export function getData(url, onSuccess, onError) {
//     fetch(url)
//         .then(response => {
//             console.log("✅ GET 응답 상태:", response.status);
//             if (!response.ok) throw new Error("서버 응답 오류");
//             return response.json();
//         })
//         .then(data => {
//             console.log("✅ 서버 응답 데이터:", data);
//             try {
//                 onSuccess(data);
//             } catch (err) {
//                 console.error("❌ onSuccess 처리 중 오류:", err);
//                 onError(err, "onSuccess");
//             }
//         })
//         .catch(err => {
//             console.error("❌ GET 요청 실패: ", err);
//             onError(err, "fetch");
//         });
// }


/**
 * 파일 업로드 전송용 공통 함수 (FormData 기반)
 * 
 * @param {string} `${API_BASE_URL}${path}` 업로드 API 주소
 * @param {File} file 업로드할 파일 객체
 * @param {Function} onSuccess 성공 시 호출되는 콜백 (응답 JSON 포함)
 * @param {Function} onError 실패 시 호출되는 콜백 (에러 객체 포함)
 */
function uploadFile(path, file, onSuccess, onError) {
    const formData = new FormData();
    formData.append("file", file);
  
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

    fetch(url, {
      method: "POST",
      body: formData
    })
      .then(async res => {
        const result = await res.json();
  
        if (!res.ok) {
          throw new Error(result.error || `업로드 실패 (코드: ${res.status})`);
        }
  
        if (onSuccess) onSuccess(result);
      })
      .catch(err => {
        console.error("❌ 파일 업로드 실패:", err);
        if (onError) onError(err);
        else alert("❌ 업로드 에러: " + err.message);
      });
}

// ✅ 날짜 포맷 정규화: YYYY-MM-DD
function normalizeDate(dateStr) {
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// ✅ 공휴일 리스트 fetch (url + 콜백 구조)
function fetchHolidayList(path, onSuccess, onError) {
    getData(`${API_BASE_URL}${path}`,
        (data) => {
            // ⬇️ 원본 data 그대로 넘김 (날짜+description 포함)
            if (onSuccess) onSuccess(data);
        },
        (err) => {
            console.error("공휴일 불러오기 실패:", err);
            if (onError) onError(err);
        }
    );
}

function getCurrentWeekRange() {
  const today = new Date(); // 브라우저 로컬 = KST
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: getKSTDateString(monday),
    end: getKSTDateString(friday)
  };
}

// 요일을 한글로 반환하는 유틸 함수
function getWeekdayName(dateStr) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const date = new Date(dateStr);
    return days[date.getDay()];
}

// ✅ 특정 날짜 기준의 월~금 주간 범위 계산 함수
function getWeekStartAndEnd(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0=일 ~ 6=토
  
    const monday = new Date(date);
    const diffToMonday = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 월요일이면 0
    monday.setDate(date.getDate() + diffToMonday);
  
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
  
    
    return { start: getKSTDateString(monday), end: getKSTDateString(friday) };

}

function getLoginInfo() {
    const id = sessionStorage.getItem("userId") || sessionStorage.getItem("id");      // ✅ 보완
    const name = sessionStorage.getItem("userName") || sessionStorage.getItem("name");
    const type = sessionStorage.getItem("userType") || sessionStorage.getItem("type");
    return { id, name, type };
}

// ✅ 한국시간 기준 YYYY-MM-DD 반환 함수
function getKSTDateString(date) {
    const tzOffset = date.getTimezoneOffset() * 60000; // 분 → 밀리초
    const kst = new Date(date.getTime() - tzOffset + (9 * 60 * 60 * 1000)); // UTC → KST(+9h)
    return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getKSTDate() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000; // 현재 시간 → UTC 기준
    const KST_OFFSET = 9 * 60 * 60000; // 9시간 → 밀리초
    return new Date(utc + KST_OFFSET);
}

// ✅ 페이지 이동 함수
function goToPage(pageUrl) {
    window.location.href = pageUrl;
}

//5분간 입력이 없을시 강제 로그아웃 처리하는 함수
(function setupInactivityTimeout() {
    const TIMEOUT = 3 * 60 * 1000; // 3분 (원하는 시간으로 바꿀 수 있음)
    let timer;

    function resetTimer() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            // 세션 스토리지 삭제
            sessionStorage.clear();
            // 로그아웃 처리: 로그인 페이지로 이동
            location.href = "index.html";
        }, TIMEOUT);
    }
/**
 * 주어진 UTC 기반 날짜 문자열을 한국 시간(KST)으로 변환하여
 * "YYYY-MM-DD HH:mm:ss" 형식의 문자열로 반환하는 함수**/
function formatToKoreanTime(datetimeStr) {
  if (!datetimeStr) return "-";
  const date = new Date(datetimeStr.replace(" ", "T") + "Z");
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

    window.formatToKoreanTime = formatToKoreanTime;
    // 이벤트에 타이머 리셋 연결
    window.onload = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.onclick = resetTimer;
    document.onscroll = resetTimer;
})();

