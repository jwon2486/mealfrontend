

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
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "서버 응답 오류");
            }

            const data = await res.json().catch(() => {
                throw new Error("JSON 파싱 실패");
            });

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
            const holidays = data.map(item => normalizeDate(item.date));
            if (onSuccess) onSuccess(holidays);
        },
        (err) => {
            console.error("공휴일 불러오기 실패:", err);
            if (onError) onError(err);
        }
    );
}

function getCurrentWeekRange() {
    const today = new Date();
    const day = today.getDay(); // 일요일: 0, 월요일: 1 ...
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const format = (date) => date.toISOString().split("T")[0];
    return { start: format(monday), end: format(friday) };
}

