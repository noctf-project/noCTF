import click

from noctfcli.client import create_client

from .common import CLIContextObj, console, handle_errors


@click.command()
@click.argument("challenge_slug")
@click.pass_obj
@handle_errors
async def show(ctx: CLIContextObj, challenge_slug: str) -> None:
    """Show detailed information about a challenge."""

    async with create_client(ctx.config) as client:
        challenge, files = await client.get_challenge(challenge_slug, with_files=True)

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
