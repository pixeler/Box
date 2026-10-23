import subprocess, io

work_path = 'src/App.tsx'
raw = open(work_path, 'rb').read()
crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')
head = subprocess.run(['git','show','HEAD:src/App.tsx'], capture_output=True).stdout.decode('utf-8').replace('\r\n','\n')

hl = head.split('\n')
wl = text.split('\n')

# HEAD: header block from "Top Greeting Header" comment up to (excluding) the Stream Content Area comment
h_start = next(i for i,l in enumerate(hl) if 'Top Greeting Header' in l)
h_end = next(i for i,l in enumerate(hl) if 'Stream Content Area sitting flush' in l)
block = hl[h_start:h_end]
while block and block[-1].strip() == '':
    block.pop()

w_start = next(i for i,l in enumerate(wl) if l.strip() == '<TodayHeader')
w_end = next(i for i in range(w_start, len(wl)) if wl[i].strip() == '/>')
print('replacing worktree lines', w_start+1, '-', w_end+1, 'with HEAD block of', len(block), 'lines')

new = wl[:w_start] + block + wl[w_end+1:]
out = '\n'.join(new)
if crlf:
    out = out.replace('\n', '\r\n')
open(work_path,'wb').write(out.encode('utf-8'))
print('crlf:', crlf)
