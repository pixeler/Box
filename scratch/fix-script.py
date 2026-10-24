import io
p = 'scratch/refactor-sky.py'
s = io.open(p, encoding='utf-8').read()

s = s.replace('''    let glyphLayer: HTMLCanvasElement | null = null;
    let glyphDirty = true;
""", 1)''', '''    let glyphLayer: HTMLCanvasElement | null = null;
    let glyphDirty = true;

    let lastDraw = 0;
    // The overlay is a slow cloud drift; 30fps is visually identical and halves
    // the character-matrix painting cost on both CPU and GPU.
    const frameInterval = 1000 / 30;
""", 1)''')

s = s.replace('''end_marker = "    animId = requestAnimationFrame(render);"
end = src.index(end_marker)''', '''end_marker = "\n\n    animId = requestAnimationFrame(render);"
end = src.index(end_marker, start) + 1''')

io.open('scratch/refactor-sky2.py', 'w', encoding='utf-8', newline='').write(s)
print('ok')
