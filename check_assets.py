#!/usr/bin/env python3
"""Check that the packaged project has all required assets and basic GLB structure."""
import json, struct, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
checks=[]
def check(test,desc):
 checks.append((bool(test),desc))
 print(('OK  ' if test else 'FAIL')+desc)

def read_glb(path):
 data=path.read_bytes()
 assert len(data)>20, str(path)+' GLB is too short'
 magic,version,length=struct.unpack_from('<4sII',data)
 assert magic==b'glTF' and version==2 and length==len(data),str(path)+' invalid GLB header'
 chunk_length,chunk_type=struct.unpack_from('<II',data,12)
 assert chunk_type==0x4E4F534A,str(path)+' first chunk is not JSON'
 return json.loads(data[20:20+chunk_length].decode('utf-8'))

try:
 check((ROOT/'index.html').exists(),'主頁 index.html 存在')
 check((ROOT/'driver_prototype.js').exists(),'程序化 3D 駕駛程式存在')
 manifest=json.loads((ROOT/'assets/asset_manifest.json').read_text('utf-8'))
 check(len(manifest.get('driver_airbag_mount',[]))==3,'manifest 包含 3D 氣囊掛載座標')
 html=(ROOT/'index.html').read_text('utf-8')
 check('manifest.driver_airbag_mount' in (ROOT/'game.js').read_text('utf-8'),'game.js 讀取 manifest 的氣囊掛載點')
 check('game.js' in html,'主頁載入手機遊戲程式 game.js')
 check((ROOT/'manifest.webmanifest').exists(),'手機 PWA manifest 存在')
 for f in ['build/three.module.min.js','examples/jsm/controls/OrbitControls.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/utils/BufferGeometryUtils.js']:
  check((ROOT/'vendor/three'/f).is_file(),'本地 Three.js vendor/three/'+f+' 存在')
 check('cdn.jsdelivr.net' not in html and './vendor/three/' in html,'importmap 使用本地 Three.js（不依賴 CDN）')
 for f in ['sedan_cabin.glb','driver_airbag_animated.glb','driver_airbag_full.glb']:
  path=ROOT/'assets'/f
  check(path.exists(),f+' 存在')
  if path.exists():
   glb=read_glb(path)
   check(len(glb.get('meshes',[]))>=1,f+' 具有 mesh')
   if f=='driver_airbag_animated.glb':
    check(any(len(p.get('targets',[]))==4 for m in glb.get('meshes',[]) for p in m.get('primitives',[])),'動畫氣囊具有 4 個 morph targets')
    check(bool(glb.get('animations')),'動畫氣囊包含 GLB 動畫')
 for f in ['driver_front.png','driver_side.png','driver_back.png','driver_driving.png','driver_impact.png']:
  p=ROOT/'references'/f
  check(p.is_file() and p.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n',f+' 是 PNG 檔案')
 for f in ['preview.png','preview_no_bag.png','preview_deployed.png']:
  check((ROOT/'preview'/f).exists(),'預覽 '+f+' 存在')

except Exception as e:
 print('FAIL 驗證例外：',repr(e))
 sys.exit(1)
if not all(ok for ok,_ in checks):sys.exit(1)
print('全部通過，注意：此腳本只檢查結構，不表示瀏覽器渲染與動畫互動已實測。')
