// 시나리오 데이터. 이 파일만 바꾸면 다른 시나리오로 교체돼.
// 이미지/음원은 비워두면 CSS 그라데이션과 이니셜로 대체돼. 경로는 trpg-room/ 기준 상대 경로.
//
// scenes[].bg       CSS background 값(그라데이션) 또는 이미지 경로
// scenes[].effects  rain snow dust petals fog grain vignette flicker glitch
// scenes[].cast     화면에 서는 캐릭터 id
// scenes[].hotspots 조사 모드에서 누르는 영역 (x,y,w,h 는 % 단위)
// scenes[].keeper   KP에게만 보이는 메모
// scenes[].sfx      [{ label, src }] KP 효과음 버튼 (선택)
window.SCENARIO = {
  id: "summer-flower-melancholy",
  title: "여름, 꽃, 우울",
  subtitle: "한여름의 기록",
  copy: ["우리는 가장 눈부신 계절에,", "조금씩 가라앉고 있었다."],
  system: "Call of Cthulhu 7th",
  date: "2026-10-04",
  theme: "summer", // summer | gothic | vhs
  titleBg: "linear-gradient(180deg, #1c1b19 0%, #0e0e0e 100%)", // 편집 모드에서 이미지로 교체 가능
  bgm: { title: "" }, // 장면 id 별 음원. 예: { title: "music/title.mp3", rooftop: "music/evening.mp3" }

  chars: [
    {
      id: "kate", name: "Kate", role: "PC", age: 19, job: "대학생",
      portrait: "", sprite: "", color: "#6aa8ff",
      intro: "방학이 시작되던 날, 폐교의 소문을 듣고 돌아온 사람.",
      attrs: { str: 45, con: 60, siz: 50, dex: 65, app: 70, int: 75, pow: 65, edu: 70 },
      luck: 70,
      skills: { 관찰력: 65, 듣기: 55, 자료조사: 65, 심리학: 40, 회피: 60, "근접전(격투)": 45, 응급처치: 50, 설득: 40 },
      items: [
        { id: "i-phone", name: "낡은 휴대폰", desc: "배터리가 18% 남았다. 화면 모서리에 금이 가 있다." },
        { id: "i-photo", name: "접힌 사진", desc: "여름 교복을 입은 세 사람. 한 명의 얼굴이 지워져 있다." }
      ]
    },
    {
      id: "evan", name: "Evan", role: "KPC", age: 20, job: "학교 선배",
      portrait: "", sprite: "", color: "#f0a96b",
      intro: "항상 먼저 와서 기다리고 있는 사람.",
      attrs: { str: 55, con: 55, siz: 65, dex: 55, app: 65, int: 60, pow: 50, edu: 65 },
      luck: 50,
      skills: { 관찰력: 50, 설득: 55, 은밀행동: 45, 회피: 40 },
      items: []
    },
    {
      id: "voice", name: "???", role: "NPC", age: 0, job: "알 수 없음",
      portrait: "", sprite: "", color: "#b08cff",
      intro: "복도 끝에서 들리는 목소리.",
      attrs: { str: 40, con: 50, siz: 45, dex: 60, app: 50, int: 70, pow: 80, edu: 60 },
      luck: 0, skills: {}, items: []
    }
  ],

  scenes: [
    {
      id: "gate", title: "폐교 정문", place: "폐교 정문", time: "17:58", transition: "fade",
      bg: "radial-gradient(70% 60% at 50% 105%, #ffb36b 0%, transparent 60%), linear-gradient(180deg, #7fb2e8 0%, #d9c8b4 62%, #3b3a46 100%)",
      effects: ["petals", "grain", "vignette"], cast: ["evan"],
      text: "정문은 열려 있었다. 여름 풀이 허리까지 자라 있고, 어디선가 매미 소리가 길게 이어진다.",
      keeper: "정문을 지나면 평소의 소리가 멀어진다. 관찰력 성공 시 땅에 붉은 꽃잎이 한 줄로 이어진 것을 발견.",
      hotspots: [
        { x: 12, y: 58, w: 22, h: 30, label: "녹슨 팻말", check: "관찰력", text: "팻말의 페인트 아래로 '1998'이라는 숫자가 긁혀 있다.", failText: "닳아서 읽을 수 없다.", clue: "c-1998" },
        { x: 62, y: 70, w: 24, h: 22, label: "붉은 꽃잎", text: "꽃잎이 건물 안쪽으로 한 줄로 이어져 있다.", clue: "c-petal" }
      ]
    },
    {
      id: "corridor", title: "3층 복도", place: "폐교 3층 복도", time: "18:42", transition: "blackout",
      bg: "radial-gradient(40% 70% at 85% 40%, rgba(255,170,90,.55) 0%, transparent 70%), linear-gradient(90deg, #14161f 0%, #2a2430 55%, #4a3340 100%)",
      effects: ["dust", "flicker", "grain", "vignette"], cast: ["evan"],
      text: "복도 끝 창으로 노을이 비스듬히 들어온다. 교실 문 하나만 이상할 정도로 깨끗하다.",
      keeper: "3학년 2반 문은 안쪽에서 잠겨 있다. 열쇠공 또는 STR 판정(어려움). 문 너머에서 목소리 '???'가 들린다.",
      hotspots: [
        { x: 55, y: 28, w: 18, h: 52, label: "3학년 2반 문", check: "듣기", text: "문 너머에서 누군가 낮게 이름을 부른다. 당신의 이름이다.", failText: "바람 소리뿐이다.", clue: "c-voice", san: { ok: "0", fail: "1d3", reason: "문 너머의 목소리" } },
        { x: 8, y: 40, w: 16, h: 40, label: "게시판", text: "색이 바랜 종이 한 장이 압정으로 붙어 있다. 실종자 명단이다.", clue: "c-missing" }
      ]
    },
    {
      id: "rooftop", title: "옥상", place: "폐교 옥상", time: "19:05", transition: "whiteflash",
      bg: "radial-gradient(90% 55% at 50% 100%, #ff7e5f 0%, #feb47b 25%, transparent 70%), linear-gradient(180deg, #2b2f6b 0%, #a15a7e 60%, #f3a27a 100%)",
      effects: ["petals", "grain", "vignette"], cast: ["kate", "evan"],
      text: "붉은 노을이 운동장 끝으로 가라앉는다. 난간 위에 꽃 한 송이가 놓여 있다.",
      keeper: "엔딩 분기. 꽃을 가져가면 SAN 판정(1/1d6). 두고 가면 Evan의 마지막 대사.",
      hotspots: [
        { x: 40, y: 62, w: 20, h: 22, label: "난간 위의 꽃", check: "관찰력", text: "꽃잎에는 아직 물기가 남아 있다. 방금 누군가 놓아둔 것처럼.", failText: "그냥 시든 꽃으로 보인다.", clue: "c-flower", san: { ok: "0", fail: "1d6", reason: "붉은 꽃" } }
      ]
    }
  ],

  clues: [
    { id: "c-1998", title: "1998이라는 숫자", body: "정문 팻말에 긁힌 연도. 폐교 연도와 맞지 않는다.", links: ["c-missing"] },
    { id: "c-petal", title: "붉은 꽃", body: "건물 안쪽으로 이어진 붉은 꽃잎.", links: ["c-flower"] },
    { id: "c-voice", title: "문 너머의 목소리", body: "누군가 Kate의 이름을 알고 있다.", links: [] },
    { id: "c-missing", title: "실종자 기록", body: "1998년 여름 실종된 세 명. 이름 하나는 지워져 있다.", links: ["c-1998"] },
    { id: "c-flower", title: "난간 위의 꽃", body: "아직 마르지 않은 붉은 꽃.", links: ["c-petal"] }
  ],

  handouts: [
    { id: "h-news", title: "1998년 신문 기사", kind: "신문", text: "[지역] 여름방학 중 학생 세 명 실종\n\n지난 7월 말, 한 사립 고교 학생 세 명이 방학 보충수업을 마친 뒤 귀가하지 않았다. 경찰은 학교 옥상에서 신발 한 켤레를 발견했으나…", clue: "c-missing" },
    { id: "h-letter", title: "찢어진 편지", kind: "편지", text: "…그러니까 돌아오지 마.\n네가 오면 우리는 다시 여름에 갇혀 버릴 거야.\n그래도 와 준다면,\n\n옥상에서 기다릴게.", clue: null }
  ]
};
