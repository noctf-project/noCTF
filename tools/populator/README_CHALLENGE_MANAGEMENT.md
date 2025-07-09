# Challenge Management Tools

This directory contains tools for managing CTF challenges in noCTF.

## Files

### Core Files

- `client.py` - Main API client for interacting with noCTF
- `lib/challenge_utils.py` - Common utilities for challenge operations

### Scripts

- `challenge_upload.py` - Upload new challenges from YAML files
- `challenge_update.py` - Update existing challenges from YAML files

## Usage

### Uploading Challenges

To upload new challenges:

```bash
# Upload all challenges from a directory
python challenge_upload.py \
  --base-url http://localhost:3000 \
  --email admin@example.com \
  --password adminpass \
  --directory ./challenge_configs \
  --upload_files

# Upload a single challenge file
python challenge_upload.py \
  --base-url http://localhost:3000 \
  --email admin@example.com \
  --password adminpass \
  --file ./challenge_configs/my_challenge.yml \
  --upload_files
```

### Updating Challenges

To update existing challenges (creates new ones if they don't exist):

```bash
# Update all challenges from a directory
python challenge_update.py \
  --base-url http://localhost:3000 \
  --email admin@example.com \
  --password adminpass \
  --directory ./challenge_configs \
  --upload_files

# Update a single challenge file
python challenge_update.py \
  --base-url http://localhost:3000 \
  --email admin@example.com \
  --password adminpass \
  --file ./challenge_configs/my_challenge.yml \
  --upload_files
```

## Challenge YAML Format

Challenges should be defined in YAML files with the following structure:

```yaml
id: challenge-slug
name: Challenge Title
description: Challenge description with markdown support
category: web
tags: [easy, medium, hard]
flag: ["flag{example}", "flag{alternative}"]
files: ["file1.txt", "file2.zip"]
```

## Features

- **Upload/Update**: Both scripts support uploading files as attachments
- **Batch Processing**: Process entire directories of challenge files
- **Error Handling**: Graceful error handling with detailed reporting
- **Common Utilities**: Shared functionality extracted to `lib/challenge_utils.py`

## Differences Between Upload and Update

- **Upload**: Always creates new challenges, fails if challenge with same slug exists
- **Update**: Updates existing challenges by slug, creates new ones if they don't exist
