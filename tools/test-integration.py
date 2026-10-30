#!/usr/bin/env python3
"""Run real MySQL tests using an explicitly guarded test DSN; never print it."""
import os
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
values = {}
env_file = root / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip("\"'")
values.update(os.environ)
test_dsn = values.get("FASTPOSTER_TEST_MYSQL_DSN", "")
if not test_dsn:
    primary = values.get("MYSQL_DSN", "")
    test_dsn, replacements = re.subn(
        r"/fastposter(?=\?|$)", "/fastposter_test_integration", primary
    )
    if replacements != 1:
        sys.exit("Set FASTPOSTER_TEST_MYSQL_DSN to an independent fastposter_test_* database")
environment = dict(os.environ, FASTPOSTER_TEST_MYSQL_DSN=test_dsn)
args = sys.argv[1:] or ["-v"]
package = "./server/tests/integration"
if args[0:1] == ["--all-server"]:
    package = "./server/..."
    args = args[1:] or ["-v"]
sys.exit(subprocess.call(["go", "test", package, *args], cwd=root, env=environment))
