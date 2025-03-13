#!/bin/bash
CONTAINER_ID=$1
docker logs ${CONTAINER_ID} 2>&1 | awk '
  /Applying.*block_number:/ {
    match($0, /block_number: [0-9]+/);
    m=substr($0, RSTART+14, RLENGTH-14);
    if (!first_block) { first_block=m; ts=$1" "$2" "$3; }
    last_block=m; te=$1" "$2" "$3;
  }
  END {
    start_block=23664754;
    cmd="date -d \""ts"\" +%s"; cmd|getline t0; close(cmd);
    cmd="date -d \""te"\" +%s"; cmd|getline t1; close(cmd);
    elapsed=t1-t0; synced=last_block-start_block;
    speed=(last_block-first_block)/elapsed;
    cmd="docker logs '"$CONTAINER_ID"' 2>&1|grep -Po \"latest_block_head: \\K\\d+\"|tail -1"; cmd|getline latest; close(cmd);
    latest=(latest)?latest:38704713;
    remaining=latest-last_block; eta=(speed>0)?remaining/speed/3600:999;
    progress=(last_block-start_block)/(latest-start_block)*100;
    printf "Start: %d, First: %d, Current: %d, Latest: %d, Synced: %d, Speed: %.2f blk/s, Remaining: %d, ETA: %.2f hrs, Progress: %.4f%%\n",
      start_block,first_block,last_block,latest,synced,speed,remaining,eta,progress
}'
