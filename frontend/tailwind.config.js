/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                "primary": "#1392ec",           // 메인 포인트 컬러
                "background-light": "#f6f7f8",  // 밝은 배경
                "background-dark": "#101a22",   // 어두운 배경 (다크모드 등)
            },
            fontFamily: {
                sans: ['"Noto Sans KR"', 'sans-serif'], // 본고딕 설정
            },
            borderRadius: {
                'card': '12px',    // Card radius
                'btn': '10px',     // Button radius
            },
            spacing: {
                // 기본 spacing이 4px 단위이므로, 
                // p-4(16px), p-5(20px), p-6(24px)를 사용하면 됩니다.
            }
        },
        // container 기본 설정 (중앙 정렬 자동화)
        container: {
            center: true,
            padding: '1rem', // 기본 px-4 효과
        },
    },
    plugins: [],
}