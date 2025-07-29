from pathlib import Path
from typing import List

import click
from noctfcli.validator import ChallengeValidator

from noctfcli.models import UploadUpdateResult, UploadUpdateResultEnum
from noctfcli.utils import (
    find_challenge_files,
    print_results_summary,
)

from .common import console


@click.command()
@click.argument(
    "challenges_directory",
    type=click.Path(exists=True, path_type=Path, file_okay=False, dir_okay=True),
)
def validate(challenges_directory: Path) -> None:
    """Validate all noctf.yaml files in a directory."""

    results: List[UploadUpdateResult] = []
    validator = ChallengeValidator()

    yaml_files = find_challenge_files(challenges_directory)
    for yaml_path in yaml_files:
        try:
            challenge_config = validator.validate_challenge_complete(yaml_path)

            console.print(
                f"[blue]Validating challenge {challenge_config.slug}...[/blue]",
            )
            console.print("\t[green]✓[/green] Challenge configuration is valid")
            console.print(f"\tTitle: {challenge_config.title}")
            console.print(f"\tSlug: {challenge_config.slug}")
            console.print(f"\tCategories: {challenge_config.categories}")
            console.print(f"\tFlags: {challenge_config.flags}")
            console.print(f"\tFiles: {challenge_config.files}")

            results.append(
                UploadUpdateResult(
                    challenge=challenge_config.slug,
                    status=UploadUpdateResultEnum.VALIDATED,
                ),
            )

        except Exception as e:
            results.append(
                UploadUpdateResult(
                    challenge=yaml_path.parent.name,
                    status=UploadUpdateResultEnum.FAILED,
                    error=str(e),
                ),
            )
            console.print(f"[red]Error validating challenge {yaml_path}: {e}[/red]")

    print_results_summary(console, results)
