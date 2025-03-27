# sflr-subgraph

a blockchain indexing service for the flare network.

## deployment

```sh
ssh root@helhetz01.romenet.io
cd /opt/sceptre/sflr-subgraph
docker compose -f docker-compose.prod.yaml up -d
```

the subgraph performs graceful updates when the version in docker-compose.yaml is incremented.

## limitations

the subgraph has limited capability for indexing native flr transactions as no events are emitted. for displaying these transactions, use the flare networks api in the frontend and combine with subgraph data:

```
https://flare-explorer.flare.network/api?module=account&action=txlist&address=0x813aef302ebad333eddef619c6f8ed7fef51ba7c&startblock=23664754&endblock=99999999&sort=asc
```

## monitoring sync state

```sh
./scripts/syncstate.sh 2d92b6920e93
start: 23664754, first: 23664754, current: 23717270, latest: 38704972, synced: 52516, speed: 20.84 blk/s, remaining: 14987702, eta: 199.78 hrs, progress: 0.3492%
```

## deploy to goldsky
```sh
yarn
yarn codegen
yarn build
goldsky subgraph deploy sflr-subgraph/0.1.5 --path .
```
