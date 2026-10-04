#!/bin/sh
# 開發用：角色正交正面圖與參考圖並排比對比例。sh tools/refcmp.sh <ref資料夾> <id...>
REF=$1; shift
for id in "$@"; do
  pick=$(grep "^$id " "$REF/picks.txt" | cut -d' ' -f2)
  crop=$(grep "^$id " "$REF/picks.txt" | cut -d' ' -f3)
  node tools/viewer.mjs "st_$id" "ids=$id&anim=stand&ortho=1" 600 1200 >/dev/null
  echo "## $id"
  uv run -q --with pillow python "$REF/cmp.py" "$REF/$id/$pick.img" "dist/view/st_$id.png" "$REF/cmp_$id.png" "$crop"
done
