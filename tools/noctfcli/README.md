# noctfcli

CLI tool and Python library for noCTF challenge management.

## Installation

```bash
cd tools/noctfcli
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Configuration

Using a configuration file:

```yaml
# config.yaml
api_url: "http://localhost:8000"
email: "admin@example.com"
password: "your-password"
```

Or using environment variables:

```bash
export NOCTF_API_URL="http://localhost:8000"
export NOCTF_EMAIL="admin@example.com"
export NOCTF_PASSWORD="your-password"
```

## Challenge Format (`noctf.yaml`)

See [`noctf.yaml.schema.json`](./noctf.yaml.schema.json) for the full JSON schema.

```yaml
version: "1.0"
slug: yet-another-login
title: yet another login
categories: ["crypto"]
description: |
  Yet another login task... Authenticate as admin to get the flag!

  Author: joseph
difficulty: easy
flags:
  - DUCTF{now_that_youve_logged_in_its_time_to_lock_in}
files:
  - ./publish/chall.py
connection_info: nc ${host} ${port}
```

## CLI Usage

```
Usage: noctfcli [OPTIONS] COMMAND [ARGS]...

  noctfcli - CLI tool for noCTF challenge management.

Options:
  --version        Show the version and exit.
  --config PATH    Configuration file path
  --api-url TEXT   noCTF API base URL
  --email TEXT     Admin email
  --password TEXT  Admin password
  --no-ssl-verify  Disable SSL verification
  --help           Show this message and exit.

Commands:
  delete    Delete a challenge.
  list      List all challenges.
  show      Show detailed information about a challenge.
  update    Update an existing challenge from noctf.yaml file.
  upload    Upload a challenge from noctf.yaml file.
  validate  Validate a noctf.yaml file.
```
