(function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function hue(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }
  function cssUrl(u) { return 'url("' + String(u).replace(/"/g, "%22") + '")'; }

  var meta = {};
  try { meta = JSON.parse($("#meta").textContent); } catch (e) {}
  var cast = meta.cast || [];

  function find(name) {
    for (var i = 0; i < cast.length; i++) if (cast[i].name === name) return cast[i];
    return null;
  }
  function color(name) {
    var c = find(name);
    return (c && c.color) || "hsl(" + hue(name || "?") + " 62% 46%)";
  }
  function paint(node, name) {
    var c = find(name);
    if (c && c.image) {
      node.style.backgroundImage = cssUrl(c.image);
    } else {
      node.style.background = "linear-gradient(135deg, " + color(name) + ", #10172b)";
      node.textContent = (name || "?").charAt(0);
    }
  }

  /* hero */
  var hero = $("#hero");
  if (hero && meta.title) {
    hero.textContent = "";
    hero.style.setProperty("--h", hue(meta.title));
    if (meta.cover) {
      hero.style.setProperty("--cover-img", cssUrl(meta.cover));
      hero.classList.add("has-cover");
    }
    hero.appendChild(el("span", "grain"));
    var inner = el("div", "hero-in");
    var text = el("div");
    var pills = el("div", "pills");
    [meta.system, meta.status].filter(Boolean).forEach(function (p) { pills.appendChild(el("span", "pill", p)); });
    if (pills.children.length) text.appendChild(pills);
    text.appendChild(el("h1", "", meta.title));
    var info = [];
    if (meta.gm) info.push("GM " + meta.gm);
    if (meta.players && meta.players.length) info.push("PL " + meta.players.join(", "));
    if (meta.date) info.push(meta.date);
    if (info.length) text.appendChild(el("p", "meta", info.join("  ·  ")));
    if (meta.description) text.appendChild(el("p", "about", meta.description));
    inner.appendChild(text);
    if (meta.cover) {
      var cv = el("div", "hero-cover");
      cv.style.backgroundImage = cssUrl(meta.cover);
      inner.appendChild(cv);
    }
    hero.appendChild(inner);
  }

  /* cast */
  var castSec = $("#cast");
  if (castSec && cast.length) {
    castSec.hidden = false;
    castSec.appendChild(el("h2", "sec-title", "Cast"));
    var grid = el("div", "cast-grid");
    cast.forEach(function (c) {
      var card = el("article", "pc");
      card.style.setProperty("--c", color(c.name));
      var pic = el("div", "pic");
      paint(pic, c.name);
      if (c.role) pic.appendChild(el("span", "role", c.role));
      var body = el("div", "info");
      body.appendChild(el("p", "nm", c.name));
      if (c.desc) body.appendChild(el("p", "ds", c.desc));
      card.appendChild(pic);
      card.appendChild(body);
      grid.appendChild(card);
    });
    castSec.appendChild(grid);
  }

  /* chat messages */
  var prev = null;
  Array.prototype.forEach.call(document.querySelectorAll(".chat .msg"), function (m) {
    if (m.classList.contains("narr") || m.classList.contains("brk")) { prev = null; return; }
    var who = m.getAttribute("data-who") || "";
    m.style.setProperty("--c", color(who));
    if (prev === who) {
      m.classList.add("cont");
    } else {
      var nm = m.querySelector(".nm");
      if (nm) {
        var av = el("span", "av");
        paint(av, who);
        nm.insertBefore(av, nm.firstChild);
      }
    }
    prev = who;
  });

  /* font size */
  var size = 16;
  try { size = +localStorage.getItem("log-size") || 16; } catch (e) {}
  function apply() { document.documentElement.style.setProperty("--log-size", size + "px"); }
  apply();
  Array.prototype.forEach.call(document.querySelectorAll("[data-size]"), function (b) {
    b.addEventListener("click", function () {
      size = Math.max(11, Math.min(24, size + (+b.getAttribute("data-size"))));
      apply();
      try { localStorage.setItem("log-size", size); } catch (e) {}
    });
  });
})();
