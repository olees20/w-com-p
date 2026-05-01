import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f8f6",
          100: "#dbece3",
          600: "#1f6f52",
          700: "#195840",
          900: "#0e2f22"
        }
      }
    }
  },
  plugins: []
};

export default config;
