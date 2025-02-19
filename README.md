# sflr-subgraph

## deploy
```sh
ssh root@helhetz01.romenet.io
cd /opt/sceptre/sflr-subgraph
docker compose -f docker-compose.prod.yaml up -d
```

note out that the subgraph does graceful updates as long as we pump
the version in the docker-compose.yaml file.


subgraph sucks balls for indexing native FLR transactions since no events is
emitted.
if we want to show these we should just use flare networks api 
in the frontend and combine those with our subgraph data.
```
https://flare-explorer.flare.network/api?module=account&action=txlist&address=0x813aef302ebad333eddef619c6f8ed7fef51ba7c&startblock=23664754&endblock=99999999&sort=asc
```
