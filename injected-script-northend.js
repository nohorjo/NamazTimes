module.exports = `(${String(function() {
  const timeout = setInterval(() => {
    const todays = {
      fajr: hm('fajrBegins'),
      "fajr jamat": hm('fajrJamah'),
      sunrise: hm('sunriseBegins'),
      zuhr: hm('dhurBegins'),
      "zuhr jamat": hm(new Date().getDay() === 6 ? 'jumaJamah' : 'dhurJamah'),
      asr: hm('asrBegins'),
      "asr jamat": hm('asrJamah'),
      magrib: hm('maghribBegins'),
      isha: hm('ishaBegins'),
      "isha jamat": hm('ishaJamah'),
    };

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      todays,
      tomorrows: todays,
    }));

    clearInterval(timeout);
  }, 100);

  function hm(id) {
    const t = document.getElementById(id).textContent;

    return [hours(t), minutes(t)];

    function hours(t) {
      let h = parseInt(t);
      if (isNaN(h)) {
        throw new Error('Invalid number');
      }
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
      if (isNaN(m)) {
        throw new Error('Invalid number');
      }
      if (m < 10) {
        m = "0" + m;
      }
      return m.toString();
    }
  }
})})()`;
