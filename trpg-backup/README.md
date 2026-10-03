# TRPG 백업

빌드 없이 파일만 올리면 되는 정적 사이트. 나루, GitHub Pages, Netlify 등 어디든 폴더째 올리면 돼.

## 구조

```
index.html          목록 페이지 (검색, 룰/태그 필터)
data/scenarios.js   목록 데이터. 로그 추가할 때 여기만 수정
logs/*.html         로그 페이지 한 개당 파일 하나
css/site.css        목록 스타일
css/log.css         로그 스타일 (롤20 챗 아카이브 마크업 대응)
tools/new-log.html  로그 페이지 + 목록 항목 생성 도구
```

## 로그 추가하는 법

### 도구 쓰는 방법 (권장)
1. `tools/new-log.html`을 브라우저로 열기
2. 정보 입력 + 롤20 챗로그 HTML 붙여넣기 → 만들기
3. 받은 html 파일을 `logs/`에 넣기
4. 표시된 항목을 `data/scenarios.js` 배열 맨 위에 붙여넣기

### 손으로 하는 방법
1. `logs/sample.html`을 복사해서 이름 변경
2. `<div class="content">...</div>` 부분을 롤20 챗로그의 `div.content`로 교체
3. 제목/메타 수정
4. `data/scenarios.js`에 항목 추가

## 롤20 챗로그 복사
챗 아카이브 페이지에서 F12 → `<div class="content">` 선택 → 우클릭 → Copy → Copy outerHTML.

## 참고
- 이미지는 외부 주소를 그대로 쓰면 원본 서비스가 사라질 때 같이 깨져. 백업이 목적이면 이미지도 이 폴더(예: `images/`)에 내려받아 상대 경로로 바꿔두는 게 안전해.
- 모든 페이지에 `noindex`가 들어 있어서 검색엔진에 안 잡혀. 공개할 거면 지워.
