// Build: bundles src/* into one self-contained dist/index.html (React/pdf.js are loaded from cdnjs at runtime).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');

// JSX -> plain JS (React 18 UMD is loaded as a global by the template)
const ui = esbuild.transformSync(src('ui.jsx'), {
  loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019',
}).code;

// anonymised example isolates + hospital logo (embedded as data URI)
const samples = JSON.parse(fs.readFileSync(path.join(root, 'data', 'samples.json'), 'utf8'));
const logo = fs.readFileSync(path.join(root, 'src', 'logo.png')).toString('base64');
const sampleJs = 'window.SAMPLE_ISOLATES = ' + JSON.stringify(samples) + ';\nwindow.HOSPITAL_LOGO = "data:image/png;base64,' + logo + '";';

const html = src('template.html')
  .replace('/*CSS*/', () => src('app.css'))
  .replace('/*ENGINE*/', () => src('engine.js'))
  .replace('/*BARCODE*/', () => src('barcode.js'))
  .replace('/*KSNK*/', () => src('ksnk.js'))
  .replace('/*DOCX*/', () => src('docx.js'))
  .replace('/*SAMPLES*/', () => sampleJs)
  .replace('/*UI*/', () => ui.replace(/<\/script/g, '<\\/script'));

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log('built dist/index.html', (html.length / 1024).toFixed(1) + ' KB; samples', samples.length);
