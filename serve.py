"""Crash Lab 本機測試伺服器。
（刻意不寫 #!/usr/bin/env python3：Windows 的 py 啟動器會依此找 python3，
可能叫到 Microsoft Store 的空殼而直接結束。）

為什麼不用 `python -m http.server`：Python 內建伺服器不認得 .glb，會以
application/octet-stream 傳送；部分防毒／網路防護軟體會把它當成可疑下載而中斷連線，
導致遊戲卡在載入。這裡補上正確的 MIME 類型（與 GitHub Pages 相同），
並加上 no-cache 讓手機重新整理時能拿到最新程式。

用法：py serve.py [連接埠，預設 8765]
"""
import functools
import http.server
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.wasm': 'application/wasm',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def lan_addresses():
    found = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('10.255.255.255', 1))
            found.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in found if not ip.startswith('127.'))


def main():
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), handler)
    print(f'Crash Lab 本機伺服器已啟動：http://localhost:{PORT}')
    for ip in lan_addresses():
        print(f'  同一 Wi-Fi 的手機請開啟：http://{ip}:{PORT}')
    print('關閉此視窗或按 Ctrl+C 即可停止。')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
