"""Teach Python's built-in server the right JavaScript type.

Windows sometimes registers .js as plain text. Browsers then refuse to
load ES modules from `python -m http.server`. This file runs only when
you start Python with this folder as the current directory, and only if
Python does not already have another sitecustomize module.

If the game page stays blank, run `py serve.py` instead.
"""

try:
    import mimetypes

    mimetypes.add_type("text/javascript", ".js", strict=True)
    mimetypes.add_type("text/javascript", ".mjs", strict=True)
    mimetypes.add_type("text/css", ".css", strict=True)
    mimetypes.add_type("image/svg+xml", ".svg", strict=True)
except Exception:
    pass
