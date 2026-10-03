(function () {
  var data = (window.SCENARIOS || []).slice().sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
  var list = document.getElementById("list");
  var chipsEl = document.getElementById("chips");
  var search = document.getElementById("search");
  var countEl = document.getElementById("count");
  var activeTag = "";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function card(s) {
    var li = el("li", "item");
    var a = el("a");
    a.href = s.url || "#";

    var cover = el("div", "cover");
    if (s.cover) {
      var img = el("img");
      img.src = s.cover;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { cover.removeChild(img); cover.textContent = (s.title || "?").charAt(0); };
      cover.appendChild(img);
    } else {
      cover.textContent = (s.title || "?").charAt(0);
    }

    var info = el("div", "info");
    info.appendChild(el("p", "meta", [s.system, s.status].filter(Boolean).join(" · ")));
    info.appendChild(el("h2", "", s.title));
    if (s.description) info.appendChild(el("p", "desc", s.description));
    var sub = [];
    if (s.gm) sub.push("GM " + s.gm);
    if (s.players && s.players.length) sub.push("PL " + s.players.join(", "));
    if (s.date) sub.push(s.date);
    info.appendChild(el("p", "sub", sub.join("  ·  ")));
    if (s.tags && s.tags.length) {
      var tags = el("div", "tags");
      s.tags.forEach(function (t) { tags.appendChild(el("span", "tag", t)); });
      info.appendChild(tags);
    }

    a.appendChild(cover);
    a.appendChild(info);
    li.appendChild(a);
    return li;
  }

  function haystack(s) {
    return [s.title, s.system, s.gm, (s.players || []).join(" "), (s.tags || []).join(" "), s.description].join(" ").toLowerCase();
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var shown = data.filter(function (s) {
      if (activeTag && (s.tags || []).concat(s.system || []).indexOf(activeTag) < 0) return false;
      return !q || haystack(s).indexOf(q) >= 0;
    });
    list.textContent = "";
    shown.forEach(function (s) { list.appendChild(card(s)); });
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
