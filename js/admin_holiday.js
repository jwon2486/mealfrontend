function renderCalendar(year) {
  const wrapper = document.getElementById("calendar-wrapper");
  wrapper.innerHTML = "";

  for (let month = 0; month < 12; month++) {
    const table = document.createElement("table");
    table.className = "month-calendar";

    // 📅 캡션: "1월", "2월" 등
    const caption = document.createElement("caption");
    caption.innerText = `${month + 1}월`;
    table.appendChild(caption);

    // 🗓️ 요일 헤더
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

    // 📆 날짜 본문
    const tbody = document.createElement("tbody");
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let row = document.createElement("tr");

    // 앞쪽 빈 셀
    for (let i = 0; i < firstDay; i++) {
      row.appendChild(document.createElement("td"));
    }

    for (let date = 1; date <= lastDate; date++) {
      const td = document.createElement("td");
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      td.innerText = date;

      // 일요일 강조
      const dayOfWeek = new Date(year, month, date).getDay();
      if (dayOfWeek === 0) td.classList.add("sunday");

      // 공휴일 강조
      if (window.currentHolidays && window.currentHolidays.includes(dateStr)) {
        td.classList.add("holiday");

        const holiday = window.currentHolidayDetail.find(h => h.date === dateStr);
        if (holiday) td.title = holiday.description;  // 툴팁
      }

      row.appendChild(td);

      // 줄바꿈
      if ((firstDay + date) % 7 === 0 || date === lastDate) {
        tbody.appendChild(row);
        row = document.createElement("tr");
      }
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
  }
}
