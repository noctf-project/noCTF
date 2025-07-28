import asyncio
import sys
from pathlib import Path
from typing import Optional
from functools import wraps

import click
from rich.console import Console
from rich.table import Table

from noctfcli.models import ChallengeFileAttachment
from noctfcli.utils import calculate_file_hash

from . import __version__
from .client import NoCTFClient
from .config import Config
from .exceptions import ConfigurationError, NoCTFError, NotFoundError
from .validator import ChallengeValidator

console = Console()


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


@click.group()
@click.version_option(version=__version__)
@click.option(
    "--config",
    type=click.Path(exists=True, path_type=Path),
    help="Configuration file path",
)
@click.option("--api-url", help="noCTF API base URL")
@click.option("--email", help="Admin email")
@click.option("--password", help="Admin password")
@click.option("--no-ssl-verify", is_flag=True, help="Disable SSL verification")
@click.pass_context
def cli(
    ctx: click.Context,
    config: Optional[Path],
    api_url: Optional[str],
    email: Optional[str],
    password: Optional[str],
    no_ssl_verify: bool,
) -> None:
    """noctfcli - CLI tool for noCTF challenge management."""

    try:
        app_config = Config.from_file(config) if config else Config.from_env()

        if api_url:
            app_config.api_url = api_url
        if email:
            app_config.email = email
        if password:
            app_config.password = password
        if no_ssl_verify:
            app_config.verify_ssl = False

        ctx.obj = app_config
    except ConfigurationError as e:
        console.print(f"[red]Configuration error:[/red] {e.message}")
        sys.exit(1)


@cli.command()
@click.pass_obj
@handle_errors
async def list(config: Config) -> None:
    """List all challenges."""

    async with NoCTFClient(
        config.api_url,
        timeout=config.timeout,
        verify_ssl=config.verify_ssl,
    ) as client:
        email, password = config.get_credentials()
        await client.login(email, password)

        challenges = await client.list_challenges()

        if not challenges:
            console.print("[yellow]No challenges found[/yellow]")
            return

        table = Table(title="Challenges")
        table.add_column("ID", style="cyan")
        table.add_column("Slug", style="green")
        table.add_column("Title", style="bold")
        table.add_column("Categories", style="blue")
        table.add_column("Hidden", style="red")
        table.add_column("Visible At", style="magenta")
        table.add_column("Updated", style="dim")

        # TODO: would be nice to use local timezone displays
        for challenge in challenges:
            categories = challenge.tags.get("categories", "unknown")
            hidden_text = "Yes" if challenge.hidden else "No"
            updated = challenge.updated_at.strftime("%Y-%m-%d %H:%M")
            visible_at = (
                "-"
                if challenge.visible_at is None
                else challenge.visible_at.strftime("%Y-%m-%d %H:%M")
            )

            table.add_row(
                str(challenge.id),
                challenge.slug,
                challenge.title,
                categories,
                hidden_text,
                visible_at,
                updated,
            )

        console.print(table)


@cli.command()
@click.argument("challenge_id")
@click.pass_obj
@handle_errors
async def show(config: Config, challenge_id: str) -> None:
    """Show detailed information about a challenge."""

    async with NoCTFClient(
        config.api_url,
        timeout=config.timeout,
        verify_ssl=config.verify_ssl,
    ) as client:
        email, password = config.get_credentials()
        await client.login(email, password)

        challenge, files = await client.get_challenge(challenge_id, with_files=True)

        console.print(f"[bold]Challenge: {challenge.title}[/bold]")
        console.print(f"ID: {challenge.id}")
        console.print(f"Slug: {challenge.slug}")
        console.print(f"Categories: {challenge.tags.get('categories', 'unknown')}")
        console.print(f"Difficulty: {challenge.tags.get('difficulty', 'unknown')}")
        console.print(f"Hidden: {'Yes' if challenge.hidden else 'No'}")
        console.print(f"Version: {challenge.version}")
        console.print(f"Created: {challenge.created_at}")
        console.print(f"Updated: {challenge.updated_at}")

        if challenge.visible_at:
            console.print(f"Visible at: {challenge.visible_at}")

        console.print("\n[bold]Description:[/bold]")
        console.print(challenge.description)

        flags = challenge.flags
        if flags:
            console.print(f"\n[bold]Flags ({len(flags)}):[/bold]")
            for i, flag in enumerate(flags, 1):
                console.print(f"  {i}. {flag.data} ({flag.strategy})")

        if files:
            console.print(f"\n[bold]Files ({len(files)}):[/bold]")
            for file in files:
                size_mb = file.size / (1024 * 1024)
                console.print(
                    f"  • {file.filename} ({size_mb:.2f} MB) ({file.hash})",
                )


@cli.command()
@click.argument("yaml_path", type=click.Path(exists=True, path_type=Path))
@click.option("--dry-run", is_flag=True, help="Validate without uploading")
@click.pass_obj
@handle_errors
async def upload(
    config: Config,
    yaml_path: Path,
    dry_run: bool,
) -> None:
    """Upload a challenge from noctf.yaml file."""

    validator = ChallengeValidator()
    challenge_config = validator.validate_challenge_complete(yaml_path)

    console.print("[green]✓[/green] Challenge configuration is valid")

    if dry_run:
        console.print("[yellow]Dry run mode - no changes will be made[/yellow]")
        console.print(f"Would upload challenge: {challenge_config.title}")
        if challenge_config.files:
            console.print(f"Would upload {len(challenge_config.files)} files:")
            for file_path in challenge_config.files:
                console.print(f"  • {yaml_path.parent / file_path}")
        return

    async with NoCTFClient(
        config.api_url,
        timeout=config.timeout,
        verify_ssl=config.verify_ssl,
    ) as client:
        email, password = config.get_credentials()
        await client.login(email, password)

        try:
            await client.get_challenge(challenge_config.slug)
            console.print(
                f"[red]Error:[/red] Challenge with slug '{challenge_config.slug}' already exists",
            )
            console.print("Use 'noctfcli update' to update existing challenges")
            return
        except NotFoundError:
            pass

        uploaded_files = []
        if challenge_config.files:
            console.print(f"Uploading {len(challenge_config.files)} files...")
            base_path = yaml_path.parent
            uploaded_files = await client.upload_challenge_files(
                challenge_config,
                base_path,
            )
            console.print(f"[green]✓[/green] Uploaded {len(uploaded_files)} files")
        else:
            console.print("No files specified in config, not uploading any files")

        files = [
            ChallengeFileAttachment(id=f.id, is_attachment=True) for f in uploaded_files
        ]

        challenge = await client.create_challenge(challenge_config, files)

        console.print(f"[green]✓[/green] Created challenge: {challenge.title}")
        console.print(f"ID: {challenge.id}")
        console.print(f"Slug: {challenge.slug}")


@cli.command()
@click.argument("yaml_path", type=click.Path(exists=True, path_type=Path))
@click.option("--dry-run", is_flag=True, help="Validate without updating")
@click.pass_obj
@handle_errors
async def update(
    config: Config,
    yaml_path: Path,
    dry_run: bool,
) -> None:
    """Update an existing challenge from noctf.yaml file."""

    validator = ChallengeValidator()
    challenge_config = validator.validate_challenge_complete(yaml_path)

    console.print("[green]✓[/green] Challenge configuration is valid")

    if dry_run:
        console.print("[yellow]Dry run mode - no changes will be made[/yellow]")
        console.print(f"Would update challenge: {challenge_config.title}")
        # TODO: show existing files
        if challenge_config.files:
            console.print(f"Would upload {len(challenge_config.files)} files:")
            for file_path in challenge_config.files:
                console.print(f"  • {file_path}")
        return

    async with NoCTFClient(
        config.api_url,
        timeout=config.timeout,
        verify_ssl=config.verify_ssl,
    ) as client:
        email, password = config.get_credentials()
        await client.login(email, password)

        existing, existing_files = await client.get_challenge(
            challenge_config.slug, with_files=True
        )
        if not existing:
            console.print(
                f"[red]Error:[/red] Challenge with slug '{challenge_config.slug}' not found",
            )
            console.print("Use 'noctfcli upload' to create new challenges")
            return

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
                    f"File [bold]{fn}[/bold] exists and will not be reuploaded"
                )
                is_attachment = next(
                    ef for ef in existing.files if ef.id == existing_f.id
                ).is_attachment
                files.append(
                    ChallengeFileAttachment(
                        id=existing_f.id, is_attachment=is_attachment
                    )
                )
            else:
                console.print(
                    f"File [bold]{fn}[/bold] doesn't already exist or is different and will be uploaded"
                )
                to_upload.append(f)

        console.print(
            f"Have {len(files)} existing files, uploading {len(to_upload)} new/different files"
        )

        if to_upload:
            uploaded_files = await client.upload_challenge_files(
                challenge_config,
                yaml_path.parent,
            )
            console.print(f"[green]✓[/green] Uploaded {len(uploaded_files)} files")
            for f in uploaded_files:
                files.append(ChallengeFileAttachment(id=f.id, is_attachment=True))

        new_version = await client.update_challenge(
            existing.id,
            challenge_config,
            files,
            existing.version,
        )

        console.print(
            f"[green]✓[/green] Updated challenge: {challenge_config.title}",
        )
        console.print(f"ID: {existing.id}")
        console.print(f"Version: {existing.version} → {new_version}")


@cli.command()
@click.argument("yaml_path", type=click.Path(exists=True, path_type=Path))
def validate(yaml_path: Path) -> None:
    """Validate a noctf.yaml file."""
    validator = ChallengeValidator()

    try:
        challenge_config = validator.validate_challenge_complete(yaml_path)
        console.print("[green]✓[/green] Challenge configuration is valid")
        console.print(f"Title: {challenge_config.title}")
        console.print(f"Slug: {challenge_config.slug}")
        console.print(f"Categories: {challenge_config.categories}")
        console.print(f"Flags: {len(challenge_config.flags)}")
        console.print(f"Files: {len(challenge_config.files)}")
    except Exception as e:
        console.print(f"[red]✗[/red] Validation failed: {e}")
        sys.exit(1)


@cli.command()
@click.argument("slug")
@click.option("--confirm", is_flag=True, help="Skip confirmation prompt")
@click.pass_obj
@handle_errors
async def delete(config: Config, slug: str, confirm: bool) -> None:
    """Delete a challenge."""
    async with NoCTFClient(
        config.api_url,
        timeout=config.timeout,
        verify_ssl=config.verify_ssl,
    ) as client:
        email, password = config.get_credentials()
        await client.login(email, password)

        challenge = await client.get_challenge(slug)

        if not confirm:
            if not click.confirm(
                f"Are you sure you want to delete challenge '{challenge.title}' ({challenge.slug})?",
            ):
                console.print("Cancelled")
                return

        await client.delete_challenge(slug)
        console.print(f"[green]✓[/green] Deleted challenge: {challenge.title}")


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
