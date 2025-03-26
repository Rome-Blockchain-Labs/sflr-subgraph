#!/bin/bash
CONTAINER_ID=$1

# Get blocks without Docker timestamps to avoid parsing issues
first_block_line=$(docker logs ${CONTAINER_ID} 2>&1 | grep -m1 "Applying.*block_number:")
first_block=$(echo "$first_block_line" | grep -Po "block_number: \K[0-9]+" || echo "23664754")

last_block_line=$(docker logs --tail 1000 ${CONTAINER_ID} 2>&1 | grep "Applying.*block_number:" | tail -1)
last_block=$(echo "$last_block_line" | grep -Po "block_number: \K[0-9]+" || echo "$first_block")

latest=$(docker logs --tail 100 ${CONTAINER_ID} 2>&1 | grep -Po "latest_block_head: \K\d+" | tail -1 || echo "38704713")

# Use container runtime instead of log timestamps
container_start=$(docker inspect --format='{{.State.StartedAt}}' ${CONTAINER_ID} 2>/dev/null | xargs -I{} date +%s -d {} 2>/dev/null || echo 0)
now=$(date +%s)
elapsed=$((now - container_start))
elapsed=$((elapsed > 0 ? elapsed : 3600))

# Calculate metrics
start_block=23664754
blocks_processed=$((last_block - first_block))
synced=$((last_block - start_block))
speed=$(echo "scale=2; $blocks_processed / $elapsed" | bc 2>/dev/null || echo "0")
remaining=$((latest - last_block))
eta=$(echo "scale=2; if($speed > 0) $remaining / $speed / 3600 else 999" | bc 2>/dev/null || echo "999")
progress=$(echo "scale=4; ($last_block - $start_block) / ($latest - $start_block) * 100" | bc 2>/dev/null || echo "0")

printf "Start: %d, First: %d, Current: %d, Latest: %d, Synced: %d, Speed: %.2f blk/s, Remaining: %d, ETA: %.2f hrs, Progress: %.4f%%\n" \
  $start_block $first_block $last_block $latest $synced $speed $remaining $eta $progress
