---
sidebar_position: 3
---

# Quick Start

To get a quick instance up and running, you can either use the pre-built docker images which are on
GitHub container registry or build from source. However the database currently needs to be migrated
manually using the kysely CTL.

## Using Docker Compose
You can use the below docker compose commands to spin up a development environment.

```
docker compose -f docker-compose.deploy.yml build
docker compose -f docker-compose.deploy.yml up
```