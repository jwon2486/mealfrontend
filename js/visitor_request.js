/**
 * 에스엔시스 방문자/협력사 식수 신청 시스템 Script (Refactored for Dynamic Deadlines & Server Time)
 */

window.serverDeadlines = null; // 백엔드 마감 연동용 전역 저장 공간

// 💡 리팩토링: 초기 구동 시 백엔드 마감 데이터를 호출하는 가변 로더 함수 주입
function loadDeadlinesForVisitor(callback) {
    if (typeof getData === "function") {
        getData("/admin/api/deadlines", (data) => {
            window.serverDeadlines = data;
            if (callback) callback();
        }, () => {
            window.serverDeadlines = { breakfast_days_before: "1", breakfast_time: "09:00", lunch_time: "10:30", dinner_time: "14:30" };
            if (callback) callback();
        });
    } else {
        fetch("/admin/api/deadlines")
            .then(res => res.json())
            .then(data => { window.serverDeadlines = data; if(callback) callback(); })
            .catch(() => { if(callback) callback(); });
    }
}

// 💡 리팩토링: 하드코딩된 로컬 시각 대신 통합된 전역 서버 시간(getKSTNow)을 연동하도록 전면 개조
function isExpired(mealType, dateStr) {
    if (!window.serverDeadlines) return true; // 데이터 지연 시 방어적 차단
    
    // 💡 [수정] 무조건 서버 시간과 동기화가 완료된 오차 보정 시간 함수를 참조합니다.
    const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
    const mealDate = new Date(dateStr);
    mealDate.setHours(0, 0, 0, 0);

    let prefix = (mealType === "점심" || mealType === "lunch") ? "lunch" : 
                 (mealType === "저녁" || mealType === "dinner") ? "dinner" : "breakfast";
                 
    const daysBefore = parseInt(window.serverDeadlines[`${prefix}_days_before`] || 0, 10);
    const timeStr = window.serverDeadlines[`${prefix}_time`] || "00:00";
    const [hour, minute] = timeStr.split(":").map(Number);
    
    const deadline = new Date(mealDate);
    deadline.setDate(deadline.getDate() - daysBefore);
    deadline.setHours(hour, minute, 0, 0);
    
    return now > deadline;
}

// 초기 로딩 프로세스
document.addEventListener("DOMContentLoaded", () => {
    const savedUser = sessionStorage.getItem("currentUser");
    if (!savedUser) {
        alert("로그인이 필요합니다.");
        location.href = "index.html";
        return;
    }
    window.currentUser = JSON.parse(savedUser);
    
    document.getElementById("topUserText").innerText = `${window.currentUser.userName}님`;
    document.getElementById("welcomeText").innerText = `${window.currentUser.userName}님 (${window.currentUser.dept}), 반갑습니다.`;

    // 💡 [구조 개선] UI 렌더링 구동 전에 util.js의 서버 시간 동기화를 우선 체이닝 진행합니다.
    if (typeof syncServerTime === "function") {
        syncServerTime(() => {
            setupInitialWeekPickerAndLoad();
        });
    } else {
        setupInitialWeekPickerAndLoad();
    }
});

/**
 * 💡 [추가] 서버 시간 동기화 이후 순차적으로 바인딩 및 데이터를 호출하기 위한 래핑 함수
 */
function setupInitialWeekPickerAndLoad() {
    const picker = document.getElementById("weekPicker");
    if (picker) {
        // 💡 오차가 보정된 '진짜 서버 KST 시간'을 주차 초기값 산출에 주입
        const now = (typeof getKSTNow === "function") ? getKSTNow() : new Date();
        picker.value = ymdKST(mondayOf(now));
        picker.addEventListener("change", loadWeeklySummary);
    }

    loadDeadlinesForVisitor(() => {
        loadWeeklySummary();
    });
}

function mondayOf(d) {
    const c = new Date(d);
    const idx = (c.getDay() + 6) % 7;
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - idx);
    return c;
}

function ymdKST(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadWeeklySummary() {
    const picker = document.getElementById("weekPicker");
    if (!picker || !picker.value) return;

    const start = picker.value;
    const mon = new Date(start);
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        dates.push(ymdKST(d));
    }

    const url = `/visitors?id=${window.currentUser.userId}&start=${dates[0]}&end=${dates[4]}`;
    
    const fetchFunc = (typeof getData === "function") ? getData : (u, cb) => fetch(u).then(r=>r.json()).then(cb);

    fetchFunc(url, (data) => {
        const dataMap = {};
        data.forEach(item => {
            if (!dataMap[item.date]) dataMap[item.date] = {};
            dataMap[item.date][item.type] = item;
        });

        const tbody = document.getElementById("summary-body");
        tbody.innerHTML = "";

        const weekdays = ["월", "화", "수", "목", "금"];
        dates.forEach((dateStr, idx) => {
            const tr = document.createElement("tr");

            const tdDate = document.createElement("td");
            tdDate.innerText = `${dateStr} (${weekdays[idx]})`;
            tr.appendChild(tdDate);

            // 협력사, 방문자 순서로 행 그리기
            ["협력사", "방문자"].forEach(type => {
                const rec = (dataMap[dateStr] && dataMap[dateStr][type]) ? dataMap[dateStr][type] : null;

                const tdBreakfast = document.createElement("td");
                tdBreakfast.innerText = rec ? rec.breakfast : 0;
                tr.appendChild(tdBreakfast);

                const tdLunch = document.createElement("td");
                tdLunch.innerText = rec ? rec.lunch : 0;
                tr.appendChild(tdLunch);

                const tdDinner = document.createElement("td");
                tdDinner.innerText = rec ? rec.dinner : 0;
                tr.appendChild(tdDinner);

                const tdReason = document.createElement("td");
                tdReason.innerText = rec ? rec.reason : "-";
                tr.appendChild(tdReason);

                const tdAction = document.createElement("td");
                if (rec) {
                    const btnEdit = document.createElement("button");
                    btnEdit.className = "btn-table btn-edit";
                    btnEdit.innerText = "수정";
                    btnEdit.onclick = () => openModal(type, dateStr, rec);
                    tdAction.appendChild(btnEdit);

                    const btnDel = document.createElement("button");
                    btnDel.className = "btn-table btn-delete";
                    btnDel.innerText = "삭제";
                    btnDel.onclick = () => deleteEntry(rec.id);
                    tdAction.appendChild(btnDel);
                } else {
                    const btnAdd = document.createElement("button");
                    btnAdd.className = "btn-table btn-add";
                    btnAdd.innerText = "신청";
                    btnAdd.onclick = () => openModal(type, dateStr, null);
                    tdAction.appendChild(btnAdd);
                }
                tr.appendChild(tdAction);
            });

            tbody.appendChild(tr);
        });
    });
}

function openModal(type, dateStr, record) {
    document.getElementById("modalTitle").innerText = `${dateStr} [${type}] 식수 신청/수정`;
    document.getElementById("modalType").value = type;
    document.getElementById("modalDate").value = dateStr;
    document.getElementById("modalRecordId").value = record ? record.id : "";

    const bInput = document.getElementById("modalBreakfast");
    const lInput = document.getElementById("modalLunch");
    const dInput = document.getElementById("modalDinner");
    const rInput = document.getElementById("modalReason");

    bInput.value = record ? record.breakfast : 0;
    lInput.value = record ? record.lunch : 0;
    dInput.value = record ? record.dinner : 0;
    rInput.value = record ? record.reason : "";

    // 💡 동적 마감 통제에 따른 입력 인풋박스 활성/비활성화 처리
    bInput.disabled = isExpired("아침", dateStr);
    lInput.disabled = isExpired("점심", dateStr);
    dInput.disabled = isExpired("저녁", dateStr);
    
    // 조식, 중식, 석식 전체가 마감되었을 경우 사유 적재 락 처리
    rInput.disabled = (bInput.disabled && lInput.disabled && dInput.disabled);

    document.getElementById("modalWrapper").style.display = "flex";
}

function closeModal() {
    document.getElementById("modalWrapper").style.display = "none";
}

function submitModal() {
    const type = document.getElementById("modalType").value;
    const date = document.getElementById("modalDate").value;
    const rid = document.getElementById("modalRecordId").value;

    const breakfast = parseInt(document.getElementById("modalBreakfast").value || 0, 10);
    const lunch = parseInt(document.getElementById("modalLunch").value || 0, 10);
    const dinner = parseInt(document.getElementById("modalDinner").value || 0, 10);
    const reason = document.getElementById("modalReason").value.trim();

    if (!reason) {
        alert("신청 사유(소속 업체명 등)를 반드시 입력해주세요.");
        return;
    }
    if (breakfast + lunch + dinner === 0) {
        alert("최소 1개 이상의 식수를 입력해야 저장 가능합니다.");
        return;
    }

    const payload = {
        applicant_id: window.currentUser.userId,
        applicant_name: window.currentUser.userName,
        date: date,
        type: type,
        breakfast: breakfast,
        lunch: lunch,
        dinner: dinner,
        reason: reason
    };

    const method = rid ? "PUT" : "POST";
    const url = rid ? `/visitors/${rid}` : "/visitors";

    const postFunc = (typeof postData === "function") ? postData : (u, p, cb, errCb) => {
        fetch(u, {
            method: method,
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(p)
        }).then(r => { if(!r.ok) throw new Error(); return r.json(); }).then(cb).catch(errCb);
    };

    postFunc(url, payload, () => {
        alert("성공적으로 저장되었습니다.");
        closeModal();
        loadWeeklySummary();
    }, () => alert("저장에 실패했습니다. 마감 여부를 다시 확인해 주세요."));
}

function deleteEntry(id) {
    if (!confirm("정말 이 신청 내역을 삭제하시겠습니까?")) return;

    const url = `/visitors/${id}`;
    const delMethod = { method: "DELETE" };
    
    fetch(url, delMethod)
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(() => {
            alert("삭제 완료되었습니다.");
            loadWeeklySummary();
        })
        .catch(() => alert("삭제에 실패했습니다. 이미 마감된 항목인지 확인해 주세요."));
}

function goToMain() {
    location.href = "main.html";
}