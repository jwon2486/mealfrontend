const baseUrl = "/admin/employees"; // ⚠️ Render 배포 시 수정

// 직원 목록 조회
function loadEmployees() {
  getData(baseUrl, (data) => {
    const tbody = document.querySelector("#emp-table tbody");
    tbody.innerHTML = "";

    data.forEach(emp => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>${emp.region}</td>
        <td>${emp.dept}</td>
        <td>${emp.part || ""}</td>
        <td>${emp.rank || ""}</td> 
        <td><button class="edit" onclick="selectEmployeeToEdit(this)">✏️</button></td>
        <td><button class="delete" onclick="deleteEmployee('${emp.id}')">🗑️</button></td>
      `;

      tbody.appendChild(row);
    });
  }, (err) => {
    alert("❌ 직원 정보를 불러오지 못했습니다.");
    console.error(err);
  });
}

// 새 직원 추가
function addEmployee() {
  const id = document.getElementById("empId").value.trim();
  const name = document.getElementById("empName").value.trim();
  const dept = document.getElementById("empDept").value.trim();
  const type = document.getElementById("empType").value.trim();
  const rank = document.getElementById("empRank").value.trim();
  const region = document.getElementById("empRegion").value.trim();

  if (!id || !name || !dept || !type || !region) {
    alert("⚠️ 모든 입력값을 채워주세요.");
    return;
  }

  postData(baseUrl, { id, name, dept,part, rank, type, region }, () => {
    alert("✅ 직원 추가 완료");
    loadEmployees();
    clearForm();
  }, (err) => {
    alert("❌ 추가 실패: " + err.message);
  });
}

// 직원 수정
function updateEmployee() {
  const id = document.getElementById("empId").value.trim();
  const name = document.getElementById("empName").value.trim();
  const dept = document.getElementById("empDept").value.trim();
  const part = document.getElementById("empPart").value.trim();
  const type = document.getElementById("empType").value.trim();
  const rank = document.getElementById("empRank").value.trim();
  const region = document.getElementById("empRegion").value.trim();
  

  if (!id || !name || !dept || !type || !region) {
    alert("⚠️ 모든 입력값을 채워주세요.");
    return;
  }

  putData(`${baseUrl}/${id}`, { name, dept,part, rank, type, region }, () => {
    alert("✅ 수정 완료");
    loadEmployees();
    clearForm();
  }, (err) => {
    alert("❌ 수정 실패: " + err.message);
  });
}

// 직원 삭제
function deleteEmployee(id) {
  if (!confirm(`정말 사번 ${id} 직원을 삭제하시겠습니까?`)) return;

  deleteData(`${baseUrl}/${id}`, () => {
    alert("🗑️ 삭제 완료");
    loadEmployees();
  }, (err) => {
    alert("❌ 삭제 실패: " + err.message);
  });
}

// 수정 버튼 클릭 시 입력폼에 값 채우기
function selectEmployeeToEdit(btn) {
  const row = btn.closest("tr");
  const cells = row.querySelectorAll("td");

  document.getElementById("empId").value = cells[0].innerText;
  document.getElementById("empName").value = cells[1].innerText;
  document.getElementById("empRegion").value = cells[2].innerText;
  document.getElementById("empDept").value = cells[3].innerText;
  document.getElementById("empPart").value = cells[4].innerText; 
  document.getElementById("empType").value = cells[5].innerText;
  document.getElementById("empRank").value = cells[6].innerText;
  
  

  // 사번은 수정 비활성화
  document.getElementById("empId").disabled = true;
}

// 입력폼 초기화
function clearForm() {
  document.getElementById("empId").value = "";
  document.getElementById("empName").value = "";
  document.getElementById("empDept").value = "";
  document.getElementById("empType").value = "";
  document.getElementById("empRank").value = "";
  document.getElementById("empRegion").value = "";
  document.getElementById("empId").disabled = false;
}

// 필터링 함수
function filterEmployees() {
    const deptFilter = document.getElementById("filterDept").value.trim().toLowerCase();
    const nameFilter = document.getElementById("filterName").value.trim().toLowerCase();
    const regionFilter = document.getElementById("filterRegion").value.trim().toLowerCase();
  
    const rows = document.querySelectorAll("#emp-table tbody tr");
  
    rows.forEach(row => {
      const nameText = row.children[1].innerText.toLowerCase();
      const regionText = row.children[2].innerText.toLowerCase();
      const deptText = row.children[3].innerText.toLowerCase();
      
  
      const deptMatch = deptText.includes(deptFilter);
      const nameMatch = nameText.includes(nameFilter);
      const regionMatch = regionText.includes(regionFilter);
  
      // 둘 다 포함될 경우만 보이기
      row.style.display = (deptMatch && nameMatch && regionMatch) ? "" : "none";
    });
}
  
  // 전체 보기 (필터 초기화)
  function resetFilter() {
    document.getElementById("filterDept").value = "";
    document.getElementById("filterName").value = "";
    document.getElementById("filterRegion").value = "";
    filterEmployees(); // 전체 다시 보여줌
}

function uploadEmployeeFile() {
    const fileInput = document.getElementById("uploadFile");
    const file = fileInput.files[0];
  
    if (!file) {
      alert("📂 업로드할 파일을 선택하세요.");
      return;
    }
  
    uploadFile("/admin/employees/upload", file,
      () => {
        alert("✅ 업로드 완료!");
        loadEmployees();
      },
      (err) => {
        alert("❌ 업로드 실패: " + err.message);
      }
    );
}

function downloadEmployeeTemplate() {
    window.open(API_BASE_URL + "/admin/employees/template", "_blank");
}