#!/bin/bash

# Configuration
CONTAINER_ID=$1
SLACK_WEBHOOK="https://hooks.slack.com/services/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"
START_BLOCK=23664754

# Get container name
CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $CONTAINER_ID | sed 's/\///')
CONTAINER_IMAGE=$(docker inspect --format='{{.Config.Image}}' $CONTAINER_ID)

# Get sync status information
SYNC_INFO=$(docker logs ${CONTAINER_ID} 2>&1 | awk '
  /Applying.*block_number:/ {
    match($0, /block_number: [0-9]+/);
    m=substr($0, RSTART+14, RLENGTH-14);
    if (!first_block) { first_block=m; ts=$1" "$2" "$3; }
    last_block=m; te=$1" "$2" "$3;
  }
  END {
    start_block='"$START_BLOCK"';
    cmd="date -d \""ts"\" +%s"; cmd|getline t0; close(cmd);
    cmd="date -d \""te"\" +%s"; cmd|getline t1; close(cmd);
    elapsed=t1-t0; synced=last_block-start_block;
    speed=(last_block-first_block)/elapsed;
    cmd="docker logs '"$CONTAINER_ID"' 2>&1|grep -Po \"latest_block_head: \\K\\d+\"|tail -1"; cmd|getline latest; close(cmd);
    latest=(latest)?latest:38704713;
    remaining=latest-last_block; eta=(speed>0)?remaining/speed/3600:999;
    eta_days=eta/24;
    progress=(last_block-start_block)/(latest-start_block)*100;
    printf "Current: %d | Latest: %d | Speed: %.2f blk/s | ETA: %.1f days | Progress: %.2f%%",
      last_block,latest,speed,eta_days,progress
}')

# Format message for Slack
HOSTNAME=$(hostname)
CURRENT_DATE=$(date "+%Y-%m-%d")
SLACK_MESSAGE="*Daily Sync Status:* $CURRENT_DATE\n"
SLACK_MESSAGE+="*Host:* \`$HOSTNAME\` | *Container:* \`$CONTAINER_NAME\` ($CONTAINER_IMAGE)\n"
SLACK_MESSAGE+="$SYNC_INFO"

# Send to Slack
curl -s -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"$SLACK_MESSAGE\"}" \
  "$SLACK_WEBHOOK"

echo -e "Daily sync status sent to Slack"
