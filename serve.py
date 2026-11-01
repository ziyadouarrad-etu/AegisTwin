"""Tiny static server for the production-line visualiser.

Usage:
    python serve.py [port]      (default port: 8000)
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


class LineRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".gltf": "model/gltf+json",
        ".glb": "model/gltf-binary",
        ".bin": "application/octet-stream",
        ".js": "text/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1]) not in ("200", "304"):
            super().log_message(fmt, *args)


def main():
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}")
            raise SystemExit(2)

    socketserver.TCPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", port), LineRequestHandler) as httpd:
        print(f"Production line running at http://localhost:{port}/")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
