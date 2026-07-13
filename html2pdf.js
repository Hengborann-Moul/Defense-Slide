/**
 * html2pdf.js — Pixel-perfect PDF export for 1280×720 HTML slides
 *
 * Renders each slide_NN.html to a single-page PDF at exactly 1280×720 px
 * (13.333in × 7.5in at 96dpi), then merges into one multi-page PDF.
 *
 * Usage:
 *   node html2pdf.js <slides_dir> <output.pdf>
 *
 * Example:
 *   node html2pdf.js ./slides thesis_defense.pdf
 *
 * Dependencies (install once globally or locally):
 *   npm install -g playwright pdf-lib
 *   npx playwright install chromium
 *
 * Or use npx:
 *   npx -p playwright -p pdf-lib node html2pdf.js ./slides thesis_defense.pdf
 */

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');

const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 720;
const WIDTH_IN = (PAGE_WIDTH / 96).toFixed(4);   // 13.3333in
const HEIGHT_IN = (PAGE_HEIGHT / 96).toFixed(4);  // 7.5000in

async function renderSlideToPdf(browser, htmlPath) {
  const page = await browser.newPage({
    viewport: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    deviceScaleFactor: 2,  // 2x for crisp output
  });

  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait a bit for any web fonts / Tailwind CDN to settle
  await page.waitForTimeout(800);

  // Hide speaker notes if visible
  await page.addStyleTag({ content: 'aside[data-notes]{display:none !important;}' });

  const pdfBytes = await page.pdf({
    width: WIDTH_IN + 'in',
    height: HEIGHT_IN + 'in',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: false,
  });

  await page.close();
  return pdfBytes;
}

async function main() {
  const slidesDir = process.argv[2];
  const outputPath = process.argv[3];

  if (!slidesDir || !outputPath) {
    console.error('Usage: node html2pdf.js <slides_dir> <output.pdf>');
    process.exit(1);
  }

  // Collect slide HTML files (sorted by filename)
  const allFiles = fs.readdirSync(slidesDir)
    .filter(f => /^slide_\d+\.html$/i.test(f))
    .sort();

  if (allFiles.length === 0) {
    console.error(`No slide_NN.html files found in ${slidesDir}`);
    process.exit(1);
  }

  console.log(`Found ${allFiles.length} slides in ${slidesDir}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Page size: ${PAGE_WIDTH}×${PAGE_HEIGHT}px (${WIDTH_IN}in × ${HEIGHT_IN}in)`);
  console.log('---');

  const browser = await chromium.launch({ headless: true });
  const merged = await PDFDocument.create();

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const fullPath = path.join(slidesDir, file);
    process.stdout.write(`  [${String(i+1).padStart(2,'0')}/${allFiles.length}] ${file} ... `);
    try {
      const pdfBytes = await renderSlideToPdf(browser, fullPath);
      const slideDoc = await PDFDocument.load(pdfBytes);
      const [page] = await merged.copyPages(slideDoc, [0]);
      merged.addPage(page);
      console.log('done');
    } catch (err) {
      console.log('FAILED');
      console.error('    ' + err.message);
    }
  }

  await browser.close();

  const finalBytes = await merged.save();
  fs.writeFileSync(outputPath, finalBytes);

  const sizeMB = (finalBytes.length / 1024 / 1024).toFixed(2);
  console.log('---');
  console.log(`✓ Saved: ${outputPath} (${sizeMB} MB, ${allFiles.length} pages)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
