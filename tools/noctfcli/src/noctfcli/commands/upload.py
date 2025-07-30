from pathlib import Path

import click

from noctfcli.client import create_client
from noctfcli.exceptions import NotFoundError
from noctfcli.models import (
    ChallengeConfig,
    UploadUpdateResult,
    UploadUpdateResultEnum,
)
from noctfcli.utils import print_results_summary

from .common import CLIContextObj, ChallengeProcessor, console, handle_errors


class UploadProcessor(ChallengeProcessor):
    def _get_action_verb(self) -> str:
        return "upload"

    async def _process_single_challenge(
        self,
        challenge_config: ChallengeConfig,
        yaml_path: Path,
    ) -> UploadUpdateResult:
        try:
            await self.client.get_challenge(challenge_config.slug)
            self.console.print(
                f"[yellow]Warning: Challenge with slug '{challenge_config.slug}' already exists.[/yellow] [dim]Use 'noctfcli update' to update existing challenges[/dim]",
            )
            return UploadUpdateResult(
                challenge=challenge_config.slug,
                status=UploadUpdateResultEnum.SKIPPED,
            )
        except NotFoundError:
            pass

        self.console.print(
            f"[blue]Uploading challenge {challenge_config.slug}...[/blue]",
        )

        files = await self._upload_files(challenge_config, yaml_path)

        challenge = await self.client.create_challenge(challenge_config, files)

        self.console.print(
            f"\t[green]Created challenge: {challenge.title}[/green] (ID: {challenge.id}, slug: {challenge.slug})",
        )

        return UploadUpdateResult(
            challenge=challenge_config.slug,
            status=UploadUpdateResultEnum.UPLOADED,
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
    ctx: CLIContextObj,
    challenges_directory: Path,
    dry_run: bool,
) -> None:
    """Upload all challenge from a directory."""

    async with create_client(ctx.config) as client:
        processor = UploadProcessor(client, console, ctx.preprocessor)
        results = await processor.process_challenges(challenges_directory, dry_run)

    print_results_summary(console, results)
