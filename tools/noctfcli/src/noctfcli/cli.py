import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console

from noctfcli import __version__
from noctfcli.config import Config
from noctfcli.exceptions import ConfigurationError

from noctfcli.commands.list_cmd import list_challenges
from noctfcli.commands.show import show
from noctfcli.commands.upload import upload
from noctfcli.commands.update import update
from noctfcli.commands.validate import validate
from noctfcli.commands.delete import delete


def build_cli():
    console = Console()

    @click.group()
    @click.version_option(version=__version__)
    @click.option(
        "--config",
        type=click.Path(exists=True, path_type=Path),
        help="Configuration file path",
    )
    @click.pass_context
    def cli(
        ctx: click.Context,
        config: Optional[Path],
    ) -> None:
        """noctfcli - CLI tool for noCTF challenge management."""

        try:
            app_config = Config.from_file(config) if config else Config.from_env()
            ctx.obj = app_config
        except ConfigurationError as e:
            console.print(f"[red]Configuration error:[/red] {e.message}")
            sys.exit(1)

    cli.add_command(list_challenges)
    cli.add_command(show)
    cli.add_command(upload)
    cli.add_command(update)
    cli.add_command(validate)
    cli.add_command(delete)

    return cli


def main() -> None:
    cli = build_cli()
    cli()


if __name__ == "__main__":
    main()
