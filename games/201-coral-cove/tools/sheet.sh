#!/bin/zsh
# 把多張截圖拼成 3 欄接觸表：tools/sheet.sh <輸出.png> <寬> <高> 圖1 圖2 ...
out=$1; W=$2; H=$3; shift 3
ins=(); filt=""; lay=""; i=0
for f in "$@"; do ins+=(-i $f); filt+="[${i}]scale=${W}:${H}[x$i];"; lay+="$(( (i%3)*W ))_$(( (i/3)*H ))|"; i=$((i+1)); done
pads=""; for k in $(seq 0 $((i-1))); do pads+="[x$k]"; done
ffmpeg -y -loglevel error "${ins[@]}" -filter_complex "${filt}${pads}xstack=inputs=${i}:layout=${lay%|}:fill=white" $out && echo $out
