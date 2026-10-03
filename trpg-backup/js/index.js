(function () {
  var data = (window.SCENARIOS || []).slice().sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
  var list = document.getElementById("list");
  var chipsEl = document.getElementById("chips");
  var search = document.getElementById("search");
  var countEl = document.getElementById("count");
  var namesEl = document.getElementById("names");
  var activeTag = "";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hue(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }
  function cssUrl(u) { return 'url("' + String(u).replace(/"/g, "%22") + '")'; }

  function avatar(c) {
    var a = el("span", "av");
    a.title = c.name || "";
    if (c.image) {
      a.style.backgroundImage = cssUrl(c.image);
    } else {
      a.style.background = "linear-gradient(135deg, hsl(" + hue(c.name || "?") + " 62% 46%), #10172b)";
      a.textContent = (c.name || "?").charAt(0);
    }
    return a;
  }

  function tile(s, i) {
    var li = el("li");
    var a = el("a", "tile");
    a.href = s.url || "#";

    var thumb = el("div", "thumb");
    thumb.style.setProperty("--h", hue(s.title || ""));
    thumb.appendChild(el("span", "ph", (s.title || "?").charAt(0)));
    if (s.cover) {
      var img = el("img");
      img.src = s.cover;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { thumb.removeChild(img); };
      thumb.appendChild(img);
    }
    thumb.appendChild(el("span", "no", pad(i + 1)));

    var cast = (s.cast || []).filter(function (c) { return c && c.name; });
    if (cast.length) {
      var stack = el("div", "stack");
      var max = 4;
      cast.slice(0, max).forEach(function (c) { stack.appendChild(avatar(c)); });
      if (cast.length > max) {
        var more = el("span", "av more", "+" + (cast.length - max));
        stack.insertBefore(more, stack.firstChild);
      }
      thumb.appendChild(stack);
    }

    var cap = el("div", "cap");
    cap.appendChild(el("p", "meta", [s.system, s.status, s.date].filter(Boolean).join(" · ")));
    cap.appendChild(el("h3", "", s.title));
    if (s.description) cap.appendChild(el("p", "desc", s.description));

    a.appendChild(thumb);
    a.appendChild(cap);
    li.appendChild(a);
    return li;
  }

  function nameRow(s, i) {
    var li = el("li");
    var a = el("a");
    a.href = s.url || "#";
    a.appendChild(el("span", "n", pad(i + 1)));
    a.appendChild(el("span", "", s.title));
    if (s.date) a.appendChild(el("span", "d", s.date));
    li.appendChild(a);
    return li;
  }

  function haystack(s) {
    var names = (s.cast || []).map(function (c) { return c.name; }).join(" ");
    return [s.title, s.system, s.gm, (s.players || []).join(" "), names, (s.tags || []).join(" "), s.description].join(" ").toLowerCase();
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var shown = data.filter(function (s) {
      if (activeTag && (s.tags || []).concat(s.system || []).indexOf(activeTag) < 0) return false;
      return !q || haystack(s).indexOf(q) >= 0;
    });
    list.textContent = "";
    namesEl.textContent = "";
    shown.forEach(function (s, i) {
      list.appendChild(tile(s, i));
      namesEl.appendChild(nameRow(s, i));
    });
    if (!shown.length) list.appendChild(el("li", "empty", data.length ? "조건에 맞는 로그가 없어." : "아직 등록된 로그가 없어."));
    countEl.textContent = shown.length + " / " + data.length;
  }

  function buildChips() {
    var seen = {};
    data.forEach(function (s) {
      [s.system].concat(s.tags || []).forEach(function (t) { if (t) seen[t] = true; });
    });
    Object.keys(seen).forEach(function (t) {
      var b = el("button", "chip", t);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        activeTag = activeTag === t ? "" : t;
        Array.prototype.forEach.call(chipsEl.children, function (c) {
          c.setAttribute("aria-pressed", String(c.textContent === activeTag));
        });
        render();
      });
      chipsEl.appendChild(b);
    });
  }

  search.addEventListener("input", render);
  buildChips();
  render();
})();
