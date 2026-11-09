#!/usr/bin/env python3
"""Blender MCP bridge client (blender_mcp_addon, port 9876).

Usage:
  python3 tools/bl.py -c "result = {'v': bpy.app.version_string}"
  python3 tools/bl.py file.py [file2.py ...]     # each file's text is sent as one request
Prints the JSON response; exit code 1 on status != ok.
"""
import json, socket, sys

HOST, PORT = "127.0.0.1", 9876

def send(code, timeout=3600):
    s = socket.create_connection((HOST, PORT), timeout=timeout)
    s.sendall((json.dumps({"type": "execute", "code": code, "strict_json": False}) + "\0").encode())
    buf = bytearray()
    while b"\0" not in buf:
        chunk = s.recv(1 << 16)
        if not chunk:
            break
        buf += chunk
    s.close()
    return json.loads(bytes(buf[:buf.index(b"\0")]) if b"\0" in buf else bytes(buf))

if __name__ == "__main__":
    args = sys.argv[1:]
    codes = [args[1]] if args[:1] == ["-c"] else [open(p).read() for p in args]
    bad = False
    for code in codes:
        r = send(code)
        for k in ("stdout", "stderr"):
            if r.get(k):
                sys.stdout.write(r[k])
        if r.get("status") != "ok":
            print("ERROR:", r.get("message")); bad = True
        else:
            print(json.dumps(r.get("result"), ensure_ascii=False))
    sys.exit(1 if bad else 0)
