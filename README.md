# sflr-subgraph

## deploy
```sh
ssh root@helhetz01.romenet.io
cd /opt/sceptre/sflr-subgraph
docker compose -f docker-compose.prod.yaml up -d
```

note out that the subgraph does graceful updates as long as we pump
the version in the docker-compose.yaml file.
