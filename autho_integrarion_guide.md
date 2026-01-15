# 프론트엔드 인증 통합 가이드 (Auth Integration Guide)

이 문서는 최근 리팩토링된 **전역 인증 시스템(AuthContext)**의 개념과, 다른 팀원들이 새로운 페이지를 개발할 때 **로그인 상태를 어떻게 연결해야 하는지** 설명합니다.

---

## 🏗️ 1. 변경된 인증 구조 (Architecture Change)

기존에는 각 페이지나 컴포넌트(`Navbar`, `ShortsPage` 등)가 개별적으로 `localStorage`를 직접 확인했습니다. 이로 인해 다음과 같은 문제들이 있었습니다:
*   로그인을 해도 Navbar가 바로 바뀌지 않음 (새로고침 필요)
*   페이지마다 로그인 체크 로직이 달라서 관리가 어려움
*   로그아웃 시 일부 페이지는 여전히 로그인 상태로 남음

**✅ 해결책: `AuthContext` (중앙 통제실)**
이제 앱의 가장 바깥(`App.jsx`)에 `AuthProvider`라는 관리자를 두었습니다.
*   모든 로그인 정보(`user`, `isLoggedIn` 등)는 여기서 한 번만 관리합니다.
*   다른 페이지들은 "나 로그인 됐어?"라고 **물어보기만 하면 됩니다.**

---

## 🔌 2. [중요] 각 페이지 연결 방법 (How to Connect)

로그인 상태를 인식하거나, 유저 정보를 가져오려면 **`useAuth()` 훅**을 사용하세요.
**더 이상 `localStorage.getItem('token')`을 직접 쓰지 마세요!**

### (1) 유저 정보 & 로그인 여부 확인하기

```jsx
import { useAuth } from '../../context/AuthContext'; // 경로에 맞게 수정

const MyComponent = () => {
  // 전역 상태에서 필요한 것만 꺼내오세요
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div>로그인이 필요합니다.</div>;
  }

  return <div>안녕하세요, {user?.nickname}님!</div>;
};
```

### (2) 로그인 처리하기 (로그인 페이지 개발 시)

API 통신 후, 성공하면 반드시 `login()` 함수를 호출해 주세요.

```jsx
const { login } = useAuth();

const handleLoginSuccess = (apiResponse) => {
  // AuthContext에게 "로그인 성공했어!"라고 알림
  // (이 함수가 localStorage 저장과 Navbar 업데이트를 다 처리해줌)
  login(apiResponse.access, apiResponse.refresh, apiResponse.user);
};
```

### (3) 로그아웃 처리하기

```jsx
const { logout } = useAuth();

const handleLogout = () => {
  logout(); // localStorage 삭제 및 모든 페이지 상태 초기화
  // 필요한 경우 페이지 이동 추가
};
```

---

## 📁 3. 주요 변경 파일 요약

| 파일명 | 변경 내용 | 이유 |
| :--- | :--- | :--- |
| `src/context/AuthContext.jsx` | **[신규]** 인증 로직의 핵심 파일 | 로그인/로그아웃 함수 및 상태 제공자 |
| `src/App.jsx` | `<AuthProvider>` 추가 | 앱 전체에 인증 기능을 퍼뜨리기 위해 |
| `src/components/Navbar.jsx` | `useAuth()` 적용 | 로그인 즉시 버튼 UI가 바뀌도록 수정 |
| `src/pages/auth/LoginPage.jsx` | `auth.login()` 호출 추가 | 로그인 성공 사실을 전역에 알리기 위해 |
| `src/pages/shorts/ShortsPage.jsx`| `useAuth()` 적용 | 로그인 한 사람만 '업로드' 버튼이 보이게 함 |
| `src/pages/mypage/MyPage.jsx` | `useAuth()` 적용 | 마이페이지와 메인 메뉴의 로그인 상태 동기화 |
| `src/api/axios.js` | `baseURL` 상대경로로 수정 | Nginx 프록시를 통해 안정적으로 통신하기 위해 (`/api` 사용) |

---

## ❓ 4. 자주 묻는 질문 (FAQ)

**Q. API 호출할 때 토큰은 어떻게 보내나요?**
A. `src/api/axios.js`에 이미 설정되어 있습니다. API 요청을 보낼 때 자동으로 헤더에 토큰을 붙여주므로 신경 쓰지 않아도 됩니다.

**Q. 페이지 새로고침하면 로그인이 풀리나요?**
A. 아니요. `AuthContext`가 앱이 시작될 때 `localStorage`를 확인해서 로그인 상태를 자동으로 복구합니다.

---
**💡 요약:** 앞으로 로그인 관련 기능이 필요하면 **무조건 `import { useAuth }`** 를 떠올려 주세요!
