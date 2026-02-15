const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const androidResPath = path.join(__dirname, '../android/app/src/main/res');

// Splash screen sizes for Android
const splashSizes = [
    { folder: 'drawable', width: 480, height: 800 },
    { folder: 'drawable-land-hdpi', width: 800, height: 480 },
    { folder: 'drawable-land-mdpi', width: 480, height: 320 },
    { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
    { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
    { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
    { folder: 'drawable-port-hdpi', width: 480, height: 800 },
    { folder: 'drawable-port-mdpi', width: 320, height: 480 },
    { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
    { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
    { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
];

// Create splash screen SVG with logo centered
const createSplashSVG = (width, height) => {
    const logoSize = Math.min(width, height) * 0.3; // Logo is 30% of smallest dimension
    const logoX = (width - logoSize) / 2;
    const logoY = (height - logoSize) / 2 - 40; // Slightly above center

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0f172a"/>
                <stop offset="100%" style="stop-color:#1e293b"/>
            </linearGradient>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#10b981"/>
                <stop offset="100%" style="stop-color:#34d399"/>
            </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

        <!-- Logo container -->
        <g transform="translate(${logoX}, ${logoY})">
            <!-- Logo background with rounded corners -->
            <rect width="${logoSize}" height="${logoSize}" rx="${logoSize * 0.2}" fill="url(#logoGradient)"/>

            <!-- Chat bubble -->
            <path d="M${logoSize * 0.5} ${logoSize * 0.19}
                    C${logoSize * 0.34} ${logoSize * 0.19} ${logoSize * 0.2} ${logoSize * 0.32} ${logoSize * 0.2} ${logoSize * 0.47}
                    C${logoSize * 0.2} ${logoSize * 0.55} ${logoSize * 0.24} ${logoSize * 0.62} ${logoSize * 0.3} ${logoSize * 0.67}
                    L${logoSize * 0.3} ${logoSize * 0.81}
                    L${logoSize * 0.43} ${logoSize * 0.73}
                    C${logoSize * 0.45} ${logoSize * 0.74} ${logoSize * 0.48} ${logoSize * 0.74} ${logoSize * 0.5} ${logoSize * 0.74}
                    C${logoSize * 0.66} ${logoSize * 0.74} ${logoSize * 0.8} ${logoSize * 0.61} ${logoSize * 0.8} ${logoSize * 0.46}
                    C${logoSize * 0.8} ${logoSize * 0.3} ${logoSize * 0.66} ${logoSize * 0.19} ${logoSize * 0.5} ${logoSize * 0.19}Z"
                  fill="white"/>

            <!-- Three dots -->
            <circle cx="${logoSize * 0.375}" cy="${logoSize * 0.47}" r="${logoSize * 0.047}" fill="#10b981"/>
            <circle cx="${logoSize * 0.5}" cy="${logoSize * 0.47}" r="${logoSize * 0.047}" fill="#10b981"/>
            <circle cx="${logoSize * 0.625}" cy="${logoSize * 0.47}" r="${logoSize * 0.047}" fill="#10b981"/>

            <!-- Purple AI dot -->
            <circle cx="${logoSize * 0.82}" cy="${logoSize * 0.18}" r="${logoSize * 0.094}" fill="#a855f7"/>
        </g>

        <!-- App name -->
        <text x="${width / 2}" y="${logoY + logoSize + 60}"
              font-family="Arial, sans-serif"
              font-size="${Math.min(width, height) * 0.06}"
              font-weight="700"
              fill="white"
              text-anchor="middle">WazzapAI</text>

        <!-- Tagline -->
        <text x="${width / 2}" y="${logoY + logoSize + 90}"
              font-family="Arial, sans-serif"
              font-size="${Math.min(width, height) * 0.025}"
              fill="#94a3b8"
              text-anchor="middle">Transformez WhatsApp en machine à ventes</text>
    </svg>`;
};

async function generateSplashScreens() {
    console.log('Generating splash screens...');

    for (const { folder, width, height } of splashSizes) {
        const outputDir = path.join(androidResPath, folder);
        const outputFile = path.join(outputDir, 'splash.png');

        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const svgContent = createSplashSVG(width, height);

        await sharp(Buffer.from(svgContent))
            .png()
            .toFile(outputFile);

        console.log(`Generated ${folder}/splash.png (${width}x${height})`);
    }

    console.log('All splash screens generated!');
}

generateSplashScreens().catch(console.error);
