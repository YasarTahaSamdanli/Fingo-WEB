    // watch.js

    const { exec } = require('child_process');

    // Tailwind CSS CLI komutunu izleme modunda çalıştırıyoruz.
    const tailwindCommand = 'npx tailwindcss -i ./input.css -o ./public/output.css --watch';


    console.log('Tailwind CSS izleniyor ve derleniyor...');

    const tailwindProcess = exec(tailwindCommand);

    tailwindProcess.stdout.on('data', (data) => {
        console.log(`Tailwind CSS (stdout): ${data}`);
    });

    tailwindProcess.stderr.on('data', (data) => {
        console.error(`Tailwind CSS (stderr): ${data}`);
    });

    tailwindProcess.on('close', (code) => {
        console.log(`Tailwind CSS izleme işlemi sonlandı. Çıkış kodu: ${code}`);
    });
