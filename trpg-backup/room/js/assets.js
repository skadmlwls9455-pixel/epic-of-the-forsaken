// 편집 모드에서 교체한 이미지 저장소. IndexedDB 에 data URL 로 보관하고, 렌더링용으로 메모리에도 캐시한다.
// 키는 "bg:장면id", "sprite:캐릭터id:표정", "portrait:캐릭터id", "handout:id", "title".
(function (root) {
  "use strict";

  const DB = "trpgroom.assets", STORE = "img";
  const LIMITS = {
    bg: { max: 1920, type: "image/jpeg", q: 0.86 },
    handout: { max: 1400, type: "image/jpeg", q: 0.88 },
    sprite: { max: 1400, type: "image/webp", q: 0.9 }, // 투명 배경 유지
    portrait: { max: 512, type: "image/webp", q: 0.9 }
  };

  let ns = "", db = null;
  const cache = {};
  const api = { persistent: false };

  function openDb() {
    return new Promise((res) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => { db = r.result; res(); };
        r.onerror = () => res();
        r.onblocked = () => res();
      } catch (e) { res(); }
    });
  }

  // 같은 브라우저에서 다른 시나리오와 섞이지 않게 시나리오 id 를 접두어로 쓴다
  api.init = function (scenarioId) {
    ns = scenarioId + "/";
    return openDb().then(() => {
      api.persistent = !!db;
      if (!db) return;
      return new Promise((res) => {
        const rq = db.transaction(STORE).objectStore(STORE).openCursor();
        rq.onsuccess = (e) => {
          const c = e.target.result;
          if (!c) return res();
          if (String(c.key).startsWith(ns)) cache[c.key.slice(ns.length)] = c.value;
          c.continue();
        };
        rq.onerror = () => res();
      });
    });
  };

  api.get = (key) => cache[key] || "";
  api.keys = () => Object.keys(cache);

  function write(fn) {
    if (!db) return;
    try { fn(db.transaction(STORE, "readwrite").objectStore(STORE)); } catch (e) { /* 메모리에는 남아 있음 */ }
  }
  api.put = (key, value) => { cache[key] = value; write((s) => s.put(value, ns + key)); };
  api.del = (key) => { delete cache[key]; write((s) => s.delete(ns + key)); };

  function kindOf(key) {
    const p = key.split(":")[0];
    return LIMITS[p] ? p : "bg";
  }

  // 파일/클립보드 이미지를 줄여서 data URL 로 만든다
  api.fromBlob = async function (blob, key) {
    if (!blob || !/^image\//.test(blob.type)) throw new Error("이미지 파일이 아니야");
    const lim = LIMITS[kindOf(key)];
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, lim.max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d");
    if (lim.type === "image/jpeg") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return c.toDataURL(lim.type, lim.q);
  };

  // 주소로 넣기. CORS 로 읽을 수 없으면 주소 그대로 저장한다 (원본이 사라지면 같이 깨져)
  api.fromUrl = async function (url, key) {
    url = String(url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("http(s) 주소만 쓸 수 있어");
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch");
      return { value: await api.fromBlob(await r.blob(), key), linked: false };
    } catch (e) {
      return { value: url, linked: true };
    }
  };

  api.exportAll = () => JSON.stringify({ v: 1, scenarioId: ns.slice(0, -1), assets: cache });
  api.importAll = function (text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return "JSON 형식이 아니야"; }
    if (!d || !d.assets || typeof d.assets !== "object") return "에셋 파일이 아니야";
    if (d.scenarioId && d.scenarioId !== ns.slice(0, -1)) return "다른 시나리오의 에셋이야";
    let n = 0;
    Object.entries(d.assets).forEach(([k, v]) => { if (typeof v === "string" && /^(data:image\/|https?:\/\/)/.test(v)) { api.put(k, v); n++; } });
    return n ? null : "가져올 이미지가 없어";
  };

  root.Assets = api;
})(window);
