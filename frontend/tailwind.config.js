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
                primary: '#1392ec',
                'primary-hover': '#0d7ac8',
                'dark-bg': '#101a22',
                'dark-surface': '#1e2b36',
            },
            fontFamily: {
                sans: ['"Noto Sans KR"', 'sans-serif'],
            },
        },
    },
    plugins: [],
}