# 🌐 Frontend Translation System Guide (팀 공유용)

모든 페이지에 다국어(한국어/영어/일어/중국어) 지원이 가능하도록 **중앙화된 번역 시스템**을 구축했습니다.
새로운 기능이나 페이지 개발 시 아래 가이드를 따라주세요!

---

## 🚀 30초 요약
1. `src/constants/translations.js` 에 번역할 문구를 추가한다.
2. 페이지 파일에서 `useLanguage` 훅을 불러온다.
3. 텍스트 대신 `{t('키값')}`을 사용한다.

---

## 1. 번역 사전 등록 (`translations.js`)
`frontend/src/constants/translations.js` 파일을 열고 사용할 키와 번역어를 추가해주세요.

```javascript
// src/constants/translations.js
export const translations = {
  English: {
    hello: "Hello",       // <-- 추가
  },
  한국어: {
    hello: "안녕하세요",    // <-- 추가
  },
  // ... 일본어, 중국어
};
```

## 2. 사용 방법 (컴포넌트)
`t` 함수를 사용하여 사전에 등록한 키를 불러옵니다.

```javascript
// 1. import 하기
import { useLanguage } from '../../context/LanguageContext'; // 경로 주의!

const MyPage = () => {
  // 2. t 함수 꺼내기
  const { t } = useLanguage();

  return (
    <div>
      {/* 3. 사용하기 (하드코딩 제거) */}
      <h1>{t('hello')}</h1>
    </div>
  );
};
```

## 💡 꿀팁
* **키 이름 규칙**: `page_location_description` 형태로 지으면 관리가 편합니다. (예: `login_btn_submit`, `home_hero_title`)
* **누락 시**: 만약 한국어 번역이 없으면 자동으로 **영어(English)**가 나옵니다.
* **API 데이터**: 서버에서 오는 데이터(게시글 등)는 이 시스템이 아니라 서버 API에 `lang` 파라미터를 보내서 처리합니다. (MainPage 참조)