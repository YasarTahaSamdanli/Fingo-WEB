/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind'in CSS sınıflarını arayacağı dosyaları belirtiyoruz.
  // Bu, sadece kullandığımız sınıfların çıktı CSS'ine dahil edilmesini sağlar.
  content: [
    "./public/**/*.html", // public klasöründeki tüm HTML dosyaları
    // "./public/**/*.js",   // Eğer JavaScript'te dinamik olarak Tailwind sınıfları ekliyorsak (şimdilik eklemeye gerek yok)
  ],
  theme: {
    extend: {
      // Buraya gelecekte özel fontlar, renkler, boyutlar vb. ekleyebiliriz.
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Inter fontunu burada tanımlayabiliriz
      },
    },
  },
  plugins: [],
}
