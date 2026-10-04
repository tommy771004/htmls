#!/bin/sh
# 開發用：六名角色的頭部特寫拼成一張 dist/view/heads.png（$1 角度，預設 20）
A=${1:-20}
for id in goku vegeta trunks piccolo frieza a18; do node tools/viewer.mjs "h_$id" "ids=$id&ang=$A&zoom=7&focus=head&fy=0.14&anim=idle" 600 700 >/dev/null; done
cd dist/view && uv run -q --with pillow python - <<'PY'
from PIL import Image
ims=[Image.open(f'h_{i}.png') for i in ['goku','vegeta','trunks','piccolo','frieza','a18']]
o=Image.new('RGB',(600*3,700*2))
for k,im in enumerate(ims): o.paste(im,((k%3)*600,(k//3)*700))
o.save('heads.png')
PY
