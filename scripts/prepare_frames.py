from pathlib import Path
from PIL import Image
import json
root = Path(__file__).resolve().parents[1]
out = root / 'dist' / 'assets'
clips={}
for name,path,scale in [('left','legs/legsl.gif',.55),('right','legs/legsr.gif',.55),('nudge','eyenudge.gif',.2)]:
    im=Image.open(root / 'artwork' / path)
    frames=[]; durations=[]
    for i in range(im.n_frames):
        im.seek(i)
        frames.append(im.convert('RGBA'))
        durations.append(im.info.get('duration',100))
    bounds=[frame.getbbox() for frame in frames]
    box=(0,0,*im.size) if name!='nudge' else (min(x[0] for x in bounds),min(x[1] for x in bounds),max(x[2] for x in bounds),max(x[3] for x in bounds))
    size=tuple(round((box[i+2]-box[i])*scale) for i in [0,1])
    cols=min(6,len(frames))
    sheet=Image.new('RGBA',(size[0]*cols,size[1]*((len(frames)+cols-1)//cols)))
    for i,f in enumerate(frames):
        sheet.paste(f.crop(box).resize(size,Image.Resampling.LANCZOS),((i%cols)*size[0],(i//cols)*size[1]))
    sheet.save(out/(name+'.png'),optimize=True)
    clips[name]=dict(width=size[0],height=size[1],cols=cols,durations=durations)
(out.parent/'clips.js').write_text('const clips = '+json.dumps(clips,indent=2)+';\n')
