// 화면 효과, 장면 전환, BGM. 상태는 모르고 호출받은 것만 그린다.
(function (root) {
  "use strict";

  const EFFECTS = {
    rain: "비", snow: "눈", dust: "먼지", petals: "꽃잎", fog: "안개",
    grain: "필름 그레인", vignette: "비네트", flicker: "깜박임", glitch: "글리치"
  };
  const PARTICLES = { rain: 70, snow: 50, dust: 36, petals: 26 };
  const TRANSITIONS = {
    fade: "페이드", crossfade: "크로스페이드", whiteflash: "화이트 플래시",
    blackout: "블랙아웃", glitch: "VHS 글리치", blur: "블러", dissolve: "슬로우 디졸브"
  };

  // 같은 id 로 같은 모양이 나오도록 간단한 시드 난수
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function renderEffects(layer, list) {
    const key = list.slice().sort().join(",");
    if (layer.dataset.key === key) return;
    layer.dataset.key = key;
    layer.innerHTML = "";
    list.forEach((name) => {
      const el = document.createElement("div");
      el.className = "fx fx-" + name;
      const n = PARTICLES[name];
      if (n) {
        const r = seeded(name.length * 977 + n);
        for (let i = 0; i < n; i++) {
          const p = document.createElement("i");
          p.style.left = (r() * 100).toFixed(1) + "%";
          p.style.animationDelay = (-r() * 12).toFixed(2) + "s";
          p.style.animationDuration = (name === "rain" ? 0.7 + r() * 0.6 : 7 + r() * 9).toFixed(2) + "s";
          p.style.setProperty("--s", (0.5 + r() * 1).toFixed(2));
          p.style.setProperty("--dx", ((r() - 0.5) * 160).toFixed(0) + "px");
          el.appendChild(p);
        }
      }
      layer.appendChild(el);
    });
  }

  function setBg(el, value) {
    if (!value) { el.style.background = ""; return; }
    // 이미지 경로면 cover 로, 아니면 CSS background 값 그대로
    if (/^(data:image\/|https?:\/\/|blob:)/i.test(value) || /^[\w./-]+\.(jpe?g|png|webp|gif|avif)$/i.test(value)) {
      el.style.background = "url(\"" + value + "\") center / cover no-repeat";
    } else el.style.background = value;
  }

  // 두 배경 레이어를 번갈아 쓰며 전환한다
  function changeScene(stage, scene, transition, animate, done) {
    const a = stage.querySelector(".bg-a"), b = stage.querySelector(".bg-b");
    const cur = a.classList.contains("on") ? a : b, nxt = cur === a ? b : a;
    setBg(nxt, scene.bg);
    const overlay = stage.querySelector(".transition");
    const swap = () => { nxt.classList.add("on"); cur.classList.remove("on"); if (done) done(); };
    if (!animate) { stage.style.setProperty("--dur", "0s"); swap(); return; }

    const t = transition || "fade";
    overlay.className = "transition";
    void overlay.offsetWidth; // 애니메이션 재시작
    if (t === "crossfade" || t === "dissolve") {
      stage.style.setProperty("--dur", t === "dissolve" ? "2.4s" : "1.1s");
      swap();
      return;
    }
    stage.style.setProperty("--dur", "0s"); // 오버레이가 화면을 가린 사이에 바로 바꾼다
    overlay.classList.add("t-" + t);
    // 화면이 가려진 순간(약 45%)에 배경을 바꾼다
    const dur = { fade: 900, whiteflash: 900, blackout: 1300, glitch: 800, blur: 900 }[t] || 900;
    setTimeout(swap, dur * 0.45);
    setTimeout(() => { overlay.className = "transition"; }, dur + 50);
  }

  function flash(stage, kind) {
    const el = stage.querySelector(".result-flash");
    el.className = "result-flash";
    void el.offsetWidth;
    el.classList.add("f-" + kind);
  }

  // ---------- BGM ----------
  const bgm = {
    el: null, src: "", vol: 0.6, timer: null, enabled: true,
    play(src) {
      if (!this.el) { this.el = new Audio(); this.el.loop = true; }
      if (src === this.src) return;
      this.src = src;
      this.fade(0, () => {
        if (!src) { this.el.pause(); return; }
        this.el.src = src;
        this.el.play().then(() => this.fade(this.enabled ? this.vol : 0)).catch(() => { /* 자동재생 차단: 사용자 입력 이후 다시 시도 */ });
      });
    },
    fade(to, cb) {
      if (!this.el) return;
      clearInterval(this.timer);
      const step = (to - this.el.volume) / 15;
      let n = 0;
      this.timer = setInterval(() => {
        n++;
        this.el.volume = Math.max(0, Math.min(1, this.el.volume + step));
        if (n >= 15) { clearInterval(this.timer); this.el.volume = Math.max(0, Math.min(1, to)); if (cb) cb(); }
      }, 40);
    },
    setVolume(v, enabled) {
      this.vol = v; this.enabled = enabled;
      if (this.el && this.src) { clearInterval(this.timer); this.el.volume = enabled ? v : 0; }
    },
    resume() { if (this.el && this.src && this.el.paused) this.el.play().catch(() => {}); }
  };

  function sfx(src, vol) {
    if (!src) return;
    const a = new Audio(src);
    a.volume = vol == null ? 0.8 : vol;
    a.play().catch(() => {});
  }

  // 타이핑 효과. skip() 으로 즉시 끝낸다
  let typer = null;
  function type(el, text, enabled) {
    if (typer) typer.skip();
    el.textContent = "";
    if (!enabled || text.length < 2) { el.textContent = text; return; }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(id); typer = null; }
    }, 22);
    typer = { skip() { clearInterval(id); el.textContent = text; typer = null; } };
  }
  const skipType = () => { if (typer) typer.skip(); };

  const bgCss = (v) => (/^(data:image\/|https?:\/\/|blob:)/i.test(v) || /^[\w./-]+\.(jpe?g|png|webp|gif|avif)$/i.test(v) ? 'url("' + v + '") center / cover no-repeat' : v);

  root.FX = { bgCss, EFFECTS, TRANSITIONS, renderEffects, changeScene, flash, bgm, sfx, type, skipType };
})(window);
