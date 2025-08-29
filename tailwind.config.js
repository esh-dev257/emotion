/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#6c5ce7",
        brand2: "#00c2ff",
        pos: "#16a34a",
        neg: "#ef4444",
        neu: "#f59e0b",
      },
    },
  },
  plugins: [],
};