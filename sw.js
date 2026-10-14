// Optional PWA cache. Requires HTTPS or localhost. Everything the game needs (including Three.js in vendor/)
// is same-origin and precached on install, so after one online visit the game can start offline.
// Code/HTML/JSON: network-first, so updates appear on the next reload (cache is the offline fallback).
// GLB models, images and the version-pinned vendor/three/ files: cache-first, since they rarely change.
const CACHE='crashlab-mobile-v4';
const LOCAL=['./','./index.html','./game.js','./driver_prototype.js','./driver_motion.js','./driver_rigged.js','./manifest.webmanifest','./assets/asset_manifest.json','./assets/sedan_cabin.glb','./assets/driver_airbag_animated.glb','./icons/icon-192.png','./icons/icon-512.png',
 './vendor/three/build/three.module.min.js','./vendor/three/examples/jsm/controls/OrbitControls.js','./vendor/three/examples/jsm/loaders/GLTFLoader.js','./vendor/three/examples/jsm/utils/BufferGeometryUtils.js'];
self.addEventListener('install', event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(LOCAL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
function store(req,response){
 if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(req,clone)).catch(()=>{});}
 return response;
}
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 const stable=url.pathname.includes('/vendor/three/')||/\.(glb|png|jpg)$/i.test(url.pathname);
 if(stable){
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(r=>store(req,r))));
 }else{
  event.respondWith(fetch(req).then(r=>store(req,r)).catch(()=>caches.match(req).then(cached=>cached||Response.error())));
 }
});
