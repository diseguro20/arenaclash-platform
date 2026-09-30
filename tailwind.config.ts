import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#060D2A",
        foreground: "#ffffff",
        primary: {
          DEFAULT: "#0070f3",
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
