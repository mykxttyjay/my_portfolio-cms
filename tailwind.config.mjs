/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				primary: '#a288a6',
				secondary: '#bb9bb0',
				accent: '#ccbcbc',
				dark: '#1c1d21',
				light: '#f1e3e4',
			},
			fontFamily: {
				sans: ['Playfair Display', 'Georgia', 'Segoe UI', 'sans-serif'],
			},
		},
	},
	plugins: [],
}
