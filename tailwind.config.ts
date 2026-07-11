import type { Config } from 'tailwindcss'

/**
 * 차트팔자 Dark + Red (토스증권 웹 레이어 참고)
 * - bg 계단으로 깊이, accent(블루)=CTA / line(빨강)=시세 데이터
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cp: {
          bg: '#131316',
          raised: '#1F1E25',
          surface: '#2D2D36',
          hover: '#34343C',
          input: '#25252C',
          border: '#2E2F36',
          borderStrong: '#4B4B54',
          text: '#FFFFFF',
          secondary: '#E8E8ED',
          muted: '#8B8B93',
          dim: '#6B6B75',
          line: '#F04452',
          up: '#F04452',
          down: '#3182F6',
          accent: '#3182F6',
          caution: '#F5A524',
          /** 구간 선택·해설 — 시세 빨강/CTA 블루와 구분되는 소프트 바이올렛 */
          violet: '#C4B5FD',
          violetMuted: 'rgba(167, 139, 250, 0.22)',
          violetBorder: 'rgba(167, 139, 250, 0.4)',
          upMuted: 'rgba(240,68,82,0.12)',
          downMuted: 'rgba(49,130,246,0.12)',
          overlay: 'rgba(0,0,0,0.6)',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
export default config
