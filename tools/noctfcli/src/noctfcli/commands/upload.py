from pathlib import Path
from typing import List

import click

from noctfcli.config import Config
from noctfcli.exceptions import NotFoundError
from noctfcli.models import (
    ChallengeFileAttachment,
    UploadUpdateResult,
    UploadUpdateResultEnum,
)
from noctfcli.client import create_client
from noctfcli.validator import ChallengeValidator
from noctfcli.utils import (
    find_challenge_files,
    print_results_summary,
)
from .common import (
    console,
    handle_errors,
)


@click.command()
@click.argument(
    "challenges_directory",
    type=click.Path(exists=True, path_type=Path, file_okay=False, dir_okay=True),
)
@click.option("--dry-run", is_flag=True, help="Validate without uploading")
@click.pass_obj
@handle_errors
async def upload(
    config: Config,
    challenges_directory: Path,
    dry_run: bool,
) -> None:
    """Upload all challenge from a directory."""

    results: List[UploadUpdateResult] = []
    async with create_client(config) as client:
        validator = ChallengeValidator()

        yaml_files = find_challenge_files(challenges_directory)
        for yaml_path in yaml_files:
            try:
                challenge_config = validator.validate_challenge_complete(yaml_path)

                if dry_run:
                    console.print(
                        "[yellow]Dry run mode - no changes will be made[/yellow]",
                    )
                    console.print(f"Would upload challenge: {challenge_config.title}")
                    if challenge_config.files:
                        console.print(
                            f"Would upload {len(challenge_config.files)} files:",
                        )
                        for file_path in challenge_config.files:
                            console.print(f"  • {yaml_path.parent / file_path}")
                    continue

                try:
                    await client.get_challenge(challenge_config.slug)
                    console.print(
                        f"[yellow]Warning: Challenge with slug '{challenge_config.slug}' already exists.[/yellow] [dim]Use 'noctfcli update' to update existing challenges[/dim]",
                    )
                    results.append(
                        UploadUpdateResult(
                            challenge=challenge_config.slug,
                            status=UploadUpdateResultEnum.SKIPPED,
                        ),
                    )
                    continue
                except NotFoundError:
                    pass

                console.print(
                    f"[blue]Uploading challenge {challenge_config.slug}...[/blue]",
                )

                uploaded_files = []
                if challenge_config.files:
                    console.print(f"\tUploading {len(challenge_config.files)} files...")
                    base_path = yaml_path.parent
                    uploaded_files = await client.upload_challenge_files(
                        challenge_config,
                        base_path,
                    )
                    console.print(
                        f"\t[green]Uploaded {len(uploaded_files)} files[/green]",
                    )
                else:
                    console.print(
                        "\tNo files specified in config, not uploading any files",
                    )

                files = [
                    ChallengeFileAttachment(id=f.id, is_attachment=True)
                    for f in uploaded_files
                ]

                challenge = await client.create_challenge(challenge_config, files)

                results.append(
                    UploadUpdateResult(
                        challenge=challenge_config.slug,
                        status=UploadUpdateResultEnum.UPLOADED,
                    ),
                )

                console.print(
                    f"\t[green]Created challenge: {challenge.title}[/green] (ID: {challenge.id}, slug: {challenge.slug})",
                )
            except Exception as e:
                results.append(
                    UploadUpdateResult(
                        challenge=str(yaml_path),
                        status=UploadUpdateResultEnum.FAILED,
                        error=str(e),
                    ),
                )
                console.print(f"[red]Error uploading challenge {yaml_path}: {e}[/red]")

    print_results_summary(console, results)
