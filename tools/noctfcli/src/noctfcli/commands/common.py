import asyncio
import sys
from dataclasses import dataclass
from functools import wraps
from typing import Optional

from rich.console import Console

from noctfcli.config import Config
from noctfcli.exceptions import NoCTFError
from noctfcli.preprocessor import PreprocessorBase

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
