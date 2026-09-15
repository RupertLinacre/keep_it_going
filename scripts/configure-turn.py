"""Read a dedicated Cloudflare TURN key without echoing or saving it locally."""
import getpass
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
token = getpass.getpass("Paste Cloudflare TURN API Token (hidden), then press Return: ").strip()
if not re.fullmatch(r"[a-fA-F0-9]{64}", token):
    raise SystemExit("Please paste only the 64-character API Token from the TURN app page; nothing was uploaded.")
subprocess.run(
    ["npm", "exec", "--yes", "--package=wrangler@4.131.2", "--", "wrangler", "secret", "bulk", "--config", "infra/turn/wrangler.jsonc"],
    cwd=root,
    input=json.dumps({"TURN_KEY_API_TOKEN": token}),
    text=True,
    check=True,
)
print("TURN credentials stored in Worker secrets; no local credential file created.")
