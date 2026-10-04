// 세션 상태와 저장. localStorage 슬롯 + JSON 내보내기/불러오기.
(function (root) {
  "use strict";

  const KEY = "trpgroom.save.";
  const SLOTS = ["auto", "1", "2", "3"];
  const VERSION = 1;

  let state = null;
  const listeners = [];
  let saveTimer = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }

  function newState(sc) {
    const chars = {};
    sc.chars.forEach((c) => {
      const d = CoC.derived(c.attrs);
      chars[c.id] = {
        hp: d.hp, mp: d.mp, san: d.san, luck: c.luck,
        hpMax: d.hp, mpMax: d.mp, sanMax: Math.min(99, d.san),
        sanStart: d.san, sanLost: 0,
        attrs: { ...c.attrs }, skills: { ...c.skills }, statuses: [], items: (c.items || []).map((i) => ({ ...i }))
      };
    });
    return {
      v: VERSION, scenarioId: sc.id, phase: "title", mode: "pc",
      sceneId: sc.scenes[0].id, activePc: (sc.chars.find((c) => c.role === "PC") || sc.chars[0]).id,
      chars, clues: {}, shownHandout: null, effects: (sc.scenes[0].effects || []).slice(),
      expr: {}, speaker: null, line: sc.scenes[0].text, notes: "", log: [],
      startedAt: Date.now(), playMs: 0, ended: false,
      settings: { anim: true, typing: true, bgm: true, volume: 0.6, theme: sc.theme || "summer" }
    };
  }

  const get = () => state;
  const set = (s) => { state = s; emit(); };
  const subscribe = (fn) => listeners.push(fn);
  function emit() { listeners.forEach((fn) => fn(state)); }

  // 변경을 알리고 자동 저장을 예약한다
  function commit() {
    emit();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save("auto"), 600);
  }

  function addLog(type, who, text, data) {
    state.log.push({ t: Date.now(), type, who: who || "", text, data: data || null });
    if (state.log.length > 3000) state.log.splice(0, state.log.length - 3000);
  }

  // ---------- 저장 ----------
  function summary(s, sc) {
    const sc0 = sc.scenes.find((x) => x.id === s.sceneId);
    const pc = s.chars[s.activePc];
    const found = Object.values(s.clues).filter(Boolean).length;
    return {
      savedAt: Date.now(), scene: sc0 ? sc0.title : s.sceneId, pc: s.activePc,
      hp: pc.hp, san: pc.san, luck: pc.luck, clues: found + "/" + sc.clues.length
    };
  }

  function save(slot) {
    if (!state) return false;
    state.playMs = playMs();
    state.lastTick = Date.now();
    const payload = JSON.stringify({ meta: summary(state, root.SCENARIO), state });
    return lsSet(KEY + slot, payload);
  }

  function readSlot(slot) {
    const raw = lsGet(KEY + slot);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function load(slot) {
    const d = readSlot(slot);
    if (!d || !validState(d.state)) return false;
    state = d.state;
    state.lastTick = Date.now();
    emit();
    return true;
  }

  function slots() {
    return SLOTS.map((slot) => {
      const d = readSlot(slot);
      return { slot, meta: d && d.meta ? d.meta : null };
    });
  }

  function clear(slot) { lsDel(KEY + slot); }

  function validState(s) {
    return !!(s && s.v === VERSION && s.scenarioId === root.SCENARIO.id && s.chars && Array.isArray(s.log) &&
      root.SCENARIO.scenes.some((x) => x.id === s.sceneId));
  }

  function exportJson() {
    state.playMs = playMs();
    state.lastTick = Date.now();
    return JSON.stringify({ meta: summary(state, root.SCENARIO), state }, null, 2);
  }

  function importJson(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return "JSON 형식이 아니야"; }
    const s = d && d.state ? d.state : d;
    if (!validState(s)) return "이 시나리오의 세이브가 아니거나 버전이 달라";
    state = s;
    state.lastTick = Date.now();
    emit();
    return null;
  }

  // ---------- 플레이 시간 / 통계 ----------
  function playMs() {
    if (!state) return 0;
    const base = state.playMs || 0;
    return state.lastTick && !document.hidden ? base + Math.min(Date.now() - state.lastTick, 60000) : base;
  }

  function tick() {
    if (!state || state.phase !== "play" || state.ended) return;
    const now = Date.now();
    if (!document.hidden && state.lastTick) state.playMs = (state.playMs || 0) + Math.min(now - state.lastTick, 60000);
    state.lastTick = now;
  }

  function stats() {
    const dice = state.log.filter((e) => e.type === "dice" && e.data && e.data.kind !== "secret" && e.data.level);
    const sanLoss = state.log.filter((e) => e.data && typeof e.data.sanLost === "number").reduce((a, e) => a + e.data.sanLost, 0);
    return {
      rolls: dice.length,
      critical: dice.filter((e) => e.data.level === "critical").length,
      fumble: dice.filter((e) => e.data.level === "fumble").length,
      sanLoss,
      clues: Object.values(state.clues).filter(Boolean).length,
      playMs: playMs()
    };
  }

  root.Store = {
    newState, get, set, subscribe, commit, addLog, save, load, slots, clear,
    exportJson, importJson, stats, tick, playMs, SLOTS
  };
})(window);
