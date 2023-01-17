module.exports = `(${String(function() {
  const { body, head } = document;
  const timeout = setInterval(() => {
    const todaysRow = document.querySelector('.activeCell');
    const allTimesRows = Array.from(document.querySelectorAll('.clsMonths'));

    window.ReactNativeWebView.postMessage(JSON.stringify({
      todays: rowToTimes(todaysRow),
      tomorrows: rowToTimes(
        todaysRow.nextElementSibling
        || allTimesRows[0]
      ),
    }));

    allTimesRows.splice(allTimesRows.indexOf(todaysRow) - 2, 22);
    allTimesRows.forEach(tr => tr.remove());
    document.querySelectorAll('#tbl_PrayerTimes tr').forEach((tr, i) => {
      tr.style.display = 'table-row';
      const { children } = tr;
      const dayField = children[1];
      dayField.textContent = dayField.textContent.trim().slice(0, 3);
      children[12].remove();
      children[dayField.textContent === 'Fri' ? 7 : 8].remove();
      children[2].remove();
    });

    body.innerHTML = document.getElementById('tbl_PrayerTimes').parentNode.innerHTML;
    body.style.zoom = 0.7;
    head.innerHTML += '<style>#tbl_PrayerTimes th, #tbl_PrayerTimes td {padding: 1px !important;}</style>';

    clearInterval(timeout);
  }, 20);

  function rowToTimes(tr) {
    const tds = tr.querySelectorAll('td');

    return {
      fajr: hm(3),
      "fajr jamat": hm(4),
      sunrise: hm(5),
      zuhr: hm(6),
      "zuhr jamat": hm(7),
      asr: hm(9),
      "asr jamat": hm(10),
      magrib: hm(11),
      isha: hm(13),
      "isha jamat": hm(14),
    };
  
    function hm(n) {
      const td = tds[n];
      if (n === 6 && !td.textContent.trim().startsWith('11')) {
        // Fix bug (from external) where zuhr is set to AM insead of PM
        td.textContent = td.textContent.replace('AM', 'PM');
      }
      const t = td.textContent;
      return [hours(t), minutes(t)];
    }
    function hours(t) {
      let h = parseInt(t);
      if (h === 12) {
        if (t.includes('AM')) {
          h = 0;
        }
      } else if (t.includes('PM')) {
        h += 12;
      }
      return h.toString();
    }
    function minutes(t) {
      let m = parseInt(t.split(':')[1]);
      if (m < 10) {
        m = "0" + m;
      }
      return m.toString();
    }
  }
})})()`;
