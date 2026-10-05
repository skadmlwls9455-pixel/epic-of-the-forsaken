# 이미지 넣는 곳

`bastard-v5.html`과 같은 폴더의 `assets/`에 이미지를 두고, 코드에서 파일 이름만 적으면 된다. 이미지가 없거나 못 불러오면 기본 선 아이콘(물건) 또는 첫 글자(인물)가 대신 보인다.

## 물건·유물 — `const ART`의 `img`
정사각형, 128×128 이상 권장 (PNG/WebP, 배경 투명 또는 어두운 톤).

| id | 이름 |
|---|---|
| ring | 에드릭의 반지 |
| document | 세공 장부 |
| ledger | 왕실 원장 |
| legend | 룬 검 |
| sword | 검 |
| armor | 누빔 갑옷 |
| shield | 나무 방패 |
| whet | 숫돌 |
| herb | 약초 꾸러미 |
| oil | 등잔 기름 |
| manual | 검술 교본 |
| hairpin | 엘레나의 머리핀 |
| bread | 마르타의 빵 (유물) |
| lullaby | 엘레나의 자장가 (유물) |
| coin | 별 일곱 은화 (유물) |
| staff | 이온의 지팡이 (유물) |

예: `herb:{n:"약초 꾸러미", ..., img:"herb.png"}`

## 인물 초상 — `const PORTRAIT`
원형으로 잘려 보인다. 정사각형 160×160 이상 권장.
예: `"리엔":"lien.png"`
