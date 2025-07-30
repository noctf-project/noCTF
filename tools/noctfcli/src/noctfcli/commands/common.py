import asyncio
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import wraps
from pathlib import Path
from typing import Optional

from rich.console import Console

from noctfcli.client import NoCTFClient
from noctfcli.config import Config
from noctfcli.exceptions import NoCTFError
from noctfcli.models import (
    ChallengeConfig,
    ChallengeFileAttachment,
    UploadUpdateResult,
    UploadUpdateResultEnum,
)
from noctfcli.preprocessor import PreprocessorBase
from noctfcli.utils import find_challenge_files
from noctfcli.validator import ChallengeValidator

console = Console()


@dataclass
class CLIContextObj:
    config: Config
    preprocessor: Optional[PreprocessorBase]


def handle_errors(async_func):
    @wraps(async_func)
    def wrapper(*args, **kwargs):
        async def error_wrapped_async():
            try:
                return await async_func(*args, **kwargs)
            except NoCTFError as e:
                console.print(f"[red]Error:[/red] {e.message}")
                if e.details:
                    console.print(f"[dim]Details: {e.details}[/dim]")
                sys.exit(1)
            except Exception as e:
                console.print(f"[red]Unexpected error:[/red] {e}")
                sys.exit(1)

        return asyncio.run(error_wrapped_async())

    return wrapper


class ChallengeProcessor(ABC):
    def __init__(
        self,
        client: NoCTFClient,
        console: Console,
        preprocessor: Optional[PreprocessorBase] = None,
    ):
        self.client = client
        self.console = console
        self.preprocessor = preprocessor
        self.validator = ChallengeValidator()

    async def process_challenges(
        self,
        challenges_directory: Path,
        dry_run: bool = False,
    ) -> list[UploadUpdateResult]:
        results = []

        if dry_run:
            self.console.print(
                "[yellow]Dry run mode - no changes will be made[/yellow]",
            )

        yaml_files = find_challenge_files(challenges_directory)
        for yaml_path in yaml_files:
            try:
                challenge_config = self.validator.validate_challenge_complete(yaml_path)
                if self.preprocessor:
                    challenge_config = self.preprocessor.preprocess(challenge_config)

                if dry_run:
                    self._handle_dry_run(challenge_config, yaml_path)
                    continue

                result = await self._process_single_challenge(
                    challenge_config,
                    yaml_path,
                )
                results.append(result)

            except Exception as e:
                results.append(
                    UploadUpdateResult(
                        challenge=yaml_path.parent.name,
                        status=UploadUpdateResultEnum.FAILED,
                        error=str(e),
                    ),
                )
                self.console.print(
                    f"[red]Error processing challenge {yaml_path}: {e}[/red]",
                )

        return results

    def _handle_dry_run(
        self,
        challenge_config: ChallengeConfig,
        yaml_path: Path,
    ) -> None:
        action = self._get_action_verb()
        self.console.print(f"Would {action} challenge: {challenge_config.title}")
        if challenge_config.files:
            self.console.print(
                f"Would upload {len(challenge_config.files)} files:",
            )
            for file_path in challenge_config.files:
                self.console.print(f"  • {yaml_path.parent / file_path}")

    async def _upload_files(
        self,
        challenge_config: ChallengeConfig,
        yaml_path: Path,
    ) -> list[ChallengeFileAttachment]:
        if not challenge_config.files:
            self.console.print(
                "\tNo files specified in config, not uploading any files",
            )
            return []

        self.console.print(f"\tUploading {len(challenge_config.files)} files...")
        base_path = yaml_path.parent
        uploaded_files = await self.client.upload_challenge_files(
            challenge_config,
            base_path,
        )
        self.console.print(
            f"\t[green]Uploaded {len(uploaded_files)} files[/green]",
        )

        return [
            ChallengeFileAttachment(id=f.id, is_attachment=True) for f in uploaded_files
        ]

    @abstractmethod
    async def _process_single_challenge(
        self,
        challenge_config: ChallengeConfig,
        yaml_path: Path,
    ) -> UploadUpdateResult:
        pass

    @abstractmethod
    def _get_action_verb(self) -> str:
        pass
