// node trpg-room/tests/coc.test.js
const assert = require("assert");
const C = require("../js/coc.js");

// grade
assert.equal(C.grade(1, 65), "critical");
assert.equal(C.grade(13, 65), "extreme");
assert.equal(C.grade(32, 65), "hard");
assert.equal(C.grade(65, 65), "success");
assert.equal(C.grade(66, 65), "fail");
assert.equal(C.grade(96, 49), "fumble");   // 기능치 50 미만: 96 이상
assert.equal(C.grade(96, 50), "fail");     // 50 이상: 100만
assert.equal(C.grade(100, 90), "fumble");
assert.equal(C.grade(1, 0), "critical");

// 십의 자리 주사위: rng 를 고정해서 확인. int(10) 호출 순서 = 일의 자리, 십의 자리들
function seq(vals) { let i = 0; return () => vals[i++] / 10 + 0.001; }
C.setRng(seq([7, 2, 6]));            // 일 7, 십 20/60
let r = C.rollD100(1);
assert.deepEqual(r.cands, [27, 67]); assert.equal(r.value, 27);
C.setRng(seq([7, 2, 6]));
r = C.rollD100(-1); assert.equal(r.value, 67);
C.setRng(seq([0, 0]));               // 00 + 0 = 100
assert.equal(C.rollD100(0).value, 100);
C.setRng(seq([0, 0, 5]));            // 보너스: 100 vs 50 -> 50
assert.equal(C.rollD100(1).value, 50);
C.setRng(seq([0, 0, 5]));            // 페널티: 100 vs 50 -> 100
assert.equal(C.rollD100(-1).value, 100);

// 난이도: 기능치 60, 어려움 요구. 굴림 40 은 일반 성공이지만 난이도 미달
C.setRng(seq([0, 4]));
let c = C.check(60, { difficulty: "hard" });
assert.equal(c.value, 40); assert.equal(c.target, 30); assert.equal(c.ok, false); assert.equal(c.level, "fail");
C.setRng(seq([5, 2]));
c = C.check(60, { difficulty: "hard" });
assert.equal(c.value, 25); assert.equal(c.ok, true); assert.equal(c.level, "hard");

// 행운
assert.equal(C.luckNeeded(68, 60, 52), 8);
assert.equal(C.luckNeeded(68, 60, 5), null);
assert.equal(C.luckNeeded(50, 60, 52), null);

// 식
C.setRng(null);
assert.equal(C.parseExpr("2d6+3").length, 2);
assert.equal(C.parseExpr("d%")[0].sides, 100);
assert.throws(() => C.parseExpr("2d6++3"));
assert.throws(() => C.parseExpr("abc"));
assert.throws(() => C.parseExpr("1000d6"));
assert.equal(C.maxExpr("2d6+3"), 15);
assert.equal(C.maxExpr("1d4+db", "-1d6"), 4 - 6);
assert.equal(C.maxExpr("1d4+db", "-2"), 2);
assert.equal(C.maxExpr("1d4-db", "-2"), 6);
for (let i = 0; i < 500; i++) {
  const t = C.rollExpr("2d6+3").total; assert.ok(t >= 5 && t <= 15);
}

// DB / 체격
assert.deepEqual(C.damageBonus(40, 20), { db: "-2", build: -2 });
assert.deepEqual(C.damageBonus(50, 50), { db: "0", build: 0 });
assert.deepEqual(C.damageBonus(70, 70), { db: "1d4", build: 1 });
assert.deepEqual(C.damageBonus(100, 100), { db: "1d6", build: 2 });
assert.deepEqual(C.damageBonus(120, 100), { db: "2d6", build: 3 });
const d = C.derived({ str: 50, con: 60, siz: 55, dex: 70, app: 60, int: 70, pow: 65, edu: 75 });
assert.equal(d.hp, 11); assert.equal(d.mp, 13); assert.equal(d.san, 65); assert.equal(d.mov, 8);

// SAN: 성공은 성공식, 대실패는 실패식 최대
C.setRng(seq([0, 5]));               // 굴림 50 vs SAN 60 -> 성공
let s = C.sanCheck(60, "0", "1d6");
assert.equal(s.check.ok, true); assert.equal(s.lost, 0); assert.equal(s.after, 60);
C.setRng(seq([0, 9, 5]));            // 굴림 90 vs SAN 40 -> 실패, 1d6 -> 4
s = C.sanCheck(40, "0", "1d6");
assert.equal(s.check.level, "fail"); assert.equal(s.lost, 4); assert.equal(s.after, 36);
C.setRng(seq([0, 9, 0]));
s = C.sanCheck(20, "0", "1d6");      // 90 vs 20 -> 96 미만이라 일반 실패
assert.equal(s.check.level, "fail");
C.setRng(seq([8, 9]));               // 98 vs 20 -> 대실패
s = C.sanCheck(20, "0", "1d6");
assert.equal(s.check.level, "fumble"); assert.equal(s.lost, 6); assert.equal(s.after, 14);

// 광기 경고
assert.equal(C.madnessFlags(65, 60, 5, 5).some((f) => f.kind === "temporary"), true);
assert.equal(C.madnessFlags(65, 52, 13, 3).some((f) => f.kind === "indefinite"), true);
assert.equal(C.madnessFlags(65, 60, 4, 4).length, 0);
assert.equal(C.madnessFlags(65, 0, 65, 4)[0].kind, "permanent");

// 기본값
const dodge = C.SKILLS.find((x) => x.name === "회피");
assert.equal(C.baseValue(dodge, { dex: 71 }), 35);

console.log("coc.test.js ok");
