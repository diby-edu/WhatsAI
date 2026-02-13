const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/app-icon.svg');
const androidResPath = path.join(__dirname, '../android/app/src/main/res');

// Android icon sizes
const sizes = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
];

// Foreground icon sizes (for adaptive icons)
const foregroundSizes = [
    { name: 'mipmap-mdpi', size: 108 },
    { name: 'mipmap-hdpi', size: 162 },
    { name: 'mipmap-xhdpi', size: 216 },
    { name: 'mipmap-xxhdpi', size: 324 },
    { name: 'mipmap-xxxhdpi', size: 432 },
];

async function generateIcons() {
    const svgBuffer = fs.readFileSync(svgPath);

    for (const { name, size } of sizes) {
        const outputDir = path.join(androidResPath, name);

        // Generate ic_launcher.png
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher.png'));

        // Generate ic_launcher_round.png (same for now)
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher_round.png'));

        console.log(`Generated ${name}/ic_launcher.png (${size}x${size})`);
    }

    // Generate foreground icons
    for (const { name, size } of foregroundSizes) {
        const outputDir = path.join(androidResPath, name);

        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher_foreground.png'));

        console.log(`Generated ${name}/ic_launcher_foreground.png (${size}x${size})`);
    }

    console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
