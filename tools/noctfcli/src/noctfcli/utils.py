import yaml
import hashlib
import os
from pathlib import Path
from pathlib import Path
from typing import Any, Dict, List

from rich.console import Console
from noctfcli.exceptions import ConfigurationError
from noctfcli.models import UploadUpdateResult, UploadUpdateResultEnum


def find_challenge_files(directory_path: Path) -> List[Path]:
    challenge_files = []

    if not directory_path.exists():
        raise FileNotFoundError(f"Directory not found: {directory_path}")

    if not directory_path.is_dir():
        raise NotADirectoryError(f"Path is not a directory: {directory_path}")

    for root, _, files in os.walk(directory_path):
        for file in files:
            if file == "noctf.yaml":
                challenge_files.append(Path(root) / file)

    return challenge_files


def load_yaml_file(file_path: str) -> Dict[str, Any]:
    try:
        with open(file_path) as f:
            return yaml.safe_load(f)
    except Exception as e:
        raise ConfigurationError(f"Error loading YAML file {file_path}: {e}") from e


def calculate_file_hash(file_path: Path) -> str:
    """Calculate SHA256 hash of a file.

    Args:
        file_path: Path to the file

    Returns:
        Hexadecimal hash string
    """

    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def print_results_summary(console: Console, results: List[UploadUpdateResult]):
    success_count = sum(
        1
        for r in results
        if r.status
        in [
            UploadUpdateResultEnum.UPLOADED,
            UploadUpdateResultEnum.UPDATED,
            UploadUpdateResultEnum.VALIDATED,
        ]
    )
    skipped_count = sum(
        1 for r in results if r.status == UploadUpdateResultEnum.SKIPPED
    )
    failed_count = sum(1 for r in results if r.status == UploadUpdateResultEnum.FAILED)

    console.print()
    console.print(f"[bold]Summary:[/bold]")
    console.print(f"  [green]Success: {success_count}[/green]")

    if skipped_count > 0:
        console.print(f"  [yellow]Skipped: {skipped_count}[/yellow]")

    if failed_count > 0:
        console.print(f"  [red]Failed: {failed_count}[/red]")
        console.print("\n[red]Failed challenges:[/red]")
        for result in results:
            if result.status == UploadUpdateResultEnum.FAILED:
                error = result.error or "unknown error"
                console.print(f"  - {result.challenge}: {error}")

    console.print()
