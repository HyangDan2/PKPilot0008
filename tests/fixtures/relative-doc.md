---
title: "상대 경로 이미지 확인용 문서"
date: 2026-11-19
category: test
summary: "URL로 열었을 때 상대 경로 이미지가 문서 옆에서 함께 열리는지 확인하는 문서입니다."
tags: [test, relative-path]
---

# 상대 경로 이미지 확인

이 문서는 PKPilot0008의 `?url=` 공유 링크가 상대 경로 이미지를 함께 데려오는지 확인하려고 만든 고정 문서입니다.

## 같은 폴더의 이미지

![보라색 점](./img/dot.png)

## 한글과 줄바꿈, 코드 블록

첫째 줄입니다.
둘째 줄입니다 — 줄바꿈이 그대로 남아야 합니다.

```js
const viewer = window.HD2Viewer;
viewer.renderDocument('# 상대 경로 확인', 'relative-doc.md', '');
```

> 이 문서가 열리고 위 그림이 보이면 상대 경로 처리가 살아 있는 것입니다.
