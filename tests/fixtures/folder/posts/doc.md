---
title: "상위 폴더 이미지가 있는 문서"
date: 2026-11-23
category: test
summary: "posts/doc.md 안에서 ../assets/sample.png 를 부르는지 확인하는 문서입니다."
tags: [test, relative-path, folder]
---

# 상위 폴더 이미지

이 문서는 `posts/doc.md` 자리에 있습니다. 그래서 `../assets/sample.png`는 `assets/sample.png`를 가리킵니다.

## 상위 폴더(../assets)

![상위 폴더 이미지](../assets/sample.png)

## 같은 폴더 아래(images)

![같은 폴더 아래 이미지](../images/local.png)

## 같은 폴더 안

![같은 폴더 이미지](./same-folder.png)

## 루트 기준(/assets)

![루트 기준 이미지](/assets/second.png)

> 문서를 하나만 열면 위의 상대 경로 이미지들은 비어 있고, 상위 폴더를 열면 모두 채워집니다.
