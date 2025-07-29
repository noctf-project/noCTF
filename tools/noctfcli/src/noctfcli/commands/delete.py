import click

from noctfcli.client import create_client

from .common import CLIContextObj, console, handle_errors


@click.command()
@click.argument("challenge_slug")
@click.pass_obj
@handle_errors
async def delete(ctx: CLIContextObj, challenge_slug: str) -> None:
    """Delete a challenge."""

    async with create_client(ctx.config) as client:
        challenge = await client.get_challenge(challenge_slug)
        if not click.confirm(
            f"Are you sure you want to delete challenge '{challenge.title}' ({challenge.slug})?",
        ):
            console.print("Cancelled")
            return

        await client.delete_challenge(challenge_slug)
        console.print(
            f"[green]Deleted challenge: {challenge.title} ({challenge.slug})[/green]",
        )
