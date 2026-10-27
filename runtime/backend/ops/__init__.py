"""新能源智库运营入口。命令：python -m ops preflight|status，python -m ops run daily。"""
__all__ = ["main"]


def main(argv: list[str] | None = None) -> int:
    from ops.cli import main as cli_main
    return cli_main(argv)
