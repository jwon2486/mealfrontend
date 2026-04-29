/**
 * admin_employees.js
 * [최종 통합 버전]
 * 1. 정렬: 경영진 > 부서별 > 기타지역 후순위 > 직급순
 * 2. 페이지네이션: 10개 표시, 5개 단위 블록 이동(<<, <, >, >>)
 * 3. 권한 설정: 드롭다운(Select) 방식 반영
 */

// --- [전역 변수 설정] ---
const baseUrl = "/admin/employees";
const ITEMS_PER_PAGE = 10;   // 한 페이지당 10개
const PAGE_BLOCK_SIZE = 5;  // 페이지 번호 블록 5개 단위

let allEmployees = [];          
let filteredEmployeesList = []; 
let currentPage = 1;

/**
 * [기존 정렬 규칙 유지] 부서/그룹별 우선순위
 */
const GROUP_PRIORITY = (emp) => {
    if (emp.type === "경영진" || emp.dept === "경영진") return 1;
    if (emp.region === "에코센터" && emp.type === "직영") return 2;
    if (emp.region === "테크센터" && emp.type === "직영") return 3;
    if (emp.dept.includes("식당")) return 4;
    if (emp.type === "협력사") return 5;
    return 6; 
};

/**
 * [기존 정렬 규칙 유지] 상세 직급별 우선순위
 */
const RANK_PRIORITY = {
    "회장": 1, "사장": 2, "부사장": 3, "전무": 4, "상무": 5, 
    "이사대우": 6, "수석부장": 7, "부장": 8, "차장": 9, 
    "과장": 10, "대리": 11, "주임": 12, "사원": 13
};

// --- [초기화 및 데이터 로드] ---

document.addEventListener("DOMContentLoaded", () => {
    loadEmployees();
});

function loadEmployees() {
    getData(baseUrl, (data) => {
        allEmployees = sortEmployees(data);
        filteredEmployeesList = allEmployees;
        displayPage(1);
    }, (err) => {
        alert("❌ 직원 정보를 불러오지 못했습니다.");
    });
}

/**
 * [기존 정렬 규칙 유지] 복합 정렬 알고리즘
 */
function sortEmployees(data) {
    return [...data].sort((a, b) => {
        const priorityA = GROUP_PRIORITY(a);
        const priorityB = GROUP_PRIORITY(b);
        if (priorityA !== priorityB) return priorityA - priorityB;

        if (a.dept !== b.dept) return (a.dept || "").localeCompare(b.dept || "");

        const isMiscRegionA = (a.region === "기타") ? 1 : 0;
        const isMiscRegionB = (b.region === "기타") ? 1 : 0;
        if (isMiscRegionA !== isMiscRegionB) return isMiscRegionA - isMiscRegionB;

        const rankA = RANK_PRIORITY[a.rank];
        const rankB = RANK_PRIORITY[b.rank];

        if (rankA !== undefined && rankB !== undefined) {
            return rankA - rankB; 
        } else if (rankA === undefined && rankB !== undefined) {
            return rankB === 1 ? 1 : -1;
        } else if (rankA !== undefined && rankB === undefined) {
            return rankA === 1 ? -1 : 1;
        }

        return (a.name || "").localeCompare(b.name || "");
    });
}

// --- [테이블 렌더링 및 페이지네이션 제어] ---

function displayPage(page) {
    currentPage = page;
    const tbody = document.getElementById("emp-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const pageData = filteredEmployeesList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--muted);">조회된 결과가 없습니다.</td></tr>`;
    } else {
        pageData.forEach(emp => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="font-family:monospace; font-weight:bold;">${emp.id}</td>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.region}</td>
                <td>${emp.dept}</td>
                <td>${emp.type}</td>
                <td>${emp.rank || ""}</td>
                <td><span class="badge level-${emp.level || 1}">${getLevelLabel(emp.level)}</span></td>
                <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="selectEmployeeToEdit(this)">✏️ 수정</button></td>
                <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:red;" onclick="deleteEmployee('${emp.id}')">🗑️ 삭제</button></td>
            `;
            tbody.appendChild(row);
        });
    }
    renderPagination(); 
}

function getLevelLabel(level) {
    const lv = parseInt(level);
    if (lv === 3) return '관리자';
    if (lv === 2) return '담당자';
    return '일반';
}

function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    const totalPages = Math.ceil(filteredEmployeesList.length / ITEMS_PER_PAGE);
    const currentBlock = Math.ceil(currentPage / PAGE_BLOCK_SIZE);
    const startPage = (currentBlock - 1) * PAGE_BLOCK_SIZE + 1;
    let endPage = startPage + PAGE_BLOCK_SIZE - 1;
    if (endPage > totalPages) endPage = totalPages;

    container.innerHTML = "";

    const createBtn = (text, handler, isDisabled, cls = "btn btn-secondary sm") => {
        const btn = document.createElement("button");
        btn.innerText = text;
        btn.className = cls;
        btn.disabled = isDisabled;
        btn.onclick = handler;
        btn.style.margin = "0 2px";
        return btn;
    };

    container.appendChild(createBtn("<<", () => displayPage(Math.max(1, currentPage - PAGE_BLOCK_SIZE)), currentPage === 1));
    container.appendChild(createBtn("<", () => displayPage(currentPage - 1), currentPage === 1));

    for (let i = startPage; i <= endPage; i++) {
        const pBtn = createBtn(i, () => displayPage(i), false, "page-num-btn");
        pBtn.dataset.page = i;
        if (i === currentPage) pBtn.classList.add("active");
        container.appendChild(pBtn);
    }

    container.appendChild(createBtn(">", () => displayPage(currentPage + 1), currentPage === totalPages || totalPages === 0));
    container.appendChild(createBtn(">>", () => displayPage(Math.min(totalPages, currentPage + PAGE_BLOCK_SIZE)), currentPage === totalPages || totalPages === 0));
}

// --- [조회 및 필터링] ---

function filterEmployees() {
    const fRegion = document.getElementById("filterRegion").value.trim().toLowerCase();
    const fDept = document.getElementById("filterDept").value.trim().toLowerCase();
    const fName = document.getElementById("filterName").value.trim().toLowerCase();

    const filtered = allEmployees.filter(emp => 
        (emp.name || "").toLowerCase().includes(fName) &&
        (emp.region || "").toLowerCase().includes(fRegion) &&
        (emp.dept || "").toLowerCase().includes(fDept)
    );
    
    filteredEmployeesList = sortEmployees(filtered);
    displayPage(1);
}

function resetFilter() {
    ["filterRegion", "filterDept", "filterName"].forEach(id => {
        document.getElementById(id).value = "";
    });
    filterEmployees();
}

// --- [CRUD 및 모달 제어] ---

function openAddModal() {
    document.getElementById("modalTitle").innerText = "➕ 신규 직원 등록";
    clearForm();
    document.getElementById("empId").disabled = false;
    document.getElementById("editModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("editModal").style.display = "none";
}

function clearForm() {
    const fields = ["empId", "empName", "empDept", "empType", "empRank", "empRegion"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
    document.getElementById("empLevel").value = "1";
}

function selectEmployeeToEdit(btn) {
    const cells = btn.closest("tr").querySelectorAll("td");
    
    document.getElementById("modalTitle").innerText = "✏️ 직원 정보 수정";
    document.getElementById("empId").value = cells[0].innerText;
    document.getElementById("empName").value = cells[1].innerText;
    document.getElementById("empRegion").value = cells[2].innerText;
    document.getElementById("empDept").value = cells[3].innerText;
    document.getElementById("empType").value = cells[4].innerText;
    document.getElementById("empRank").value = cells[5].innerText;
    
    const lvText = cells[6].innerText.trim();
    const levelSelect = document.getElementById("empLevel");
    if (lvText === "관리자") levelSelect.value = "3";
    else if (lvText === "담당자") levelSelect.value = "2";
    else levelSelect.value = "1";

    document.getElementById("empId").disabled = true;
    document.getElementById("editModal").style.display = "flex";
}

function saveEmployee() {
    const isEdit = document.getElementById("empId").disabled;
    const empData = {
        id: document.getElementById("empId").value.trim(),
        name: document.getElementById("empName").value.trim(),
        region: document.getElementById("empRegion").value.trim(),
        dept: document.getElementById("empDept").value.trim(),
        type: document.getElementById("empType").value.trim(),
        rank: document.getElementById("empRank").value.trim(),
        level: parseInt(document.getElementById("empLevel").value)
    };

    if (!empData.id || !empData.name) {
        alert("⚠️ 사번과 성명은 필수 입력 항목입니다.");
        return;
    }

    const method = isEdit ? putData : postData;
    const url = isEdit ? `${baseUrl}/${empData.id}` : baseUrl;

    method(url, empData, () => {
        alert(`✅ ${isEdit ? '수정' : '등록'}이 완료되었습니다.`);
        loadEmployees();
        closeModal();
    }, (err) => {
        alert("❌ 처리 중 오류가 발생했습니다: " + err.message);
    });
}

function deleteEmployee(id) {
    if (!confirm(`사번 ${id} 직원을 정말 삭제하시겠습니까?`)) return;
    deleteData(`${baseUrl}/${id}`, () => {
        alert("🗑️ 삭제가 완료되었습니다.");
        loadEmployees();
    }, (err) => alert("❌ 삭제 실패: " + err.message));
}

function uploadEmployeeFile() {
    const fileInput = document.getElementById("uploadFile");
    const file = fileInput.files[0];
    if (!file) return alert("📂 업로드할 파일을 선택해주세요.");

    uploadFile("/admin/employees/upload", file, () => {
        alert("✅ 엑셀 일괄 업로드가 완료되었습니다.");
        loadEmployees();
        fileInput.value = ""; 
    }, (err) => alert("❌ 업로드 실패: " + err.message));
}

function downloadEmployeeTemplate() {
    if(typeof API_BASE_URL !== 'undefined') {
        window.open(API_BASE_URL + "/admin/employees/template", "_blank");
    }
}