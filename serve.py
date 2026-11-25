#!/usr/bin/env python3
"""Sky Slam static server with JavaScript MIME types forced on.

Same idea as `python -m http.server`, but .js is always text/javascript.
Use this if start.bat opens a blank page:

    py serve.py 8477
"""

import http.server
import mimetypes
import os
import sys

mimetypes.add_type("text/javascript", ".js", strict=True)
mimetypes.add_type("text/javascript", ".mjs", strict=True)
mimetypes.add_type("text/css", ".css", strict=True)
mimetypes.add_type("image/svg+xml", ".svg", strict=True)

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8477
bind = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
print(f"Sky Slam at http://{bind}:{port}/")
http.server.test(
    HandlerClass=http.server.SimpleHTTPRequestHandler,
    port=port,
    bind=bind,
)
