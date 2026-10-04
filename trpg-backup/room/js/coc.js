// CoC 7판 룰 엔진. DOM에 의존하지 않아서 node 로 테스트할 수 있어 (tests/coc.test.js).
(function (root) {
  "use strict";

  let rng = Math.random;
  const setRng = (f) => { rng = f || Math.random; };
  const int = (n) => Math.floor(rng() * n); // 0..n-1
  const die = (sides) => int(sides) + 1;

  // ---------- D100 (보너스/페널티) ----------
  // mod > 0: 보너스 주사위 개수, mod < 0: 페널티 주사위 개수.
  // 일의 자리는 하나, 십의 자리 주사위만 늘어난다. 00 + 0 = 100.
  function rollD100(mod) {
    mod = Math.max(-2, Math.min(2, mod | 0));
    const units = int(10);
    const tens = [];
    for (let i = 0; i < 1 + Math.abs(mod); i++) tens.push(int(10) * 10);
    const cands = tens.map((t) => (t + units === 0 ? 100 : t + units));
    const value = mod > 0 ? Math.min(...cands) : mod < 0 ? Math.max(...cands) : cands[0];
    return { units, tens, cands, value, mod };
  }

  // ---------- 성공 단계 ----------
  const GRADES = {
    critical: { label: "대성공", en: "CRITICAL", ok: true, rank: 5 },
    extreme: { label: "극단적 성공", en: "EXTREME SUCCESS", ok: true, rank: 4 },
    hard: { label: "어려운 성공", en: "HARD SUCCESS", ok: true, rank: 3 },
    success: { label: "성공", en: "SUCCESS", ok: true, rank: 2 },
    fail: { label: "실패", en: "FAILURE", ok: false, rank: 1 },
    fumble: { label: "대실패", en: "FUMBLE", ok: false, rank: 0 }
  };

  function grade(roll, target) {
    if (roll === 1) return "critical";
    const fumble = target < 50 ? roll >= 96 : roll === 100;
    if (fumble) return "fumble";
    if (roll <= Math.floor(target / 5)) return "extreme";
    if (roll <= Math.floor(target / 2)) return "hard";
    if (roll <= target) return "success";
    return "fail";
  }

  // 난이도에 따른 목표치. regular | hard | extreme
  function difficultyTarget(skill, difficulty) {
    if (difficulty === "hard") return Math.floor(skill / 2);
    if (difficulty === "extreme") return Math.floor(skill / 5);
    return skill;
  }

  // 판정. skill: 기능치(난이도 적용 전), mod: 보너스/페널티 개수.
  // 단계는 원래 기능치 기준으로 구하고(대실패 기준도 기능치 기준), 요구 난이도에 못 미치면 실패로 본다.
  const NEED_RANK = { regular: 2, hard: 3, extreme: 4 };
  function check(skill, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "regular";
    const target = difficultyTarget(skill, difficulty);
    const d = rollD100(opts.mod || 0);
    let level = grade(d.value, skill);
    if (level !== "fumble" && GRADES[level].rank < NEED_RANK[difficulty]) level = "fail";
    return { skill, target, difficulty, roll: d, value: d.value, level, ok: GRADES[level].ok };
  }

  // 행운 소비로 성공시키는 데 필요한 양. 불가능하면 null.
  function luckNeeded(value, target, luck) {
    const need = value - target;
    if (need <= 0 || need > luck) return null;
    return need;
  }

  // ---------- 주사위 식 ----------
  // "2d6+3", "1d10-1", "d%", "1d4+db" 등. eval 없이 직접 파싱한다.
  const MAX_DICE = 100;
  const MAX_SIDES = 1000;

  function expandDb(expr, db) {
    return expr.replace(/([+-]?)db/g, (m, sign) => {
      const d = String(db == null ? "0" : db).replace(/^\+/, "");
      const neg = d.startsWith("-");
      const body = neg ? d.slice(1) : d;
      const s = (sign === "-") !== neg ? "-" : "+";
      return s + (body || "0");
    });
  }

  function parseExpr(raw, db) {
    let s = String(raw || "").toLowerCase().replace(/\s+/g, "").replace(/^\/(r|roll)/, "");
    if (!s) throw new Error("식이 비어 있어");
    s = expandDb(s, db);
    const re = /([+-]?)(\d*d(?:\d+|%)|\d+)/y;
    const terms = [];
    let pos = 0;
    while (pos < s.length) {
      re.lastIndex = pos;
      const m = re.exec(s);
      if (!m || (terms.length && !m[1])) throw new Error("식을 읽을 수 없어: " + raw);
      pos = re.lastIndex;
      const sign = m[1] === "-" ? -1 : 1;
      const body = m[2];
      if (body.includes("d")) {
        const [c, sd] = body.split("d");
        const count = c === "" ? 1 : parseInt(c, 10);
        const sides = sd === "%" ? 100 : parseInt(sd, 10);
        if (count < 1 || count > MAX_DICE) throw new Error("주사위 개수는 1~" + MAX_DICE);
        if (sides < 2 || sides > MAX_SIDES) throw new Error("면 수는 2~" + MAX_SIDES);
        terms.push({ sign, count, sides });
      } else {
        terms.push({ sign, value: parseInt(body, 10) });
      }
    }
    return terms;
  }

  function rollExpr(raw, db) {
    const terms = parseExpr(raw, db);
    let total = 0;
    const out = terms.map((t) => {
      if (t.value != null) {
        total += t.sign * t.value;
        return { ...t };
      }
      const rolls = [];
      for (let i = 0; i < t.count; i++) rolls.push(die(t.sides));
      total += t.sign * rolls.reduce((a, b) => a + b, 0);
      return { ...t, rolls };
    });
    return { expr: String(raw).trim(), terms: out, total };
  }

  function maxExpr(raw, db) {
    return parseExpr(raw, db).reduce((sum, t) => sum + t.sign * (t.value != null ? t.value : t.count * t.sides), 0);
  }

  function formatExpr(res) {
    return res.terms
      .map((t, i) => {
        const sg = t.sign < 0 ? "-" : i ? "+" : "";
        if (t.value != null) return sg + t.value;
        return sg + "[" + t.rolls.join(",") + "]";
      })
      .join(" ");
  }

  // ---------- 파생 능력치 ----------
  function damageBonus(str, siz) {
    const t = (str | 0) + (siz | 0);
    if (t <= 64) return { db: "-2", build: -2 };
    if (t <= 84) return { db: "-1", build: -1 };
    if (t <= 124) return { db: "0", build: 0 };
    if (t <= 164) return { db: "1d4", build: 1 };
    if (t <= 204) return { db: "1d6", build: 2 };
    const extra = Math.ceil((t - 204) / 80);
    return { db: 1 + extra + "d6", build: 2 + extra };
  }

  function derived(a) {
    const mov = a.str < a.siz && a.dex < a.siz ? 7 : a.str > a.siz && a.dex > a.siz ? 9 : 8;
    const d = damageBonus(a.str, a.siz);
    return {
      hp: Math.floor((a.con + a.siz) / 10),
      mp: Math.floor(a.pow / 5),
      san: a.pow,
      mov,
      db: d.db,
      build: d.build
    };
  }

  // ---------- SAN ----------
  // 성공/실패 손실식. 대실패면 실패 손실의 최대값을 쓴다.
  function sanCheck(san, lossOk, lossFail, db) {
    const c = check(san, { mod: 0 });
    let loss;
    if (c.ok) loss = rollExpr(lossOk, db);
    else if (c.level === "fumble") {
      const m = maxExpr(lossFail, db);
      loss = { expr: lossFail, terms: [{ sign: 1, value: m }], total: m, maxed: true };
    } else loss = rollExpr(lossFail, db);
    const lost = Math.max(0, loss.total);
    return { check: c, loss, lost, after: Math.max(0, san - lost) };
  }

  // 광기 경고. startSan: 세션(또는 현재 시간) 시작 시점 SAN, totalLost: 누적 손실, singleLoss: 이번 손실
  function madnessFlags(startSan, curSan, totalLost, singleLoss) {
    const flags = [];
    if (curSan <= 0) flags.push({ kind: "permanent", text: "SAN 0 — 영구적 광기" });
    else {
      if (singleLoss >= 5) flags.push({ kind: "temporary", text: "한 번에 5 이상 손실 — INT 판정 성공 시 일시적 광기" });
      if (totalLost >= Math.max(1, Math.floor(startSan / 5))) flags.push({ kind: "indefinite", text: "누적 손실이 시작 SAN의 1/5 이상 — 부정기 광기 조건" });
    }
    return flags;
  }

  // ---------- 기본 기능치 ----------
  // base: 숫자 또는 "dex/2", "edu" 같은 능력치 참조
  const SKILLS = [
    ["감정", 5], ["고고학", 1], ["관찰력", 25], ["근접전(격투)", 25], ["기계수리", 10],
    ["길찾기", 10], ["도약", 20], ["듣기", 20], ["말재주", 5], ["매혹", 15],
    ["법률", 5], ["변장", 5], ["사격(권총)", 20], ["사격(소총/산탄총)", 25], ["생존술", 10],
    ["설득", 10], ["손놀림", 10], ["수영", 20], ["숨기", 20], ["신용평가", 0],
    ["심리학", 10], ["심리분석", 1], ["언어(모국어)", "edu"], ["역사", 5], ["열쇠공", 1],
    ["오르기", 20], ["오컬트", 5], ["운전", 20], ["위협", 15], ["응급처치", 30],
    ["의학", 1], ["은밀행동", 20], ["인류학", 1], ["자료조사", 20], ["전기수리", 10],
    ["중장비", 1], ["컴퓨터", 5], ["크툴루 신화", 0], ["투척", 20], ["회피", "dex/2"]
  ].map(([name, base]) => ({ name, base }));

  const ATTRS = [
    ["str", "STR"], ["con", "CON"], ["siz", "SIZ"], ["dex", "DEX"],
    ["app", "APP"], ["int", "INT"], ["pow", "POW"], ["edu", "EDU"]
  ];

  function baseValue(skill, attrs) {
    if (typeof skill.base === "number") return skill.base;
    const m = /^([a-z]+)(?:\/(\d+))?$/.exec(skill.base);
    const v = (attrs && attrs[m[1]]) || 0;
    return m[2] ? Math.floor(v / parseInt(m[2], 10)) : v;
  }

  const api = {
    setRng, rollD100, grade, GRADES, difficultyTarget, check, luckNeeded,
    parseExpr, rollExpr, maxExpr, formatExpr,
    damageBonus, derived, sanCheck, madnessFlags,
    SKILLS, ATTRS, baseValue
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CoC = api;
})(typeof window !== "undefined" ? window : globalThis);
