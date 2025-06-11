// 초기 실행
document.addEventListener("DOMContentLoaded", () => {
    populateYearSelector();
    const currentYear = new Date().getFullYear();
    document.getElementById("yearSelector").value = currentYear;
    updateCalendar();
});

// 🔁 연도 선택 박스 채우기
function populateYearSelector() {
    const selector = document.getElementById("yearSelector");
    const thisYear = new Date().getFullYear();

    for (let y = thisYear - 3; y <= thisYear + 3; y++) {
        const option = document.createElement("option");
        option.value = y;
        option.textContent = `${y}년`;
        selector.appendChild(option);
    }
}

// 📅 연도 변경 시 달력 및 공휴일 목록 갱신
function updateCalendar() {
    const year = document.getElementById("yearSelector").value;
    renderCalendar(year);
    loadHolidays(year);
}

// 📅 달력 생성
function renderCalendar(year) {
  const wrapper = document.getElementById("calendar-wrapper");
  wrapper.innerHTML = "";

  for (let month = 0; month < 12; month++) {
    const table = document.createElement("table");
    table.className = "month-calendar";

    // 캡션: "1월", "2월" ...
    const caption = document.createElement("caption");
    caption.innerText = `${month + 1}월`;
    table.appendChild(caption);

    // 요일 헤더
    const thead = document.createElement("thead");
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const headRow = document.createElement("tr");
    days.forEach(d => {
      const th = document.createElement("th");
      th.innerText = d;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // 본문: 날짜들
    const tbody = document.createElement("tbody");
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let row = document.createElement("tr");
    for (let i = 0; i < firstDay; i++) {
      row.appendChild(document.createElement("td"));
    }

    for (let date = 1; date <= lastDate; date++) {
      const td = document.createElement("td");
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      td.innerText = date;

      // 일요일 처리
      const dayOfWeek = new Date(year, month, date).getDay();
      if (dayOfWeek === 0) td.classList.add("sunday");

      // 공휴일 여부 (기존에 불러온 공휴일 배열 활용)
      if (window.currentHolidays && window.currentHolidays.includes(dateStr)) {
          td.classList.add("holiday"); // ✅ 이 클래스는 CSS에서 붉은색 처리
      }

      row.appendChild(td);

      if ((firstDay + date) % 7 === 0 || date === lastDate) {
        tbody.appendChild(row);
        row = document.createElement("tr");
      }
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
  }
}

// 공휴일 정보를 불러올 때 아래처럼 저장
function loadHolidays(year) {
    getData(`/holidays?year=${year}`,
        (data) => {
            window.currentHolidays = data.map(h => h.date);  // ✅ 공휴일 배열 저장
            renderCalendar(year);	 // ✅ 달력 다시 그리기
            renderHolidayList(data); 	 // ✅ 오른쪽 목록 다시 그림
        }
    );
}



// ✅ 공휴일 추가 요청
function addHoliday() {
    const date = document.getElementById("holidayPicker").value;
    if (!date) return alert("날짜를 선택하세요!");

    postData("/holidays", { date, description: "공휴일" },
        () => {
            const year = new Date(date).getFullYear();
            loadHolidays(year);
            document.getElementById("holidayPicker").value = "";
            showToast("✅ 공휴일 추가 완료");
        },
        (err) => showToast("❌ 공휴일 추가 실패: " + err.message)
    );
}

// ✅ 공휴일 삭제 요청
function deleteHoliday(date) {
    if (!confirm(`${date} 공휴일을 삭제하시겠습니까?`)) return;

    const year = new Date(date).getFullYear();

    deleteData(`/holidays?date=${date}`,
        () => {
            loadHolidays(year);
            showToast("🗑 공휴일이 삭제되었습니다.");
        }
    );
}

// 📋 공휴일 목록을 우측에 표시
function renderHolidayList(holidays) {
    const list = document.getElementById("holidayItems");
    list.innerHTML = "";

    holidays.forEach(holiday => {
        const item = document.createElement("div");
        item.className = "holiday-item";
        item.innerHTML = `
            <span>${holiday.date}</span>
            <button onclick="deleteHoliday('${holiday.date}')">삭제</button>
        `;
        list.appendChild(item);
    });
}

// 📌 달력에서 공휴일 강조 표시
function highlightCalendar(holidays) {
    const allCells = document.querySelectorAll("td[data-date]");
    allCells.forEach(cell => {
        const date = cell.getAttribute("data-date");
        const isHoliday = holidays.some(h => h.date === date);

        if (isHoliday) {
            cell.style.backgroundColor = "#ffcccc";
            cell.style.fontWeight = "bold";
        } else {
            cell.style.backgroundColor = "";
            cell.style.fontWeight = "";
        }
    });
}
