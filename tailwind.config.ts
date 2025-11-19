import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class', // <--- ВАЖНО! Без этого темная тема не заработает
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}", // Не забудь про lib, если там есть UI
  ],
  theme: {
    extend: {
      // Твои настройки...
    },
  },
  plugins: [],
};
export default config;