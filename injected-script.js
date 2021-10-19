module.exports = `(${String(function() {
  const { body, head } = document;
  const yesterdaysDate = new Date().getDate() - 1;
  const timeout = setInterval(() => {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      todays: rowToTimes(document.querySelector('.activeCell')),
      tomorrows: rowToTimes(
        document.querySelector('.activeCell~tr')
        || document.querySelector('.clsMonths')
      ),
    }));

    body.innerHTML = document.getElementById('tbl_PrayerTimes').parentNode.innerHTML;
    body.style.zoom=0.7;
    head.innerHTML += '<style>#tbl_PrayerTimes th, #tbl_PrayerTimes td {padding: 1px !important;}</style>';
    document.querySelectorAll('#tbl_PrayerTimes tr').forEach(tr => {
      const { children } = tr;
      if (+children[0].textContent < yesterdaysDate) {
        tr.remove();
      } else {
        const dayField = children[1];
        dayField.textContent = dayField.textContent.trim().slice(0, 3);
        children[12].remove();
        children[8].remove();
        children[2].remove();
      }
    });
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
      const t = tds[n].textContent;
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