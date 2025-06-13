/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        //Define your custom colors here
        'mshikaki-dark-blue': '#0a129f', 
        'mshikaki-rose': '#dc2626'
      }
    },
  },
  plugins: [require('tailwind-scrollbar-hide')],

};
