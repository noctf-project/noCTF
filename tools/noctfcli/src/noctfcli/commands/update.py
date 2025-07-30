from pathlib import Path

import click

from noctfcli.client import create_client
from noctfcli.exceptions import NotFoundError
from noctfcli.models import (
    ChallengeConfig,
    ChallengeFileAttachment,
    UploadUpdateResult,
    UploadUpdateResultEnum,
)
from noctfcli.utils import calculate_file_hash, print_results_summary

from .common import CLIContextObj, ChallengeProcessor, console, handle_errors


class UpdateProcessor(ChallengeProcessor):
    def _get_action_verb(self) -> str:
        return "update"

    async def _process_single_challenge(
        self,
        challenge_config: ChallengeConfig,
        yaml_path: Path,
    ) -> UploadUpdateResult:
        try:
            existing, existing_files = await self.client.get_challenge(
                challenge_config.slug,
                with_files=True,
            )
        except NotFoundError:
            self.console.print(
                f"[yellow]Warning: Challenge with slug '{challenge_config.slug}' not found.[/yellow] [dim]Use 'noctfcli upload' to create new challenges[/dim]",
            )
            return UploadUpdateResult(
                challenge=challenge_config.slug,
                status=UploadUpdateResultEnum.SKIPPED,
                error="Challenge not found",
            )

        self.console.print(
            f"[blue]Updating challenge {challenge_config.slug}...[/blue]",
        )

        files = await self._handle_file_updates(
            challenge_config,
            yaml_path,
            existing,
            existing_files,
        )

        new_version = await self.client.update_challenge(
            existing.id,
            challenge_config,
            files,
            existing.version,
        )

        self.console.print(
            f"\t[green]Updated challenge: {challenge_config.title}[/green] (ID: {existing.id}, version: {existing.version} → {new_version})",
        )

        return UploadUpdateResult(
            challenge=challenge_config.slug,
            status=UploadUpdateResultEnum.UPDATED,
        )

    async def _handle_file_updates(
        self,
        challenge_config: ChallengeConfig,
        yaml_path: Path,
        existing,
        existing_files,
    ) -> list[ChallengeFileAttachment]:
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
                self.console.print(
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
                self.console.print(
                    f"\tFile [bold]{fn}[/bold] doesn't already exist or is different and will be uploaded",
                )
                to_upload.append(f)

        if to_upload:
            self.console.print(
                f"\tUploading {len(to_upload)} new/different files...",
            )
            uploaded_files = await self.client.upload_challenge_files(
                challenge_config,
                yaml_path.parent,
            )
            self.console.print(
                f"\t[green]Uploaded {len(uploaded_files)} files[/green]",
            )
            for f in uploaded_files:
                files.append(
                    ChallengeFileAttachment(id=f.id, is_attachment=True),
                )
        else:
            self.console.print("\tNo new files to upload")

        return files


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

    async with create_client(ctx.config) as client:
        processor = UpdateProcessor(client, console, ctx.preprocessor)
        results = await processor.process_challenges(challenges_directory, dry_run)

    print_results_summary(console, results)
