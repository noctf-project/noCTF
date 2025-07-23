# noCTF Static Exporter

A Python CLI tool to export all public CTF data from a noCTF instance to static JSON files for archival or offline viewing.

## Features

- Exports all public CTF data including teams, users, challenges, scoreboards, and announcements
- Supports authentication with bearer tokens
- Handles pagination automatically
- Includes rate limiting and retry logic
- Comprehensive error handling and logging
- Selective export options for specific data types

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Export All Data

```bash
python static_exporter.py https://ctf.example.com --token YOUR_TOKEN
```

### Export to Custom Directory

```bash
python static_exporter.py https://ctf.example.com --output /path/to/export
```

### Export Specific Data Types

```bash
# Export only teams and challenges
python static_exporter.py https://ctf.example.com --teams --challenges

# Export scoreboards and announcements
python static_exporter.py https://ctf.example.com --scoreboards --announcements
```

### Command Line Options

- `base_url`: Base URL of the noCTF API (required)
- `--token`: Bearer token for API authentication
- `--output, -o`: Output directory for exported files (default: export)
- `--verbose, -v`: Enable verbose logging

#### Selective Export Options

- `--config`: Export site configuration
- `--divisions`: Export divisions
- `--team-tags`: Export team tags
- `--teams`: Export teams
- `--users`: Export users
- `--challenges`: Export challenges
- `--solves`: Export challenge solves
- `--scoreboards`: Export scoreboards
- `--announcements`: Export announcements
- `--statistics`: Export statistics

## Exported Files

The tool creates the following JSON files:

- `site_config.json`: Site configuration and metadata
- `divisions.json`: Available divisions
- `team_tags.json`: Team tags
- `teams.json`: All teams data
- `users.json`: All users data
- `challenges.json`: Challenge list
- `challenge_details.json`: Detailed challenge information
- `challenge_solves.json`: Solve data for all challenges
- `scoreboards.json`: Scoreboard data for all divisions
- `team_scoreboards.json`: Individual team scoreboard details
- `announcements.json`: All announcements
- `statistics.json`: User and challenge statistics
- `export_metadata.json`: Export metadata and timestamp
- `export.log`: Export log file

## Authentication

The tool supports bearer token authentication. You can obtain a token by:

1. Logging into the noCTF web interface
2. Using the browser developer tools to inspect API requests
3. Copying the Authorization header value

## Rate Limiting

The tool includes built-in rate limiting to avoid overwhelming the API:

- 100ms delay between paginated requests
- 200ms delay between division scoreboard requests
- Automatic retry with exponential backoff for failed requests

## Error Handling

- Failed requests are logged and skipped
- Export continues even if some endpoints fail
- Comprehensive logging to both console and log file
- Graceful handling of authentication and permission errors