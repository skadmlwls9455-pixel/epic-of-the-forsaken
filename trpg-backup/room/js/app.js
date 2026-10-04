// TRPG ROOM 화면/조작. 룰 계산은 CoC(coc.js), 상태는 Store, 연출은 FX.
(function () {
  "use strict";

  const SC = window.SCENARIO;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const st = () => Store.get();
  const charDef = (id) => SC.chars.find((c) => c.id === id);
  const sceneDef = (id) => SC.scenes.find((s) => s.id === id);
  const clueDef = (id) => SC.clues.find((c) => c.id === id);
  const isKP = () => st() && st().mode === "kp";
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (t) => { const d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const hms = (ms) => { const s = Math.floor(ms / 1000); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); };
  const STATUSES = ["부상", "중상", "기절", "광기", "독", "구속", "출혈", "추적당함"];
  const EXPRS = { neutral: "기본", smile: "미소", angry: "분노", sad: "슬픔", surprised: "놀람" };

  let logFilter = "all", investigate = false, editing = false, activeKey = "", statusOpen = false;
  let renderedScene = null, renderedLine = null, pendingTransition = null;
  let lastLogKey = "", lastModeKey = "";
  let modalClose = null, modalGen = 0;

  // ---------- 작은 도구 ----------
  function toast(msg, ms) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toast.id);
    toast.id = setTimeout(() => t.classList.remove("on"), ms || 2600);
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // 모달 안의 숫자를 굴리는 연출. 그 사이 창이 닫히거나 바뀌면 done 을 부르지 않는다
  function animateNumber(el, final, enabled, done) {
    const gen = modalGen;
    const finish = () => { el.textContent = final; if (done && gen === modalGen) done(); };
    if (!enabled) { finish(); return; }
    const t0 = Date.now();
    const id = setInterval(() => {
      if (Date.now() - t0 > 650) { clearInterval(id); finish(); return; }
      el.textContent = 1 + Math.floor(Math.random() * 100);
    }, 55);
  }

  function skillValue(charId, name) {
    const c = st().chars[charId];
    if (c.skills[name] != null) return c.skills[name];
    const def = CoC.SKILLS.find((s) => s.name === name);
    return def ? CoC.baseValue(def, c.attrs) : 0;
  }

  // 편집 모드로 교체한 이미지가 있으면 그걸, 없으면 시나리오 데이터의 값을 쓴다
  const bgFor = (sc) => Assets.get("bg:" + sc.id) || sc.bg;
  const portraitFor = (cd) => Assets.get("portrait:" + cd.id) || cd.portrait;
  const handoutImg = (h) => Assets.get("handout:" + h.id) || h.image || "";
  const spriteFor = (cd, ex) => Assets.get("sprite:" + cd.id + ":" + ex) || Assets.get("sprite:" + cd.id + ":neutral") || (cd.sprites && cd.sprites[ex]) || cd.sprite || "";

  function dbOf(charId) { return CoC.derived(st().chars[charId].attrs).db; }

  // ---------- 모달 ----------
  function openModal(title, html, opts) {
    opts = opts || {};
    closeModal(true);
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = html;
    $(".modal-card").classList.toggle("wide", !!opts.wide);
    $("#modal").hidden = false;
    modalClose = opts.onClose || null;
    const body = $("#modal-body");
    body.gen = ++modalGen; // 지연 콜백이 나중에 열린 다른 창을 덮어쓰지 않게 하는 표시
    return body;
  }

  function closeModal(silent) {
    if ($("#modal").hidden) return;
    $("#modal").hidden = true;
    modalGen++;
    const cb = modalClose;
    modalClose = null;
    if (cb && !silent) cb();
  }

  // ---------- 로그 ----------
  function addLog(type, who, text, data) { Store.addLog(type, who, text, data); return st().log[st().log.length - 1]; }

  // 같은 항목을 짧은 시간 안에 연달아 조정하면 한 줄로 합친다
  function adjust(charId, key, delta) {
    const s = st(), c = s.chars[charId], name = charDef(charId).name;
    const max = key === "luck" ? 99 : c[key + "Max"];
    const before = c[key];
    c[key] = Math.max(0, Math.min(max, before + delta));
    const real = c[key] - before;
    if (!real) return;
    if (key === "san" && real < 0) {
      c.sanLost += -real;
      flagMadness(charId, -real);
    }
    const label = key.toUpperCase();
    const last = s.log[s.log.length - 1];
    const text = name + " " + label + " ";
    if (last && last.type === "system" && last.data && last.data.adj === charId + key && Date.now() - last.t < 5000) {
      last.t = Date.now();
      last.data.to = c[key];
      last.text = text + last.data.from + " → " + c[key];
      if (key === "san") last.data.sanLost = (last.data.sanLost || 0) + (real < 0 ? -real : 0);
    } else {
      addLog("system", "SYSTEM", text + before + " → " + c[key], { adj: charId + key, from: before, to: c[key], sanLost: key === "san" && real < 0 ? -real : undefined });
    }
    if (key === "hp" && c.hp === 0) toast(name + " HP 0 — 빈사/사망 처리는 KP가 정해줘");
    Store.commit();
  }

  function flagMadness(charId, single) {
    const c = st().chars[charId];
    CoC.madnessFlags(c.sanStart, c.san, c.sanLost, single).forEach((f) => {
      addLog("secret", "SYSTEM", "[" + charDef(charId).name + "] " + f.text, { flag: f.kind });
      if (isKP()) toast(f.text, 4200);
    });
  }

  // ---------- 장면 ----------
  function goScene(id, transition) {
    const s = st(), sc = sceneDef(id);
    if (!sc) return;
    s.sceneId = id;
    s.effects = (sc.effects || []).slice();
    s.line = sc.text;
    s.speaker = null;
    s.shownHandout = null;
    pendingTransition = transition || sc.transition || "fade";
    addLog("system", "SCENE", "SCENE " + pad(SC.scenes.indexOf(sc) + 1) + " — " + sc.title + " · " + sc.time);
    addLog("rp", "KP", sc.text);
    Store.commit();
  }

  function say(who, text, speakerName) {
    const s = st();
    s.speaker = speakerName || null;
    s.line = text;
    addLog("rp", who, text);
    Store.commit();
  }

  // ---------- 판정 ----------
  function logRoll(charId, label, res, extra) {
    const c = charDef(charId) || { name: charId };
    const gr = CoC.GRADES[res.level];
    const diff = res.difficulty === "hard" ? " (어려움)" : res.difficulty === "extreme" ? " (극단적)" : "";
    const mod = res.roll.mod ? (res.roll.mod > 0 ? " 보너스" : " 페널티") + Math.abs(res.roll.mod) : "";
    const text = c.name + " → " + label + " " + res.skill + diff + mod + " / 굴림 " + res.value + " — " + gr.label + (extra || "");
    return { text, data: { kind: "skill", charId, label, level: res.level, value: res.value, target: res.target, skill: res.skill } };
  }

  function openRoll(o) {
    const s = st();
    const c = s.chars[o.charId], cd = charDef(o.charId);
    const noLuck = o.kind === "luck" || o.kind === "san";
    let mod = 0, difficulty = "regular", secret = !!o.secret, cur = null, pushed = false, resolved = false, pushNote = "";
    const kp = isKP();

    const resolve = () => {
      if (resolved) return;
      resolved = true;
      if (o.onResolve) o.onResolve(cur);
    };

    const body = openModal(o.label + " 판정", "", { onClose: () => { resolve(); if (o.back) o.back(); } });

    function drawSetup() {
      body.innerHTML =
        '<div class="roll-target"><small>' + esc(cd.name) + '</small><b>' + o.skill + '</b><span>' + esc(o.label) + '</span></div>' +
        '<div class="seg" data-grp="diff">' +
          [["regular", "보통"], ["hard", "어려움"], ["extreme", "극단적"]].map(([k, l]) =>
            '<button class="chip' + (difficulty === k ? " on" : "") + '" data-k="' + k + '">' + l + ' ' + CoC.difficultyTarget(o.skill, k) + '</button>').join("") +
        '</div>' +
        '<div class="seg" data-grp="mod">' +
          [-2, -1, 0, 1, 2].map((m) => '<button class="chip' + (mod === m ? " on" : "") + '" data-k="' + m + '">' + (m === 0 ? "일반" : m > 0 ? "보너스 +" + m : "페널티 " + m) + '</button>').join("") +
        '</div>' +
        (kp ? '<label class="check"><input type="checkbox" id="rl-secret"' + (secret ? " checked" : "") + '> 비밀 판정 (KP에게만 기록)</label>' +
              '<label class="field">강행 실패 시 결과 (KP 메모)<input id="rl-push" type="text" value="' + esc(pushNote) + '" placeholder="예: 소리를 내어 위치를 들킨다"></label>' : "") +
        '<div class="row end"><button class="btn primary big" id="rl-go">굴리기</button></div>';
      body.querySelectorAll(".seg").forEach((seg) => seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (seg.dataset.grp === "diff") difficulty = b.dataset.k; else mod = parseInt(b.dataset.k, 10);
        drawSetup();
      }));
      const sec = $("#rl-secret", body); if (sec) sec.onchange = () => { secret = sec.checked; };
      const pn = $("#rl-push", body); if (pn) pn.oninput = () => { pushNote = pn.value; };
      $("#rl-go", body).onclick = () => doRoll(false);
    }

    function doRoll(isPush) {
      const res = CoC.check(o.skill, { mod, difficulty });
      cur = res;
      const lr = logRoll(o.charId, o.label, res, isPush ? " [강행]" : "");
      cur.entry = addLog(secret ? "secret" : "dice", secret ? "SECRET" : cd.name, (secret ? "[비밀] " : "") + lr.text, lr.data);
      if (o.kind === "san") cur.entry.data.sanRoll = true;
      Store.commit();
      drawRolling(res, isPush);
    }

    function drawRolling(res, isPush) {
      body.innerHTML = '<div class="roll-target"><small>' + esc(cd.name) + ' · ' + esc(o.label) + ' ' + res.skill + (res.difficulty !== "regular" ? " → " + res.target : "") + '</small><div class="big-num" id="rl-num">--</div></div><div id="rl-after"></div>';
      animateNumber($("#rl-num", body), res.value, s.settings.anim, () => drawResult(res, isPush));
    }

    function drawResult(res, isPush) {
      const gr = CoC.GRADES[res.level], r = res.roll;
      const detail = r.mod
        ? "일의 자리 " + r.units + " · 십의 자리 후보 " + r.tens.map((t) => (t === 0 ? "00" : t)).join(", ") + " → " + r.cands.join(", ") + " 중 " + (r.mod > 0 ? "낮은" : "높은") + " 값"
        : "";
      const needLuck = !noLuck && !res.ok ? CoC.luckNeeded(res.value, res.target, c.luck) : null;
      const canPush = !noLuck && !res.ok && res.level !== "fumble" && !pushed && !isPush;
      const pushFailed = isPush && !res.ok;
      $("#rl-num", body).className = "big-num g-" + res.level;
      $("#rl-after", body).innerHTML =
        '<div class="grade g-' + res.level + '"><b>' + gr.label + '</b></div>' +
        (detail ? '<p class="muted center">' + esc(detail) + '</p>' : "") +
        (pushFailed ? '<p class="warn">강행 실패' + (pushNote ? " — " + esc(pushNote) : " — KP가 결과를 정해줘") + '</p>' : "") +
        '<div class="row end">' +
          (needLuck ? '<button class="btn" id="rl-luck">행운 ' + needLuck + ' 사용 (' + c.luck + ' → ' + (c.luck - needLuck) + ')</button>' : "") +
          (canPush ? '<button class="btn" id="rl-pushbtn">강행 판정</button>' : "") +
          '<button class="btn primary" id="rl-done">확인</button></div>';
      if (s.settings.anim && !secret && (res.level === "critical" || res.level === "extreme" || res.level === "fumble")) FX.flash($("#stage"), res.level);
      if (pushFailed && !secret) addLog("system", "SYSTEM", "강행 실패" + (pushNote ? " — " + pushNote : ""));
      const lb = $("#rl-luck", body);
      if (lb) lb.onclick = () => {
        c.luck -= needLuck;
        res.level = res.difficulty === "extreme" ? "extreme" : res.difficulty === "hard" ? "hard" : "success";
        res.ok = true;
        if (res.entry) { res.entry.data.level = res.level; res.entry.text += " → 행운 " + needLuck + " 사용으로 " + CoC.GRADES[res.level].label; }
        addLog("system", "SYSTEM", cd.name + " LUCK " + (c.luck + needLuck) + " → " + c.luck);
        Store.commit();
        drawResult(res, isPush);
      };
      const pb = $("#rl-pushbtn", body);
      if (pb) pb.onclick = () => { pushed = true; doRoll(true); };
      $("#rl-done", body).onclick = () => closeModal();
    }

    drawSetup();
  }

  function rollSkill(charId, name, extra) {
    const o = Object.assign({ charId, label: name, skill: skillValue(charId, name), kind: "skill" }, extra || {});
    openRoll(o);
  }

  // ---------- 주사위 패널 ----------
  function rollExprFor(text, charId) {
    const res = CoC.rollExpr(text, dbOf(charId));
    const who = charDef(charId).name;
    const out = who + " → " + res.expr + " = " + CoC.formatExpr(res) + " = " + res.total;
    addLog("dice", who, out, { kind: "expr", total: res.total });
    Store.commit();
    return res;
  }

  function openDice() {
    const s = st();
    const body = openModal("주사위", "", {});
    const dice = [100, 20, 12, 10, 8, 6, 4, 3];
    const recent = () => s.log.filter((e) => e.type === "dice" && e.data && e.data.kind === "expr").slice(-6).reverse();
    function draw(last) {
      body.innerHTML =
        '<div class="dice-grid">' + dice.map((d) => '<button class="die" data-d="' + d + '">D' + d + '</button>').join("") + '</div>' +
        '<form class="row" id="dice-form"><input id="dice-expr" type="text" placeholder="2d6+3  ·  1d10+2  ·  1d4+db" value="' + esc(last || "") + '" autocomplete="off"><button class="btn primary" type="submit">굴리기</button></form>' +
        '<div class="dice-out" id="dice-out"></div>' +
        '<h3>최근</h3><ul class="plain">' + (recent().map((e) => "<li>" + esc(e.text) + "</li>").join("") || '<li class="muted">아직 없어</li>') + "</ul>";
      const run = (txt) => {
        try {
          const res = rollExprFor(txt, s.activePc);
          const out = $("#dice-out", body);
          out.innerHTML = '<div class="big-num">--</div><p class="muted center">' + esc(res.expr + " = " + CoC.formatExpr(res)) + "</p>";
          const gen = modalGen;
          animateNumber($(".big-num", out), res.total, s.settings.anim, () => { setTimeout(() => { if (gen === modalGen) draw(txt); }, 900); });
        } catch (e) { toast(e.message); }
      };
      body.querySelectorAll(".die").forEach((b) => (b.onclick = () => run("1d" + b.dataset.d)));
      $("#dice-form", body).onsubmit = (e) => { e.preventDefault(); run($("#dice-expr", body).value); };
    }
    draw("");
  }

  // ---------- SAN ----------
  function openSan(pre) {
    pre = pre || {};
    const s = st();
    const body = openModal("SAN 판정", "", {});
    let charId = pre.charId || s.activePc;
    function draw() {
      const c = s.chars[charId];
      body.innerHTML =
        '<label class="field">대상<select id="sn-who">' + SC.chars.filter((x) => x.role !== "NPC").map((x) => '<option value="' + x.id + '"' + (x.id === charId ? " selected" : "") + ">" + esc(x.name) + " (SAN " + s.chars[x.id].san + ")</option>").join("") + "</select></label>" +
        '<label class="field">사유<input id="sn-why" type="text" value="' + esc(pre.reason || "") + '" placeholder="예: 난간 위의 꽃"></label>' +
        '<div class="row"><label class="field grow">성공 시 손실<input id="sn-ok" type="text" value="' + esc(pre.ok || "0") + '"></label><label class="field grow">실패 시 손실<input id="sn-fail" type="text" value="' + esc(pre.fail || "1d6") + '"></label></div>' +
        '<p class="muted">현재 SAN ' + c.san + ' · 세션 시작 ' + c.sanStart + ' · 누적 손실 ' + c.sanLost + '</p>' +
        '<div class="row end"><button class="btn primary big" id="sn-go">SAN 판정</button></div><div id="sn-out"></div>';
      $("#sn-who", body).onchange = (e) => { charId = e.target.value; pre = { reason: $("#sn-why", body).value, ok: $("#sn-ok", body).value, fail: $("#sn-fail", body).value }; draw(); };
      $("#sn-go", body).onclick = () => {
        let r;
        try { r = CoC.sanCheck(c.san, $("#sn-ok", body).value, $("#sn-fail", body).value, dbOf(charId)); } catch (e) { toast(e.message); return; }
        const why = $("#sn-why", body).value.trim();
        const name = charDef(charId).name, before = c.san;
        c.san = r.after;
        c.sanLost += r.lost;
        const gr = CoC.GRADES[r.check.level];
        const lossTxt = r.lost ? "SAN " + before + " → " + r.after + " (-" + r.lost + ")" : "SAN 손실 없음";
        addLog("dice", name, name + " SAN 판정" + (why ? " (" + why + ")" : "") + " " + before + " / 굴림 " + r.check.value + " — " + gr.label + " · " + lossTxt,
          { kind: "san", charId, level: r.check.level, value: r.check.value, sanLost: r.lost });
        if (r.lost) flagMadness(charId, r.lost);
        Store.commit();
        if (s.settings.anim && (r.check.level === "fumble" || r.check.level === "critical")) FX.flash($("#stage"), r.check.level);
        const out = $("#sn-out", body);
        out.innerHTML = '<div class="big-num">--</div><div id="sn-res"></div>';
        animateNumber($(".big-num", out), r.check.value, s.settings.anim, () => {
          $(".big-num", out).className = "big-num g-" + r.check.level;
          $("#sn-res", out).innerHTML = '<div class="grade g-' + r.check.level + '"><b>' + gr.label + '</b></div>' +
            '<p class="center san-line">' + esc(lossTxt) + (r.loss.maxed ? " · 대실패: 최대 손실" : r.lost ? " · " + esc(CoC.formatExpr(r.loss)) : "") + "</p>" +
            (isKP() ? CoC.madnessFlags(c.sanStart, c.san, c.sanLost, r.lost).map((f) => '<p class="warn">' + esc(f.text) + "</p>").join("") : "");
        });
      };
    }
    draw();
  }

  // ---------- 캐릭터 시트 ----------
  function openSheet(id, onlyLearned) {
    const s = st();
    id = id || s.activePc;
    onlyLearned = onlyLearned == null ? true : onlyLearned;
    const cd = charDef(id), c = s.chars[id], d = CoC.derived(c.attrs);
    const names = CoC.SKILLS.map((x) => x.name);
    Object.keys(c.skills).forEach((n) => { if (!names.includes(n)) names.push(n); });
    const rows = names.map((n) => {
      const def = CoC.SKILLS.find((x) => x.name === n);
      const base = def ? CoC.baseValue(def, c.attrs) : 0, v = skillValue(id, n);
      return { n, base, v, learned: c.skills[n] != null && c.skills[n] !== base };
    }).filter((r) => !onlyLearned || r.learned).sort((a, b) => b.v - a.v);

    const body = openModal(cd.name + " — 캐릭터 시트", "", { wide: true });
    body.innerHTML =
      '<div class="tabs">' + SC.chars.map((x) => '<button class="chip' + (x.id === id ? " on" : "") + '" data-id="' + x.id + '">' + esc(x.name) + "</button>").join("") + "</div>" +
      '<div class="sheet-grid"><div>' +
        '<p class="muted">' + esc(cd.role) + " · " + esc(cd.job) + (cd.age ? " · " + cd.age + "세" : "") + "</p><p>" + esc(cd.intro) + "</p>" +
        '<h3>능력치 <small class="muted">누르면 판정</small></h3><div class="attrs">' +
        CoC.ATTRS.map(([k, l]) => '<div class="attr"><button data-roll-attr="' + k + '"><small>' + l + '</small><b>' + c.attrs[k] + '</b></button><span class="half">' + Math.floor(c.attrs[k] / 2) + "/" + Math.floor(c.attrs[k] / 5) + "</span></div>").join("") + "</div>" +
        '<h3>상태치</h3><div class="vitals">' +
        [["hp", "HP"], ["mp", "MP"], ["san", "SAN"]].map(([k, l]) => '<label><small>' + l + "</small><input type=\"number\" data-v=\"" + k + '" value="' + c[k] + '" min="0" max="' + c[k + "Max"] + '"><i>/ ' + c[k + "Max"] + "</i></label>").join("") +
        '<label><small>LUCK</small><input type="number" data-v="luck" value="' + c.luck + '" min="0" max="99"><i><button class="chip" data-roll-luck>행운 판정</button></i></label></div>' +
        '<p class="muted">MOV ' + d.mov + " · BUILD " + d.build + " · DB " + d.db + "</p>" +
      "</div><div>" +
        '<div class="row"><h3 class="grow">기능치 <small class="muted">이름을 누르면 판정</small></h3><label class="check"><input type="checkbox" id="sh-learned"' + (onlyLearned ? " checked" : "") + "> 배운 것만</label></div>" +
        '<div class="skills">' + rows.map((r) =>
          '<div class="skill' + (r.learned ? " learned" : "") + '"><button data-roll="' + esc(r.n) + '">' + esc(r.n) + '</button><input type="number" data-skill="' + esc(r.n) + '" value="' + r.v + '" min="0" max="99"><span class="half">' + Math.floor(r.v / 2) + "/" + Math.floor(r.v / 5) + "</span></div>").join("") + "</div>" +
        '<form class="row" id="sh-add"><input id="sh-add-name" placeholder="기능치 추가 (예: 사진술)" maxlength="20"><input id="sh-add-val" type="number" placeholder="값" min="0" max="99"><button class="btn" type="submit">추가</button></form>' +
      "</div></div>";

    const again = () => openSheet(id, $("#sh-learned", body) ? $("#sh-learned", body).checked : onlyLearned);
    body.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => openSheet(b.dataset.id, onlyLearned)));
    $("#sh-learned", body).onchange = again;
    const clamp = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
    body.querySelectorAll("[data-v]").forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.v, max = k === "luck" ? 99 : c[k + "Max"];
      adjust(id, k, clamp(inp.value, max) - c[k]);
      openSheet(id, onlyLearned);
    }));
    body.querySelectorAll("[data-skill]").forEach((inp) => (inp.onchange = () => { c.skills[inp.dataset.skill] = clamp(inp.value, 99); Store.commit(); }));
    body.querySelectorAll("[data-roll]").forEach((b) => (b.onclick = () => rollSkill(id, b.dataset.roll, { back: () => openSheet(id, onlyLearned) })));
    body.querySelectorAll("[data-roll-attr]").forEach((b) => (b.onclick = () => openRoll({ charId: id, label: b.dataset.rollAttr.toUpperCase(), skill: c.attrs[b.dataset.rollAttr], kind: "attr", back: () => openSheet(id, onlyLearned) })));
    const lb = $("[data-roll-luck]", body);
    if (lb) lb.onclick = () => openRoll({ charId: id, label: "행운", skill: c.luck, kind: "luck", back: () => openSheet(id, onlyLearned) });
    $("#sh-add", body).onsubmit = (e) => {
      e.preventDefault();
      const n = $("#sh-add-name", body).value.trim();
      if (!n) return;
      c.skills[n] = clamp($("#sh-add-val", body).value, 99);
      Store.commit();
      openSheet(id, onlyLearned);
    };
  }

  // ---------- 단서 / 핸드아웃 / 소지품 ----------
  function revealClue(id, silent) {
    const s = st();
    if (s.clues[id]) return false;
    s.clues[id] = true;
    const cl = clueDef(id);
    addLog("clue", "CLUE", "단서 획득 — " + cl.title);
    if (!silent) toast("단서 획득: " + cl.title);
    Store.commit();
    return true;
  }

  function openClues() {
    const s = st(), kp = isKP();
    const body = openModal("단서", "", { wide: true });
    const found = SC.clues.filter((c) => s.clues[c.id]).length;
    body.innerHTML = '<p class="muted">' + found + " / " + SC.clues.length + '</p><div class="cards">' + SC.clues.map((c, i) => {
      const got = !!s.clues[c.id];
      const links = got ? (c.links || []).filter((l) => s.clues[l]).map((l) => clueDef(l).title) : [];
      return '<article class="card clue' + (got ? "" : " locked") + '"><small>' + pad(i + 1) + "</small><h4>" + (got ? esc(c.title) : kp ? "??? <span class='muted'>(" + esc(c.title) + ")</span>" : "???") + "</h4>" +
        "<p>" + (got ? esc(c.body) : "") + "</p>" + (links.length ? '<div class="links">연결: ' + links.map(esc).join(" · ") + "</div>" : "") +
        (kp ? '<button class="chip" data-clue="' + c.id + '">' + (got ? "숨기기" : "공개") + "</button>" : "") + "</article>";
    }).join("") + "</div>";
    body.querySelectorAll("[data-clue]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.clue;
      if (s.clues[id]) { s.clues[id] = false; addLog("system", "SYSTEM", "단서 비공개 — " + clueDef(id).title); Store.commit(); } else revealClue(id, true);
      openClues();
    }));
  }

  function showHandout(id) {
    const s = st(), h = SC.handouts.find((x) => x.id === id);
    if (!h) return;
    s.shownHandout = id;
    addLog("clue", "HANDOUT", "핸드아웃 — " + h.title);
    if (h.clue) revealClue(h.clue, true);
    Store.commit();
  }

  function openInventory() {
    const s = st(), id = s.activePc, c = s.chars[id];
    const body = openModal(charDef(id).name + " — 소지품", "", { wide: true });
    body.innerHTML = '<div class="cards">' + (c.items.map((it, i) =>
      '<article class="card item"><h4>' + esc(it.name) + "</h4><p>" + esc(it.desc) + '</p><div class="row"><button class="chip" data-use="' + i + '">사용</button><button class="chip" data-del="' + i + '">삭제</button></div></article>').join("") || '<p class="muted">비어 있어</p>') + "</div>" +
      '<form class="row" id="it-add"><input id="it-name" placeholder="이름" maxlength="30"><input id="it-desc" class="grow" placeholder="설명" maxlength="200"><button class="btn" type="submit">추가</button></form>';
    body.querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => {
      const it = c.items[b.dataset.use];
      addLog("rp", charDef(id).name, charDef(id).name + "이(가) '" + it.name + "'을(를) 사용한다.");
      Store.commit(); toast(it.name + " 사용");
    }));
    body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { c.items.splice(b.dataset.del, 1); Store.commit(); openInventory(); }));
    $("#it-add", body).onsubmit = (e) => {
      e.preventDefault();
      const n = $("#it-name", body).value.trim();
      if (!n) return;
      c.items.push({ id: "i-" + Date.now(), name: n, desc: $("#it-desc", body).value.trim() });
      addLog("clue", "ITEM", charDef(id).name + " 획득 — " + n);
      Store.commit(); openInventory();
    };
  }

  function openNotes() {
    const s = st();
    const body = openModal("노트", '<textarea id="notes" class="notes" placeholder="세션 메모 (저장에 포함돼)"></textarea>', { onClose: () => Store.commit() });
    const t = $("#notes", body);
    t.value = s.notes;
    t.oninput = () => { s.notes = t.value; };
  }

  // ---------- KP 패널 ----------
  function openKeeper() {
    const s = st(), sc = sceneDef(s.sceneId);
    const body = openModal("KP", "", { wide: true });
    const chars = SC.chars.filter((c) => c.role !== "NPC");
    body.innerHTML =
      '<section><h3>이 장면의 KP 메모</h3><p class="keeper-note">' + esc(sc.keeper || "메모 없음") + "</p></section>" +
      '<section><h3>장면 전환</h3><div class="row"><select id="kp-trans">' + Object.entries(FX.TRANSITIONS).map(([k, l]) => '<option value="' + k + '">' + l + "</option>").join("") + "</select></div>" +
      '<div class="seg">' + SC.scenes.map((x, i) => '<button class="chip' + (x.id === s.sceneId ? " on" : "") + '" data-scene="' + x.id + '">' + pad(i + 1) + " " + esc(x.title) + "</button>").join("") + "</div></section>" +
      '<section><h3>효과</h3><div class="seg">' + Object.entries(FX.EFFECTS).map(([k, l]) => '<button class="chip' + (s.effects.includes(k) ? " on" : "") + '" data-fx="' + k + '">' + l + "</button>").join("") + "</div></section>" +
      '<section><h3>핸드아웃</h3><div class="seg">' + SC.handouts.map((h) => '<button class="chip" data-handout="' + h.id + '">' + esc(h.kind) + " · " + esc(h.title) + "</button>").join("") + "</div></section>" +
      '<section><h3>연출 / 대사</h3><div class="row"><select id="kp-spk">' + SC.chars.map((c) => '<option value="' + c.id + '">' + esc(c.name) + "</option>").join("") + "</select>" +
      '<select id="kp-expr">' + Object.entries(EXPRS).map(([k, l]) => '<option value="' + k + '">' + l + "</option>").join("") + '</select><button class="chip" id="kp-setexpr">표정 변경</button></div></section>' +
      '<section><h3>비밀 판정</h3><div class="row"><select id="kp-who">' + chars.map((c) => '<option value="' + c.id + '">' + esc(c.name) + "</option>").join("") + '</select><input id="kp-skill" list="kp-skills" placeholder="기능치" value="듣기"><datalist id="kp-skills">' +
      CoC.SKILLS.map((x) => '<option value="' + esc(x.name) + '">').join("") + '</datalist><button class="btn" id="kp-secret">비밀 판정</button></div></section>' +
      '<section><h3>SAN / 상태 조정</h3><div class="party">' + chars.map((c) => {
        const x = s.chars[c.id];
        return '<div class="party-row"><b>' + esc(c.name) + "</b>" + ["hp", "mp", "san", "luck"].map((k) =>
          '<span>' + k.toUpperCase() + ' <button class="chip" data-adj="' + c.id + ":" + k + ':-1">−</button>' + x[k] + '<button class="chip" data-adj="' + c.id + ":" + k + ':1">+</button></span>').join("") + "</div>";
      }).join("") + '</div><div class="row"><button class="btn" id="kp-san">SAN 판정 열기</button></div></section>' +
      ((sc.sfx && sc.sfx.length) ? '<section><h3>효과음</h3><div class="seg">' + sc.sfx.map((f, i) => '<button class="chip" data-sfx="' + i + '">' + esc(f.label) + "</button>").join("") + "</div></section>" : "") +
      '<section><h3>세션</h3><div class="row"><button class="btn" id="kp-end">세션 종료</button></div></section>';

    body.querySelectorAll("[data-scene]").forEach((b) => (b.onclick = () => { goScene(b.dataset.scene, $("#kp-trans", body).value); closeModal(); }));
    body.querySelectorAll("[data-fx]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.fx, i = s.effects.indexOf(k);
      if (i >= 0) s.effects.splice(i, 1); else s.effects.push(k);
      b.classList.toggle("on"); Store.commit();
    }));
    body.querySelectorAll("[data-handout]").forEach((b) => (b.onclick = () => { showHandout(b.dataset.handout); closeModal(); }));
    body.querySelectorAll("[data-adj]").forEach((b) => (b.onclick = () => { const [cid, k, d] = b.dataset.adj.split(":"); adjust(cid, k, parseInt(d, 10)); openKeeper(); }));
    body.querySelectorAll("[data-sfx]").forEach((b) => (b.onclick = () => FX.sfx(sc.sfx[b.dataset.sfx].src)));
    $("#kp-setexpr", body).onclick = () => { s.expr[$("#kp-spk", body).value] = $("#kp-expr", body).value; Store.commit(); toast("표정 변경"); };
    $("#kp-secret", body).onclick = () => {
      const cid = $("#kp-who", body).value, n = $("#kp-skill", body).value.trim();
      if (!n) return;
      rollSkill(cid, n, { secret: true, back: openKeeper });
    };
    $("#kp-san", body).onclick = () => openSan();
    $("#kp-end", body).onclick = () => endSession();
  }

  // ---------- 저장 / 설정 / 종료 ----------
  function openSaves() {
    const inGame = st() && st().phase === "play";
    const body = openModal("저장 / 불러오기", "", {});
    const rows = Store.slots();
    body.innerHTML = '<div class="slots">' + rows.map((r) => {
      const m = r.meta, label = r.slot === "auto" ? "자동 저장" : "슬롯 " + r.slot;
      return '<div class="slot"><div><b>' + label + "</b>" + (m ? '<p class="muted">' + new Date(m.savedAt).toLocaleString("ko-KR") + "<br>" + esc(m.scene) + " · HP " + m.hp + " · SAN " + m.san + " · LUCK " + m.luck + " · 단서 " + m.clues + "</p>" : '<p class="muted">비어 있음</p>') + "</div>" +
        '<div class="row">' + (inGame && r.slot !== "auto" ? '<button class="chip" data-save="' + r.slot + '">저장</button>' : "") + (m ? '<button class="chip" data-load="' + r.slot + '">불러오기</button>' : "") + "</div></div>";
    }).join("") + "</div>" +
      '<div class="row">' + (inGame ? '<button class="btn" id="sv-export">JSON 내보내기</button><button class="btn" id="sv-log">로그 텍스트 내보내기</button>' : "") + '<button class="btn" id="sv-import">JSON 불러오기</button></div>';
    body.querySelectorAll("[data-save]").forEach((b) => (b.onclick = () => { toast(Store.save(b.dataset.save) ? "저장했어" : "저장 실패 (브라우저 저장 공간을 확인해줘)"); openSaves(); }));
    body.querySelectorAll("[data-load]").forEach((b) => (b.onclick = () => {
      if (Store.load(b.dataset.load)) { renderedScene = null; renderedLine = null; closeModal(); toast("불러왔어"); } else toast("불러오기 실패");
    }));
    const ex = $("#sv-export", body);
    if (ex) ex.onclick = () => download(SC.id + "_save.json", Store.exportJson(), "application/json");
    const lg = $("#sv-log", body);
    if (lg) lg.onclick = exportLog;
    $("#sv-import", body).onclick = () => $("#import-file").click();
  }

  function exportLog() {
    const s = st();
    const lines = s.log.filter((e) => e.type !== "secret").map((e) => "[" + hhmm(e.t) + "] " + (e.who ? e.who + ": " : "") + e.text);
    download(SC.id + "_log.txt", SC.title + "\n\n" + lines.join("\n") + "\n");
  }

  function openSettings() {
    const s = st(), set = s.settings;
    const body = openModal("설정", "", {});
    body.innerHTML =
      '<label class="check"><input type="checkbox" id="st-anim"' + (set.anim ? " checked" : "") + "> 판정/전환 애니메이션</label>" +
      '<label class="check"><input type="checkbox" id="st-type"' + (set.typing ? " checked" : "") + "> 글자 타이핑 효과</label>" +
      '<label class="check"><input type="checkbox" id="st-bgm"' + (set.bgm ? " checked" : "") + "> BGM</label>" +
      '<label class="field">볼륨<input type="range" id="st-vol" min="0" max="1" step="0.05" value="' + set.volume + '"></label>' +
      '<label class="field">테마<select id="st-theme">' + [["summer", "청춘 / 여름"], ["gothic", "고딕 호러"], ["vhs", "VHS 호러"]].map(([k, l]) => '<option value="' + k + '"' + (set.theme === k ? " selected" : "") + ">" + l + "</option>").join("") + "</select></label>" +
      '<div class="row"><button class="btn" id="st-title">타이틀로</button></div>';
    const bind = (id, key, prop) => { $(id, body).onchange = $(id, body).oninput = (e) => { set[key] = e.target[prop || "checked"]; if (key === "volume") set[key] = parseFloat(set[key]); Store.commit(); }; };
    bind("#st-anim", "anim"); bind("#st-type", "typing"); bind("#st-bgm", "bgm"); bind("#st-vol", "volume", "value"); bind("#st-theme", "theme", "value");
    $("#st-title", body).onclick = () => { s.phase = "title"; Store.commit(); closeModal(); };
  }

  function endSession() {
    const s = st();
    s.ended = true;
    Store.tick();
    addLog("system", "SYSTEM", "SESSION COMPLETE");
    Store.commit();
    const x = Store.stats();
    const body = openModal("세션 종료", "", {});
    body.innerHTML = '<h3 class="center">' + esc(SC.title) + "</h3>" +
      '<div class="stats">' + [["플레이 시간", hms(x.playMs)], ["판정", x.rolls], ["대성공", x.critical], ["대실패", x.fumble], ["SAN 손실", x.sanLoss], ["단서", x.clues + " / " + SC.clues.length]].map(([k, v]) => "<div><small>" + k + "</small><b>" + v + "</b></div>").join("") + "</div>" +
      '<div class="row end"><button class="btn" id="en-log">로그 내보내기</button><button class="btn" id="en-save">세이브 내보내기</button><button class="btn primary" id="en-back">계속 플레이</button></div>';
    $("#en-log", body).onclick = exportLog;
    $("#en-save", body).onclick = () => download(SC.id + "_save.json", Store.exportJson(), "application/json");
    $("#en-back", body).onclick = () => { s.ended = false; s.lastTick = Date.now(); Store.commit(); closeModal(); };
  }

  // ---------- 이미지 교체 (편집 모드) ----------
  function slotList() {
    const out = [{ key: "title", label: "타이틀 배경", group: "타이틀" }];
    SC.scenes.forEach((sc) => out.push({ key: "bg:" + sc.id, label: sc.title, group: "장면 배경" }));
    SC.chars.forEach((c) => {
      out.push({ key: "portrait:" + c.id, label: c.name + " · 프로필", group: "캐릭터" });
      Object.entries(EXPRS).forEach(([ex, l]) => out.push({ key: "sprite:" + c.id + ":" + ex, label: c.name + " · 스탠딩 " + l, group: "캐릭터" }));
    });
    SC.handouts.forEach((h) => out.push({ key: "handout:" + h.id, label: h.title, group: "핸드아웃" }));
    return out;
  }

  function slotLabel(key) { const x = slotList().find((v) => v.key === key); return x ? x.group + " — " + x.label : key; }

  function afterAssetChange() {
    renderedScene = null; // 배경을 전환 효과 없이 다시 적용
    render();
    if (!$("#modal").hidden && $("#asset-grid")) openAssets(true);
  }

  async function setSlot(key, blob) {
    try {
      if (typeof blob === "string") {
        const r = await Assets.fromUrl(blob, key);
        Assets.put(key, r.value);
        if (r.linked) toast("주소 그대로 연결했어. 원본이 사라지면 같이 깨져", 4200);
      } else Assets.put(key, await Assets.fromBlob(blob, key));
      if (!Assets.persistent) toast("이 브라우저는 이미지를 저장하지 못해서 새로고침하면 사라져", 4200);
      else toast("교체했어 — " + slotLabel(key));
      afterAssetChange();
    } catch (e) { toast(e.message || "이미지를 읽지 못했어"); }
  }

  function pickImage(key) {
    activeKey = key;
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => { if (inp.files[0]) setSlot(key, inp.files[0]); };
    inp.click();
  }

  function openAssets(keepScroll) {
    const card = $(".modal-card");
    const top = keepScroll === true && card ? card.scrollTop : 0;
    const body = openModal("이미지 관리", "", { wide: true });
    const groups = {};
    slotList().forEach((x) => (groups[x.group] = groups[x.group] || []).push(x));
    body.innerHTML = '<div id="asset-grid"><p class="muted">칸을 눌러 고르거나, 이미지를 끌어다 놓거나, 칸을 누른 뒤 Ctrl+V 로 붙여넣어. 비워두면 기본 그림이 나와.</p>' +
      Object.entries(groups).map(([g, list]) => "<h3>" + esc(g) + '</h3><div class="asset-cards">' + list.map((x) => {
        const v = Assets.get(x.key);
        return '<div class="asset' + (activeKey === x.key ? " sel" : "") + '" data-key="' + x.key + '"><div class="thumb" data-act="pick" data-key="' + x.key + '">' +
          (v ? '<img src="' + esc(v) + '" alt="">' : "<span>비어 있음</span>") + "</div><b>" + esc(x.label) + "</b>" +
          (v ? '<button class="chip sm" data-asset-del="' + x.key + '">지우기</button>' : "") + "</div>";
      }).join("") + "</div>").join("") +
      '<h3>백업</h3><div class="row"><button class="btn" id="as-export">이미지 내보내기</button><button class="btn" id="as-import">이미지 불러오기</button></div>' +
      (Assets.persistent ? "" : '<p class="warn">이 브라우저에서는 이미지 저장소를 못 써. 새로고침하면 교체한 이미지가 사라져.</p>') + "</div>";
    body.querySelectorAll("[data-asset-del]").forEach((b) => (b.onclick = () => { Assets.del(b.dataset.assetDel); afterAssetChange(); if ($("#asset-grid")) openAssets(true); }));
    body.querySelectorAll(".asset").forEach((el) => {
      el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop"); });
      el.addEventListener("dragleave", () => el.classList.remove("drop"));
      el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("drop"); dropOn(el.dataset.key, e); });
    });
    $("#as-export", body).onclick = () => download(SC.id + "_images.json", Assets.exportAll(), "application/json");
    $("#as-import", body).onclick = () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "application/json,.json";
      inp.onchange = () => inp.files[0] && inp.files[0].text().then((t) => { const err = Assets.importAll(t); if (err) toast(err); else { toast("불러왔어"); afterAssetChange(); } });
      inp.click();
    };
    if (top) $(".modal-card").scrollTop = top;
  }

  function dropOn(key, e) {
    activeKey = key;
    const f = [...(e.dataTransfer.files || [])].find((x) => /^image\//.test(x.type));
    if (f) return setSlot(key, f);
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (/^https?:\/\//i.test(url || "")) setSlot(key, url.split("\n")[0]);
  }

  document.addEventListener("paste", (e) => {
    if (!activeKey || !(editing || !$("#modal").hidden) || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => /^image\//.test(x.type));
    if (f) { e.preventDefault(); setSlot(activeKey, f); }
  });
  $("#stage").addEventListener("dragover", (e) => { if (editing) e.preventDefault(); });
  $("#stage").addEventListener("drop", (e) => { if (editing) { e.preventDefault(); dropOn("bg:" + st().sceneId, e); } });

  // ---------- 렌더링 ----------
  function renderTitle() {
    $("#t-sys").textContent = SC.system;
    $("#t-title").textContent = SC.title;
    $("#t-copy").innerHTML = SC.copy.map((l) => "<p>" + esc(l) + "</p>").join("");
    $("#t-sub").textContent = SC.subtitle + " · " + SC.date;
    $("#t-cast").textContent = SC.chars.filter((c) => c.role !== "NPC").map((c) => c.role + " " + c.name).join("   ");
    const tb = Assets.get("title");
    $(".title-bg").style.background = tb ? FX.bgCss(tb) : SC.titleBg || "";
    $("#btn-continue").hidden = !Store.slots()[0].meta;
  }

  function renderTop() {
    const s = st(), sc = sceneDef(s.sceneId);
    $("#tb-title").textContent = SC.title;
    $("#tb-scene").textContent = "SCENE " + pad(SC.scenes.indexOf(sc) + 1) + " · " + sc.place + " · " + sc.time;
    $("#mode-pc").classList.toggle("on", !isKP());
    $("#mode-kp").classList.toggle("on", isKP());
    $("#btn-edit").classList.toggle("on", editing);
    $("#app").classList.toggle("editing", editing);
    $("#edit-bar").hidden = !editing;
    $("#edit-bg").dataset.key = "bg:" + s.sceneId;
  }

  function stat(label, key, c, max) {
    const pct = max ? Math.max(0, Math.min(100, (c[key] / max) * 100)) : 0;
    return '<div class="stat stat-' + key + '"><div class="stat-top"><span>' + label + "</span><b>" + c[key] + (key === "luck" ? "" : "<small>/" + max + "</small>") + "</b>" +
      '<span class="adj"><button class="mini" data-act="adj" data-k="' + key + '" data-d="-1" aria-label="' + label + ' 감소">−</button><button class="mini" data-act="adj" data-k="' + key + '" data-d="1" aria-label="' + label + ' 증가">+</button></span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  function renderLeft() {
    const s = st(), id = s.activePc, c = s.chars[id], cd = charDef(id);
    const learned = Object.entries(c.skills).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const pcs = SC.chars.filter((x) => x.role !== "NPC");
    const shown = statusOpen ? STATUSES.concat(c.statuses.filter((x) => !STATUSES.includes(x))) : c.statuses;
    $("#left").innerHTML =
      (pcs.length > 1 ? '<div class="pc-tabs">' + pcs.map((x) => '<button class="' + (x.id === id ? "on" : "") + '" data-act="pc" data-id="' + x.id + '">' + esc(x.name) + "</button>").join("") + "</div>" : "") +
      '<div class="pc-head"><div class="portrait' + (editing ? " editable" : "") + '" style="--c:' + cd.color + '"' + (editing ? ' data-act="pick" data-key="portrait:' + id + '" title="프로필 이미지 교체"' : "") + ">" +
        (portraitFor(cd) ? '<img src="' + esc(portraitFor(cd)) + '" alt="">' : "<span>" + esc(cd.name[0]) + "</span>") + "</div>" +
        "<div><h2>" + esc(cd.name) + '</h2><p class="muted">' + esc(cd.role) + " · " + esc(cd.job) + "</p></div></div>" +
      '<div class="stats-list">' + stat("HP", "hp", c, c.hpMax) + stat("MP", "mp", c, c.mpMax) + stat("SAN", "san", c, c.sanMax) + stat("LUCK", "luck", c, 99) + "</div>" +
      '<div class="sec-head"><h3>상태</h3><button class="link" data-act="status-open">' + (statusOpen ? "완료" : "편집") + "</button></div>" +
      '<div class="statuses">' + (shown.length ? shown.map((x) => '<button class="chip sm' + (c.statuses.includes(x) ? " on" : "") + '" data-act="status" data-s="' + esc(x) + '">' + esc(x) + "</button>").join("") : '<span class="muted">이상 없음</span>') + "</div>" +
      '<div class="sec-head"><h3>기능치</h3><button class="link" data-act="sheet">전체 시트</button></div>' +
      '<div class="quick">' + learned.map(([n, v]) => '<button data-act="roll" data-n="' + esc(n) + '"><span>' + esc(n) + "</span><b>" + v + "</b></button>").join("") + "</div>";
  }

  function renderStage() {
    const s = st(), sc = sceneDef(s.sceneId), stage = $("#stage");
    if (renderedScene !== sc.id) {
      FX.changeScene(stage, Object.assign({}, sc, { bg: bgFor(sc) }), pendingTransition, s.settings.anim && renderedScene !== null);
      const src = (SC.bgm || {})[sc.id] || sc.bgm || "";
      FX.bgm.play(src);
      renderedScene = sc.id;
      pendingTransition = null;
    }
    FX.renderEffects($("#fx-layer"), s.effects);
    const tb = $("#textbox");
    tb.hidden = !s.line;
    $("#tb-speaker").textContent = s.speaker || "";
    $("#tb-speaker").hidden = !s.speaker;
    if (renderedLine !== s.line + "|" + s.speaker) {
      FX.type($("#tb-line"), s.line || "", s.settings.typing && s.settings.anim);
      renderedLine = s.line + "|" + s.speaker;
    }
    const cast = (sc.cast || []);
    $("#sprites").innerHTML = cast.map((cid, i) => {
      const cd = charDef(cid), ex = s.expr[cid] || "neutral";
      const img = spriteFor(cd, ex);
      const pos = cast.length === 1 ? 50 : 22 + (56 * i) / (cast.length - 1);
      return '<div class="sprite' + (s.speaker === cd.name ? " speaking" : "") + '" style="left:' + pos + "%;--c:" + cd.color + '">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(cd.name) + '">' : '<div class="silhouette"><span>' + esc(cd.name[0]) + "</span></div>") +
        '<em>' + esc(cd.name) + (ex !== "neutral" ? " · " + EXPRS[ex] : "") + "</em>" +
        (editing ? '<button class="edit-btn" data-act="pick" data-key="sprite:' + cid + ":" + ex + '">스탠딩 교체</button>' : "") + "</div>";
    }).join("");
    const hs = $("#hotspots");
    hs.classList.toggle("on", investigate);
    hs.innerHTML = investigate ? (sc.hotspots || []).map((h, i) =>
      '<button class="hotspot" style="left:' + h.x + "%;top:" + h.y + "%;width:" + h.w + "%;height:" + h.h + '%" data-act="hotspot" data-i="' + i + '"><span>' + esc(h.label) + "</span></button>").join("") : "";
    const ib = $("#btn-investigate");
    ib.hidden = !(sc.hotspots && sc.hotspots.length);
    ib.classList.toggle("on", investigate);
    const hv = $("#handout-view"), ho = SC.handouts.find((h) => h.id === s.shownHandout);
    hv.hidden = !ho;
    if (ho) hv.innerHTML = '<article class="paper"><small>' + esc(ho.kind) + "</small><h3>" + esc(ho.title) + "</h3>" +
      (handoutImg(ho) ? '<img class="paper-img" src="' + esc(handoutImg(ho)) + '" alt="">' : "") +
      (editing ? '<button class="chip" data-act="pick" data-key="handout:' + ho.id + '">이미지 교체</button> ' : "") + "<p>" + esc(ho.text).replace(/\n/g, "<br>") + '</p><button class="chip" data-act="hide-handout">닫기</button></article>';
  }

  function renderLog() {
    const s = st(), kp = isKP();
    const types = [["all", "전체"], ["rp", "대사"], ["dice", "판정"], ["system", "시스템"], ["clue", "단서"], ["ooc", "잡담"]].concat(kp ? [["secret", "비밀"]] : []);
    const key = [s.log.length, s.log.length ? s.log[s.log.length - 1].text : "", logFilter, kp].join("|");
    if (key === lastLogKey) return;
    lastLogKey = key;
    $("#filters").innerHTML = types.map(([k, l]) => '<button class="tab' + (logFilter === k ? " on" : "") + '" data-act="filter" data-f="' + k + '">' + l + "</button>").join("");
    const list = s.log.filter((e) => (kp || e.type !== "secret") && (logFilter === "all" || e.type === logFilter || (logFilter === "dice" && e.type === "secret" && kp))).slice(-300);
    const box = $("#log");
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = list.map((e) => {
      const gr = e.data && e.data.level ? " g-" + e.data.level : "";
      const who = e.type === "rp" || e.type === "ooc" ? "<b>" + esc(e.who) + "</b>" : "";
      return '<div class="entry t-' + e.type + gr + '"><div class="meta">' + who + "<time>" + hhmm(e.t) + "</time></div><p>" + esc(e.text) + "</p></div>";
    }).join("");
    if (near) box.scrollTop = box.scrollHeight;
    const who = $("#chat-who"), prev = who.value;
    who.innerHTML = SC.chars.filter((c) => kp || c.role !== "NPC").map((c) => '<option value="' + c.id + '">' + esc(c.name) + "</option>").join("") + (kp ? '<option value="@kp">KP (서술)</option>' : "");
    who.value = [...who.options].some((o) => o.value === prev) ? prev : (kp ? "@kp" : s.activePc);
  }

  function renderDock() {
    const kp = isKP();
    const items = [["sheet", "기능치"], ["dice", "주사위"], ["san", "SAN"], ["clues", "단서"], ["inventory", "소지품"], ["notes", "노트"]].concat(kp ? [["keeper", "KP"]] : []);
    const key = items.length + String(kp);
    if ($("#dock").dataset.key === key) return;
    $("#dock").dataset.key = key;
    $("#dock").innerHTML = items.map(([k, l]) => '<button class="' + (k === "keeper" ? "kp" : "") + '" data-act="' + k + '">' + l + "</button>").join("");
  }

  function render() {
    const s = st();
    const app = $("#app");
    app.dataset.theme = s.settings.theme;
    const play = s.phase === "play";
    $("#title").hidden = play;
    $("#game").hidden = !play;
    FX.bgm.setVolume(s.settings.volume, s.settings.bgm);
    if (!play) { renderTitle(); return; }
    const modeKey = s.mode + s.activePc;
    if (modeKey !== lastModeKey) { lastModeKey = modeKey; lastLogKey = ""; }
    renderTop(); renderLeft(); renderStage(); renderLog(); renderDock();
  }

  // ---------- 입력 ----------
  function hotspot(i) {
    const s = st(), sc = sceneDef(s.sceneId), h = sc.hotspots[i];
    const reveal = () => {
      say("KP", h.text);
      if (h.clue) revealClue(h.clue);
      if (h.san) openSan({ reason: h.san.reason, ok: h.san.ok, fail: h.san.fail });
    };
    if (!h.check) { reveal(); return; }
    rollSkill(s.activePc, h.check, {
      onResolve: (res) => {
        if (!res) return;
        if (res.ok) reveal(); else say("KP", h.failText || "아무것도 찾지 못했다.");
      }
    });
  }

  const actions = {
    start() {
      Store.set(Store.newState(SC));
      const s = st();
      s.phase = "play"; s.lastTick = Date.now();
      renderedScene = null; renderedLine = null;
      addLog("system", "SYSTEM", "SESSION START — " + SC.title);
      addLog("rp", "KP", sceneDef(s.sceneId).text);
      FX.bgm.resume();
      Store.commit();
    },
    continue() { if (Store.load("auto")) { renderedScene = null; renderedLine = null; FX.bgm.resume(); } else toast("자동 저장이 없어"); },
    saves: openSaves, settings: openSettings, sheet() { openSheet(); }, dice: openDice, san() { openSan(); },
    clues: openClues, inventory: openInventory, notes: openNotes, keeper: openKeeper,
    "close-modal"() { closeModal(); },
    "edit-mode"() { editing = !editing; render(); toast(editing ? "편집 모드 — 점선 슬롯을 눌러 이미지를 교체해" : "편집 모드 종료"); },
    pick(t) { pickImage(t.dataset.key); },
    assets: openAssets,
    "set-mode"(t) { const s = st(); if (s.mode !== t.dataset.m) { s.mode = t.dataset.m; Store.commit(); } },
    pc(t) { st().activePc = t.dataset.id; Store.commit(); },
    "status-open"() { statusOpen = !statusOpen; renderLeft(); },
    panel(t) { $("#layout").classList.toggle("hide-" + t.dataset.side); },
    investigate() { investigate = !investigate; render(); },
    "skip-type"() { FX.skipType(); },
    hotspot(t) { hotspot(parseInt(t.dataset.i, 10)); },
    "hide-handout"() { st().shownHandout = null; Store.commit(); },
    adj(t) { adjust(st().activePc, t.dataset.k, parseInt(t.dataset.d, 10)); },
    roll(t) { rollSkill(st().activePc, t.dataset.n); },
    filter(t) { logFilter = t.dataset.f; lastLogKey = ""; renderLog(); },
    status(t) {
      const c = st().chars[st().activePc], n = t.dataset.s, i = c.statuses.indexOf(n);
      if (i >= 0) c.statuses.splice(i, 1); else c.statuses.push(n);
      addLog("system", "SYSTEM", charDef(st().activePc).name + " 상태 " + (i >= 0 ? "해제" : "부여") + " — " + n);
      Store.commit();
    }
  };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (t && actions[t.dataset.act]) { FX.bgm.resume(); actions[t.dataset.act](t, e); return; }
    if (e.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  $("#chat").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("#chat-input"), text = inp.value.trim();
    if (!text) return;
    const s = st(), who = $("#chat-who").value;
    inp.value = "";
    const pcId = who === "@kp" ? s.activePc : who;
    const roll = /^\/(r|roll)\s+(.+)/i.exec(text);
    try {
      if (roll) { const res = rollExprFor(roll[2], pcId); toast(res.expr + " = " + res.total); }
      else if (/^\/\/|^\/ooc\s/i.test(text)) { addLog("ooc", charDef(pcId).name, text.replace(/^\/\/|^\/ooc\s+/i, "")); Store.commit(); }
      else if (who === "@kp") say("KP", text, null);
      else say(charDef(who).name, text, charDef(who).name);
    } catch (err) { toast(err.message); }
  });

  $("#import-file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      const err = Store.importJson(t);
      if (err) toast(err); else { renderedScene = null; renderedLine = null; closeModal(); toast("불러왔어"); }
    });
    e.target.value = "";
  });

  Store.subscribe(render);
  Assets.init(SC.id).then(() => { renderedScene = null; if (st()) render(); });
  setInterval(() => { Store.tick(); }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && st()) st().lastTick = Date.now(); });
  window.addEventListener("beforeunload", () => { if (st() && st().phase === "play") Store.save("auto"); });

  // 첫 화면
  Store.set(Store.newState(SC));
  window.__room = { Store, CoC, openRoll, goScene, actions }; // 디버깅/테스트용
})();
