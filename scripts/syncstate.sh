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

# Format elapsed time
elapsed_days=$(echo "scale=1; $elapsed / 86400" | bc)
elapsed_hrs=$(echo "scale=1; $elapsed / 3600" | bc)

# Calculate metrics
start_block=23664754
blocks_processed=$((last_block - first_block))
synced=$((last_block - start_block))
speed=$(echo "scale=2; $blocks_processed / $elapsed" | bc 2>/dev/null || echo "0")
remaining=$((latest - last_block))
eta_seconds=$(echo "if($speed > 0) $remaining / $speed else 999 * 3600" | bc -l 2>/dev/null || echo "3596400")
eta_hrs=$(echo "scale=1; $eta_seconds / 3600" | bc)
eta_days=$(echo "scale=1; $eta_seconds / 86400" | bc)
total_days=$(echo "scale=1; $elapsed_days + $eta_days" | bc)
total_hrs=$(echo "scale=1; $elapsed_hrs + $eta_hrs" | bc)

progress=$(echo "scale=2; ($last_block - $start_block) / ($latest - $start_block) * 100" | bc 2>/dev/null || echo "0")

printf "Start: %d, First: %d, Current: %d, Latest: %d, Synced: %d, Speed: %.2f blk/s\n" \
  $start_block $first_block $last_block $latest $synced $speed
printf "Remaining: %d, Progress: %.2f%%, Elapsed: %.1f days (%.1f hrs)\n" \
  $remaining $progress $elapsed_days $elapsed_hrs
printf "ETA: %.1f days (%.1f hrs), Total time: %.1f days (%.1f hrs)\n" \
  $eta_days $eta_hrs $total_days $total_hrs
