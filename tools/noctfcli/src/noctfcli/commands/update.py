from pathlib import Path
from typing import List

import click

from noctfcli.exceptions import NotFoundError
from noctfcli.validator import ChallengeValidator
from noctfcli.models import (
    ChallengeFileAttachment,
    UploadUpdateResult,
    UploadUpdateResultEnum,
)
from noctfcli.client import create_client
from noctfcli.utils import (
    calculate_file_hash,
    find_challenge_files,
    print_results_summary,
)
from .common import CLIContextObj, console, handle_errors


@click.command()
@click.argument(
    "challenges_directory",
    type=click.Path(exists=True, path_type=Path, file_okay=False, dir_okay=True),
)
@click.option("--dry-run", is_flag=True, help="Validate without updating")
@click.pass_obj
@handle_errors
async def update(
    ctx: CLIContextObj,
    challenges_directory: Path,
    dry_run: bool,
) -> None:
    """Update existing challenges from a directory."""

    results: List[UploadUpdateResult] = []
    async with create_client(ctx.config) as client:
        validator = ChallengeValidator()

        yaml_files = find_challenge_files(challenges_directory)
        for yaml_path in yaml_files:
            try:
                challenge_config = validator.validate_challenge_complete(yaml_path)
                if ctx.preprocessor:
                    challenge_config = ctx.preprocessor.preprocess(challenge_config)

                if dry_run:
                    console.print(
                        "[yellow]Dry run mode - no changes will be made[/yellow]",
                    )
                    console.print(f"Would update challenge: {challenge_config.title}")
                    if challenge_config.files:
                        console.print(
                            f"Would upload {len(challenge_config.files)} files:",
                        )
                        for file_path in challenge_config.files:
                            console.print(f"  • {yaml_path.parent / file_path}")
                    continue

                try:
                    existing, existing_files = await client.get_challenge(
                        challenge_config.slug,
                        with_files=True,
                    )
                except NotFoundError:
                    console.print(
                        f"[yellow]Warning: Challenge with slug '{challenge_config.slug}' not found.[/yellow] [dim]Use 'noctfcli upload' to create new challenges[/dim]",
                    )
                    results.append(
                        UploadUpdateResult(
                            challenge=challenge_config.slug,
                            status=UploadUpdateResultEnum.SKIPPED,
                            error="Challenge not found",
                        ),
                    )
                    continue

                console.print(
                    f"[blue]Updating challenge {challenge_config.slug}...[/blue]",
                )

                files = []
                to_upload = []
                for f in challenge_config.files:
                    h = calculate_file_hash(yaml_path.parent / f)
                    fn = Path(f).name
                    existing_f = next(
                        (
                            ef
                            for ef in existing_files
                            if ef.filename == fn and ef.hash == f"sha256:{h}"
                        ),
                        None,
                    )
                    if existing_f:
                        console.print(
                            f"\tFile [bold]{fn}[/bold] exists and will not be reuploaded",
                        )
                        is_attachment = next(
                            ef for ef in existing.files if ef.id == existing_f.id
                        ).is_attachment
                        files.append(
                            ChallengeFileAttachment(
                                id=existing_f.id,
                                is_attachment=is_attachment,
                            ),
                        )
                    else:
                        console.print(
                            f"\tFile [bold]{fn}[/bold] doesn't already exist or is different and will be uploaded",
                        )
                        to_upload.append(f)

                if to_upload:
                    console.print(
                        f"\tUploading {len(to_upload)} new/different files...",
                    )
                    uploaded_files = await client.upload_challenge_files(
                        challenge_config,
                        yaml_path.parent,
                    )
                    console.print(
                        f"\t[green]Uploaded {len(uploaded_files)} files[/green]",
                    )
                    for f in uploaded_files:
                        files.append(
                            ChallengeFileAttachment(id=f.id, is_attachment=True),
                        )
                else:
                    console.print("\tNo new files to upload")

                new_version = await client.update_challenge(
                    existing.id,
                    challenge_config,
                    files,
                    existing.version,
                )

                results.append(
                    UploadUpdateResult(
                        challenge=challenge_config.slug,
                        status=UploadUpdateResultEnum.UPDATED,
                    ),
                )

                console.print(
                    f"\t[green]Updated challenge: {challenge_config.title}[/green] (ID: {existing.id}, version: {existing.version} → {new_version})",
                )

            except Exception as e:
                results.append(
                    UploadUpdateResult(
                        challenge=str(yaml_path),
                        status=UploadUpdateResultEnum.FAILED,
                        error=str(e),
                    ),
                )
                console.print(f"[red]Error updating challenge {yaml_path}: {e}[/red]")

    print_results_summary(console, results)
