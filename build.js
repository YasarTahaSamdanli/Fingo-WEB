    // build.js

    const { exec } = require('child_process');

    // Tailwind CSS CLI komutu için npx kullanıyoruz.
    // Artık npx'in çalıştığını doğruladık.
    const tailwindCommand = 'npx tailwindcss -i ./input.css -o ./public/output.css --minify';

    console.log('Tailwind CSS derleniyor...');

    exec(tailwindCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Tailwind CSS derleme hatası: ${error.message}`);
            if (stderr) console.error(`Stderr: ${stderr}`);
            return;
        }
        if (stderr) {
            console.warn(`Tailwind CSS derleme uyarısı (stderr): ${stderr}`);
        }
        console.log(`Tailwind CSS derleme başarılı:\n${stdout}`);
        console.log('public/output.css dosyası oluşturuldu.');
    });
