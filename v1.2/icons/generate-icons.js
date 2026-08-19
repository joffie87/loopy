#!/usr/bin/env node
/*
@TVN_META
role: standard
desc: Generate-Icons
last_updated: 2026-02-10
@END_META
*/

/**
 * PWA Icon Generator for Loopy
 *
 * This script generates PWA icons from the favicon.png file.
 * Run with: node generate-icons.js
 *
 * Requirements: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('❌ Sharp module not found. Installing...');
  console.error('   Run: npm install sharp');
  console.error('   Then run this script again.');
  process.exit(1);
}

const FAVICON_PATH = path.join(__dirname, '../favicon.png');
const OUTPUT_DIR = __dirname;

const ICON_SIZES = [
  { size: 192, name: 'icon-192.png', type: 'standard' },
  { size: 512, name: 'icon-512.png', type: 'standard' },
  { size: 512, name: 'icon-maskable-512.png', type: 'maskable' }
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons from favicon.png...\n');

  if (!fs.existsSync(FAVICON_PATH)) {
    console.error(`❌ Favicon not found at: ${FAVICON_PATH}`);
    process.exit(1);
  }

  for (const icon of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, icon.name);

    try {
      let pipeline = sharp(FAVICON_PATH).resize(icon.size, icon.size, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });

      // For maskable icons, add safe zone padding (80% of the icon should be visible)
      if (icon.type === 'maskable') {
        const paddedSize = Math.floor(icon.size * 0.8);
        const padding = Math.floor((icon.size - paddedSize) / 2);

        pipeline = sharp(FAVICON_PATH)
          .resize(paddedSize, paddedSize, {
            kernel: sharp.kernel.lanczos3,
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .extend({
            top: padding,
            bottom: padding,
            left: padding,
            right: padding,
            background: { r: 68, g: 68, b: 68, alpha: 1 } // #444 theme color
          });
      }

      await pipeline.png().toFile(outputPath);

      console.log(`✓ Generated: ${icon.name} (${icon.size}x${icon.size}${icon.type === 'maskable' ? ', maskable' : ''})`);
    } catch (error) {
      console.error(`✗ Failed to generate ${icon.name}:`, error.message);
    }
  }

  console.log('\n✅ Icon generation complete!');
  console.log('   You can now test the PWA by serving v1.1/ with a static server.');
}

generateIcons().catch(console.error);
