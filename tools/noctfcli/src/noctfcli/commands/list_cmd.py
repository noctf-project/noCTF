import click
from rich.table import Table

from noctfcli.client import create_client

from .common import CLIContextObj, console, handle_errors


@click.command(name="list")
@click.pass_obj
@handle_errors
async def list_challenges(ctx: CLIContextObj) -> None:
    """List all challenges."""

    async with create_client(ctx.config) as client:
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
