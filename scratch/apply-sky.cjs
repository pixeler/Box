const fs = require('fs');
const path = 'src/components/layout/DynamicSkyBackground.tsx';
let src = fs.readFileSync(path, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';

const script = fs.readFileSync('scratch/refactor-sky.py', 'utf8');
const a = script.indexOf('new_block = """') + 'new_block = """'.length;
const b = script.indexOf('"""\n\nsrc = src[:start]');
let block = script.slice(a, b);
if (eol === '\r\n') block = block.replace(/\n/g, '\r\n');

const preludeOld = '    const charH = 13;' + eol;
const preludeNew = '    const charH = 13;' + eol + eol +
  '    // The character matrix is static artwork, so it is painted once into an' + eol +
  '    // offscreen canvas and re-used until the size or palette changes.' + eol +
  '    let glyphLayer: HTMLCanvasElement | null = null;' + eol +
  '    let glyphDirty = true;' + eol + eol +
  '    let lastDraw = 0;' + eol +
  '    // Slow cloud drift: 30fps is visually identical and halves the painting cost.' + eol +
  '    const frameInterval = 1000 / 30;' + eol;
if (!src.includes(preludeOld)) throw new Error('prelude anchor missing');
src = src.replace(preludeOld, preludeNew);

const resizeOld = '      canvas.height = height;' + eol;
const resizeNew = '      canvas.height = height;' + eol + '      glyphDirty = true;' + eol;
if (!src.includes(resizeOld)) throw new Error('resize anchor missing');
src = src.replace(resizeOld, resizeNew);

const start = src.indexOf('    const render = (time: number) => {');
const endMarker = '    animId = requestAnimationFrame(render);';
const end = src.indexOf(eol + eol + endMarker, start) + eol.length;
if (start < 0 || end <= start) throw new Error('render block anchors missing');

src = src.slice(0, start) + block + src.slice(end);
fs.writeFileSync(path, src);
console.log('patched. lines=', src.split('\n').length, 'eol=', JSON.stringify(eol));
