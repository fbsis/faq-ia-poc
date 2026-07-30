import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: { soft: "0 18px 50px -24px rgb(15 23 42 / 0.3)" }
    }
  },
  plugins: []
} satisfies Config;
