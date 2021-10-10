# noCTF


## Developing

### Getting started

```
$ yarn install
$ yarn workspace noctf-server run dev-setup
$ docker-compose -f docker-compose.dev.yaml up --build
```

Goto https://localhost:3000/api/docs and ignore the SSL warnings. A certificate is present in `data/secrets/https` if you would like to install it.
