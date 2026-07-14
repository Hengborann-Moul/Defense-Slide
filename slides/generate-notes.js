#!/usr/bin/env node
/*
 * generate-notes.js
 * ------------------
 * Extracts the speaker script from each slide_XX.html file (the <aside data-notes> block)
 * and writes it to notes-data.js as:  window.SLIDE_NOTES = { "1": "...", "2": "...", ... };
 *
 * The output is ASCII-safe (non-ASCII characters are escaped as \uXXXX) so the file loads
 * correctly whether the navigator is opened via file:// or http://.
 *
 * Usage (run from the slides/ folder):  node generate-notes.js
 */

const fs = require('fs');
const path = require('path');

const TOTAL = 34;
const DIR = __dirname;

// ---- Minimal HTML-entity decoder (named + numeric) ---------------------------
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: '\u00A0', copy: '\u00A9', reg: '\u00AE', deg: '\u00B0',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201D', ldquo: '\u201C',
  auml: '\u00E4', ouml: '\u00F6', uuml: '\u00FC', eacute: '\u00E9'
};

function decodeEntities(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return isNaN(code) ? match : String.fromCodePoint(code);
    }
    const decoded = NAMED[ent.toLowerCase()];
    return decoded !== undefined ? decoded : match;
  });
}

// ---- Escape non-ASCII to \uXXXX so the file is pure ASCII --------------------
function toAsciiJson(obj) {
  const json = JSON.stringify(obj);
  let out = '';
  for (const ch of json) {
    const code = ch.codePointAt(0);
    out += code < 128 ? ch : '\\u' + code.toString(16).padStart(4, '0');
  }
  return out;
}

// ---- Build the notes map -----------------------------------------------------
const notes = {};
for (let i = 1; i <= TOTAL; i++) {
  const file = path.join(DIR, 'slide_' + String(i).padStart(2, '0') + '.html');
  if (!fs.existsSync(file)) {
    notes[String(i)] = '';
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<aside[^>]*data-notes[^>]*>([\s\S]*?)<\/aside>/i);
  notes[String(i)] = m ? decodeEntities(m[1].trim()) : '';
}

const output = 'window.SLIDE_NOTES = ' + toAsciiJson(notes) + ';\n';
fs.writeFileSync(path.join(DIR, 'notes-data.js'), output, 'ascii');

const nonEmpty = Object.values(notes).filter(t => t).length;
console.log(`Wrote notes-data.js — ${nonEmpty}/${TOTAL} slides have notes.`);
