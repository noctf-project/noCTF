from pathlib import Path

import click

from noctfcli.client import create_client
from noctfcli.exceptions import NotFoundError
from noctfcli.models import (
    ChallengeConfig,
    ChallengeFileAttachment,
    ExternalFileConfig,
    UploadUpdateResult,
    UploadUpdateResultEnum,
)
from noctfcli.utils import (
    calculate_file_hash,
    filename_from_url,
    print_results_summary,
)

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
            if isinstance(f, ExternalFileConfig):
                fn = filename_from_url(f.url)
                expected_hash = f.hash
            else:
                fn = Path(f).name
                expected_hash = f"sha256:{calculate_file_hash(yaml_path.parent / f)}"
            existing_f = next(
                (
                    ef
                    for ef in existing_files
                    if ef.filename == fn and ef.hash == expected_hash
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
            for entry in to_upload:
                uploaded = await self.client.upload_file_entry(
                    entry,
                    yaml_path.parent,
                )
                files.append(
                    ChallengeFileAttachment(id=uploaded.id, is_attachment=True),
                )
            self.console.print(
                f"\t[green]Uploaded {len(to_upload)} files[/green]",
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
