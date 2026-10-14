/**
 * Crash Lab Mobile 0.3 — touch-first visual crash sandbox.
 * Uses Stage 1 sedan and steering-wheel airbag + Stage 2 procedural driver.
 * NOT physics-calibrated: all outcomes are illustrative, not safety/injury predictions.
 * 1 Three.js unit ~= 1m; Y up, -Z forward, driver X=-0.745.
 */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createDriverPrototype} from './driver_prototype.js';
import {createRiggedDriver} from './driver_rigged.js';
import {cabinAnchors} from './driver_motion.js';

const $ = (id) => document.getElementById(id);
const duration = 4.2;
const impactAt = 2.00;
const mobile = matchMedia('(pointer:coarse)').matches;
const config = {speed:60,impact:'front',belt:true,airbag:true};
const impactNames = {left:'左側偏撞',front:'正面撞牆',right:'右側偏撞'};
const impactOffset = {left:-1,front:0,right:1};
let clockTime=0, playing=false, finished=false, impactTriggered=false;
let loaded=false, canPlayAudio=false, audioContext=null;
let bagMesh=null, driver=null, vehicle=null, lastFrame=performance.now();
let activeCamera='rear';

function text(id, value){$(id).textContent=value;}
function setStatus(value){text('stateText',value);}
function showDrawer(yes){$('drawer').hidden=!yes; $('shade').hidden=!yes;if(yes)stopPlaying();}
function showResult(yes){$('result').hidden=!yes;$('shade').hidden=!yes;}
function disableLoading(error){
  if(!error){$('loading').hidden=true;return;}
  window.__crashlabFailed=true;
  $('loading').hidden=false;
  $('spinner').hidden=true;
  text('loadStatus',error);
  $('retry').hidden=false;
}
// Three.js (vendor/three/) has loaded once this module runs; the index.html timeout uses this stage flag.
window.__crashlabStage='assets';
text('loadStatus','正在下載 3D 車艙與氣囊模型…');

let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:false,powerPreference:'high-performance'});
}catch(e){
  disableLoading('此瀏覽器無法啟用 WebGL 3D 繪圖。\n\n請改用最新版 Chrome／Safari，並確認未開啟省電或停用硬體加速。');
  throw e;
}
// Phones: start at up to 1.35x, then let adaptQuality() trade resolution for frame rate (less heat, fewer context losses).
const maxPixelRatio=Math.min(devicePixelRatio||1,mobile?1.35:1.8), minPixelRatio=Math.min(maxPixelRatio,mobile?.7:1);
let pixelRatio=maxPixelRatio;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=false;
$('scene').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', event=>{event.preventDefault();stopPlaying();disableLoading('裝置的 WebGL 畫面中斷（可能是手機記憶體不足或過熱）。\n\n稍候會嘗試自動恢復；若沒有恢復，請按重新載入。');});
renderer.domElement.addEventListener('webglcontextrestored',()=>{window.__crashlabFailed=false;$('retry').hidden=true;$('spinner').hidden=false;disableLoading(null);invalidate();});
// Render on demand: a paused scene is drawn once, not 60 times a second.
let needsRender=true;
function invalidate(){needsRender=true;}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x112030);scene.fog=new THREE.Fog(0x112030,8,20);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.025,45);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.075;
controls.minDistance=.25;controls.maxDistance=5;
controls.enablePan=false;controls.rotateSpeed=mobile?.7:.75;
controls.zoomSpeed=.95;controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE};
scene.add(new THREE.HemisphereLight(0xdceeff,0x1b2831,2.7));
const key=new THREE.DirectionalLight(0xffffff,3.1);key.position.set(-2,4.5,2.5);scene.add(key);
const rim=new THREE.DirectionalLight(0x5baad2,1.25);rim.position.set(3,2,-2);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(22,22),new THREE.MeshStandardMaterial({color:0x172331,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;scene.add(ground);
const lineGrid=new THREE.GridHelper(14,14,0x254b60,0x213649);lineGrid.position.y=-.049;scene.add(lineGrid);
vehicle=new THREE.Group();vehicle.name='CRASH_SCENE_RIG';scene.add(vehicle);
// A visible test-wall prop approaches the windshield to stage the impact.
// The moving wall is a *relative-motion illusion*, not a rigid-body collision.
const barrier=new THREE.Group();barrier.name='TEST_BARRIER_VISUAL';scene.add(barrier);
const wallMat=new THREE.MeshStandardMaterial({color:0x8293a1,roughness:.91});
const darkMat=new THREE.MeshStandardMaterial({color:0x14191e,roughness:.9});
const stripeMat=new THREE.MeshStandardMaterial({color:0xf3a14a,roughness:.85});
const barrierFace=new THREE.Mesh(new THREE.BoxGeometry(4.6,1.9,.25),wallMat);barrierFace.position.y=.86;barrier.add(barrierFace);
const lineBase=new THREE.Mesh(new THREE.BoxGeometry(4.62,.16,.28),darkMat);lineBase.position.y=.43;barrier.add(lineBase);
// Second stripe row sits at windshield height (cabin glass spans y≈1.4–1.8) so the approach reads from inside the car.
for(const y of [.43,1.55])for(let i=-6;i<=6;i++){
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(.25,.19,.30),stripeMat);
 stripe.position.set(i*.35,y,.005);stripe.rotation.z=-.4;barrier.add(stripe);
}
barrier.position.z=-8.5;


const presets={
  rear:{pos:[.08,1.75,2.24],target:[-.32,1.18,-.41],fov:65},
  // Front-right of the driver over the console, outside the fully inflated bag (x ≤ -0.31): head, wheel and bag in 3/4 profile.
  // Portrait screens are narrow, so the close-up backs off over the passenger seat to keep head and bag in frame.
  wheel:{pos:[-.05,1.56,-.02],portraitPos:[.38,1.68,.14],target:[-.70,1.20,-.25],fov:70},
  side:{pos:[.48,1.56,.46],target:[-.70,1.20,-.16],fov:68},
};
function switchCamera(mode){
  activeCamera=mode;
  const p=presets[mode];if(!p)return;
  camera.position.set(...(p.portraitPos&&innerWidth<innerHeight?p.portraitPos:p.pos));camera.fov=p.fov;camera.updateProjectionMatrix();
  controls.target.set(...p.target);controls.update();invalidate();
  document.querySelectorAll('[data-cam]').forEach(b=>b.classList.toggle('active',b.dataset.cam===mode));
}

// Per morph target (burst, expanding, full, deflated): bag volume as an ellipsoid in bag-local space
// (measured from driver_airbag_animated.glb; +Z toward the driver, origin at the hub), and how hard
// that stage pushes the driver's hands off the rim.
const bagShapes=[
  {c:[0,-.005,.145],r:[.189,.174,.080],push:.4},
  {c:[0,-.008,.205],r:[.333,.295,.160],push:.75},
  {c:[0,-.009,.244],r:[.435,.385,.206],push:1},
  {c:[0,-.022,.245],r:[.416,.325,.054],push:.35},
];
// The deflated target's back face sits 0.19 m in front of the hub (full: 0.038 m), so the emptied bag
// would float away from the wheel. Slide it back by the difference so it stays attached at the hub.
const deflatedPullBack=.153;
let bagMount=null, bagState={airbag:null,airbagInflation:0};
function applyAirbag(t){
  if(!bagMesh)return;
  const keys=[0,.010,.025,.065,.18,.42,.8];
  const values=[[0,0,0,0],[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,1,0],[0,0,0,1],[0,0,0,1]];
  const i=Math.min(keys.length-2,Math.max(0,keys.findIndex(x=>x>t)-1));
  const j=(t>=keys.at(-1))?keys.length-2:i;
  const alpha=THREE.MathUtils.clamp((t-keys[j])/(keys[j+1]-keys[j]),0,1);
  const w=bagMesh.morphTargetInfluences;
  for(let k=0;k<4;k++)w[k]=THREE.MathUtils.lerp(values[j][k],values[j+1][k],alpha);
  const total=w[0]+w[1]+w[2]+w[3];
  // The undeployed base mesh is a folded pad that would float in front of the hub cover: hide it until deployment.
  bagMesh.visible=total>1e-3;
  bagMesh.position.z=-deflatedPullBack*w[3];
  if(!bagMesh.visible){bagState={airbag:null,airbagInflation:0};return;}
  const c=[0,0,0],r=[0,0,0];let push=0;
  bagShapes.forEach((s,k)=>{for(let a=0;a<3;a++){c[a]+=s.c[a]*w[k]/total;r[a]+=s.r[a]*w[k];}push+=s.push*w[k];});
  c[2]-=deflatedPullBack*w[3]/total;
  bagState={airbag:{cx:bagMount[0]+c[0],cy:bagMount[1]+c[1],cz:bagMount[2]+c[2],rx:r[0],ry:r[1],rz:r[2]},airbagInflation:Math.min(1,push)};
}
function severity(){return THREE.MathUtils.clamp(config.speed/90,.30,1.3);}
function airbagDeploys(){return config.airbag && config.speed>=40;}
// Why the bag stays folded: switched off, or below the game's (not a real car's) 40 km/h rule.
function airbagNote(){return airbagDeploys()?'已展開（演示）':(!config.airbag?'未展開（已關閉）':'未展開（低於遊戲設定 40 km/h）');}
// Distance driven from 0 to time (m), integrating the same speed curve shown on the readout.
// The approach wall and scrolling floor use it so higher speeds visibly close in faster.
const approachScale=.4;
function travelled(time){
  const v=config.speed/3.6,t=Math.min(time,impactAt),u=Math.min(t,1.4)/1.4;
  return v*(.15*t+.85*(t<=1.4?1.4*(u**3-u**4/2):.7+(t-1.4)));
}
function setPosition(time){
  clockTime=THREE.MathUtils.clamp(time,0,duration);
  let status='準備就緒',phase='開始前';
  let instantSpeed=0;
  if(clockTime<1.7){
    instantSpeed=config.speed*(.15+.85*THREE.MathUtils.smoothstep(clockTime,0,1.4));
    status=clockTime<.3?'測試開始':'車輛接近障礙物';phase='加速接近';
  }else if(clockTime<impactAt){instantSpeed=config.speed;status='準備撞擊！';phase='撞擊倒數';}
  else{
    const t=clockTime-impactAt;
    const deployed=airbagDeploys();
    if(t<.10){status='發生碰撞！';phase='碰撞瞬間';}
    else if(t<.80){status=deployed?'氣囊展開 → 洩氣':'氣囊'+airbagNote();phase='車內反應';}
    else {status='碰撞測試完成';phase='事故後';}
    instantSpeed=config.speed*Math.max(0,1-t*8);
  }
  // Airbag first: the driver's head/chest stop on its current surface.
  const t=Math.max(0,clockTime-impactAt);
  applyAirbag(clockTime>=impactAt&&airbagDeploys()?t:0);
  if(driver)driver.setTime(clockTime>=impactAt?t:0,{intensity:severity(),belted:config.belt,offset:impactOffset[config.impact],...bagState});
  const impactAge=clockTime-impactAt;
  const shock=(impactAge>=0 && impactAge<.65)?Math.exp(-impactAge*8)*Math.sin(impactAge*48)*severity():0;
  const offset=impactOffset[config.impact];
  const driven=approachScale*travelled(clockTime);
  barrier.position.z=-2.05-(approachScale*travelled(impactAt)-driven);
  // Offset crashes: the wall only overlaps the struck half of the car, and the car yaws toward that side.
  barrier.position.x=offset*2.0;
  lineGrid.position.z=driven%1;
  vehicle.rotation.x=shock*.025;
  vehicle.rotation.z=shock*.012*offset;
  vehicle.rotation.y=impactAge>0?-offset*.035*severity()*THREE.MathUtils.smoothstep(impactAge,0,.5):0;
  vehicle.position.z=shock*.018;
  $('flash').style.opacity=impactAge>=0&&impactAge<.18?String(Math.max(0,(1-impactAge/.18)*.49)): '0';
  $('crack').style.opacity=(impactAge>=0 && config.speed>=60)?String(Math.min(.4,(config.speed-50)/200)):'0';
  text('speedReadout',String(Math.max(0,Math.round(instantSpeed))));
  text('phaseLabel',phase);
  text('timeLabel',clockTime.toFixed(2)+' / '+duration.toFixed(2)+' 秒');
  invalidate();
  $('timeline').value=clockTime;
  setStatus(status);
  if(clockTime<impactAt && clockTime===0){text('speedReadout',String(config.speed));text('phaseLabel','準備階段');setStatus('準備進行碰撞測試');}
}
function stopPlaying(){playing=false;$('startBtn').textContent=clockTime>=duration?'▶ 再次測試':'▶ 開始 / 繼續';}
function resetTimeline(){playing=false;finished=false;impactTriggered=false;setPosition(0);$('startBtn').textContent='▶ 開始撞擊';}
function beginTrial(){showResult(false);showDrawer(false);resetTimeline();playing=true;$('startBtn').textContent='❚❚ 暫停';if(canPlayAudio)activateAudio();}
function replaySlow(){showResult(false);showDrawer(false);resetTimeline();$('speedMode').value='0.25';playing=true;$('startBtn').textContent='❚❚ 暫停';}
function togglePlay(){
  if(!loaded)return;
  if(playing){stopPlaying();return;}
  if(clockTime>=duration||clockTime===0){beginTrial();return;}
  playing=true;$('startBtn').textContent='❚❚ 暫停';
}
function openResults(){
  playing=false;finished=true;$('startBtn').textContent='▶ 再次測試';
  text('resultSpeed',config.speed+' km/h');text('resultAngle',impactNames[config.impact]);
  text('resultAirbag',airbagNote());
  text('resultBelt',config.belt?'已繫上':'未繫上');
  showResult(true);
}

function syncSettings(){
  text('speedVal',config.speed+' km/h');
  text('angleVal',config.impact==='front'?'正面':(config.impact==='left'?'偏左':'偏右'));
  text('impactText',impactNames[config.impact]);
  document.querySelectorAll('[data-impact]').forEach(b=>b.classList.toggle('active',b.dataset.impact===config.impact));
  if(!playing)setPosition(clockTime);
}
$('speedInput').addEventListener('input',e=>{config.speed=Number(e.target.value);syncSettings();});
$('angles').addEventListener('click',e=>{let b=e.target.closest('[data-impact]');if(b){config.impact=b.dataset.impact;syncSettings();}});
$('beltInput').addEventListener('change',e=>{config.belt=e.target.checked;setPosition(clockTime);});
$('airbagInput').addEventListener('change',e=>{config.airbag=e.target.checked;setPosition(clockTime);});
$('settingsBtn').addEventListener('click',()=>{showResult(false);showDrawer(true);});
$('closeDrawer').addEventListener('click',()=>showDrawer(false));
$('cancelBtn').addEventListener('click',()=>showDrawer(false));
$('launchBtn').addEventListener('click',()=>{if(loaded)beginTrial();});
$('startBtn').addEventListener('click',togglePlay);
$('replayBtn').addEventListener('click',()=>{if(loaded)replaySlow();});
$('resultReplay').addEventListener('click',replaySlow);
$('resultChange').addEventListener('click',()=>{showResult(false);resetTimeline();showDrawer(true);});
$('timeline').addEventListener('input',e=>{if(!loaded)return;stopPlaying();showResult(false);clockTime=Number(e.target.value);setPosition(clockTime);impactTriggered=clockTime>=impactAt;finished=false;});
document.querySelectorAll('[data-cam]').forEach(b=>b.addEventListener('click',()=>switchCamera(b.dataset.cam)));
const fullscreenTip='此瀏覽器不支援全螢幕。iPhone 可用 Safari「分享 → 加入主畫面」後從主畫面開啟。';
$('fullscreenBtn').addEventListener('click',async()=>{
  const doc=document,el=doc.documentElement;
  try{
    if(doc.fullscreenElement||doc.webkitFullscreenElement){await (doc.exitFullscreen||doc.webkitExitFullscreen).call(doc);return;}
    const request=el.requestFullscreen||el.webkitRequestFullscreen;
    // iPhone Safari has no element fullscreen API: explain the home-screen alternative instead of silently doing nothing.
    if(!request){setStatus(fullscreenTip);return;}
    await request.call(el);
    if(screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});
  }catch(e){console.info('此手機瀏覽器不支援強制全螢幕或橫向鎖定。',e);setStatus(fullscreenTip);}
});
$('soundBtn').addEventListener('click',()=>{canPlayAudio=!canPlayAudio;$('soundBtn').textContent=canPlayAudio?'🔊':'🔇';$('soundBtn').setAttribute('aria-label',canPlayAudio?'關閉音效':'開啟音效');if(canPlayAudio)activateAudio();});
$('retry').addEventListener('click',()=>location.reload());
function activateAudio(){try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();}catch(e){canPlayAudio=false;$('soundBtn').textContent='🔇';}}
function collisionSound(){
  if(!canPlayAudio||!audioContext)return;
  try{
    const now=audioContext.currentTime;
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='triangle';osc.frequency.setValueAtTime(125,now);osc.frequency.exponentialRampToValueAtTime(38,now+.25);gain.gain.setValueAtTime(.15,now);gain.gain.exponentialRampToValueAtTime(.001,now+.32);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.34);
    const n=Math.floor(audioContext.sampleRate*.16),buf=audioContext.createBuffer(1,n,audioContext.sampleRate);const data=buf.getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);
    const src=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),g=audioContext.createGain();src.buffer=buf;filter.type='lowpass';filter.frequency.value=900;g.gain.value=.18;src.connect(filter);filter.connect(g);g.connect(audioContext.destination);src.start(now);
  }catch(e){console.warn('音效播放被阻擋',e);}
}
let wasPortrait=innerWidth<innerHeight;
function onResize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();
  if((w<h)!==wasPortrait){wasPortrait=w<h;if(presets[activeCamera].portraitPos)switchCamera(activeCamera);}renderer.setPixelRatio(pixelRatio);renderer.setSize(w,h);invalidate();}
// Measure fps only over continuously rendered stretches (playback, dragging); render-on-demand gaps reset the window.
// perf.start=0 marks "previous tick was skipped", so even a very slow phone (a few fps) still gets measured.
const perf={start:0,frames:0};
function adaptQuality(now){
  if(!perf.start){perf.start=now;perf.frames=0;}
  perf.frames++;
  if(now-perf.start<2000)return;
  const fps=(perf.frames-1)*1000/(now-perf.start);perf.start=now;perf.frames=1;
  const next=fps<40?Math.max(minPixelRatio,pixelRatio-.15):fps>55?Math.min(maxPixelRatio,pixelRatio+.1):pixelRatio;
  if(Math.abs(next-pixelRatio)>.01){pixelRatio=next;renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);}
  window.__crashlabFps=Math.round(fps);
}
window.addEventListener('resize',onResize);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stopPlaying();});

// sedan_cabin.glb puts the driver seat ~1.1 m behind the wheel (a real car: ~0.7 m), so a normally
// proportioned driver cannot reach it. Slide the driver seat (not its floor rails) forward at load time;
// the GLB file itself is unchanged. Limited to 0.22 m: the airbag model inflates 0.45 m toward the
// driver, and any closer would put the chest inside the full bag.
const SEAT_FORWARD=.22;
function moveDriverSeat(cabin){
  const box=new THREE.Box3(), centre=new THREE.Vector3();
  cabin.updateMatrixWorld(true);
  const parts=[];
  cabin.traverse(o=>{
    if(!o.isMesh||!/^(Seat_|Headrest_|Seatbelt_)/.test(o.name)||/^Seat_rails/.test(o.name))return;
    if(box.setFromObject(o).getCenter(centre).x<0)parts.push(o); // driver side is -X
  });
  for(const o of parts)o.position.z-=SEAT_FORWARD;
  return parts.length;
}

// Driver body: a rigged character GLB when asset_manifest.json "driver_model.url" names one (or with
// ?driver=test, the box test mannequin), otherwise the procedural placeholder. A model that fails to
// load or lacks the needed bones falls back to the placeholder instead of blocking the game.
async function createDriver(loader,manifest,cabin){
  const param=new URLSearchParams(location.search).get('driver');
  const cfg=param==='test'?{url:'./assets/test_rig_mannequin.glb',bone_map:'auto',label:'測試骨架人偶（非寫實人物）'}:manifest.driver_model;
  if(cfg?.url){
    try{
      text('loadStatus','正在下載人物模型…');
      const gltf=await loader.loadAsync(cfg.url);
      const rigged=createRiggedDriver(THREE,gltf,cabin,cfg);
      rigged.kind='rigged';
      driverNote(`人物：${cfg.label||'rigged GLB 模型'}（骨架對應：${rigged.preset}）`);
      return rigged;
    }catch(e){
      console.warn('人物模型無法使用，改用簡化人偶',e);
      driverNote(`人物模型無法使用（${e.message||e}），已改用簡化幾何人偶。`);
    }
  }else driverNote('人物：簡化幾何人偶（尚未提供 rigged GLB 人物模型）');
  const placeholder=createDriverPrototype(THREE,cabin);
  placeholder.kind='placeholder';
  return placeholder;
}
function driverNote(message){window.__crashlabDriverNote=message;if($('driverNote'))text('driverNote',message);}

async function init(){
  try{
    const loader=new GLTFLoader();
    const progress={cabin:0,bag:0};
    const showProgress=()=>window.__crashlabFailed||text('loadStatus',`正在下載 3D 模型… ${Math.round((progress.cabin+progress.bag)*50)}%`);
    const loadModel=(url,key,label)=>loader.loadAsync(url,e=>{if(e.total){progress[key]=e.loaded/e.total;showProgress();}})
      .then(g=>{progress[key]=1;showProgress();return g;})
      .catch(e=>{throw new Error(`${label}（${url}）下載失敗：${e.message||e}`);});
    const [manifest,cabinGltf,bagGltf]=await Promise.all([
      fetch('./assets/asset_manifest.json').then(r=>{if(!r.ok)throw new Error('資產設定檔 asset_manifest.json 讀取失敗（HTTP '+r.status+'）');return r.json();}),
      loadModel('./assets/sedan_cabin.glb','cabin','車艙模型'),
      loadModel('./assets/driver_airbag_animated.glb','bag','氣囊模型')
    ]);
    if(!Array.isArray(manifest.driver_airbag_mount)||manifest.driver_airbag_mount.length!==3)throw new Error('氣囊位置設定格式錯誤');
    const cabin=cabinGltf.scene;cabin.name='SEDAN_CABIN';vehicle.add(cabin);
    moveDriverSeat(cabin);
    bagMount=manifest.driver_airbag_mount.map(Number);
    const airbag=bagGltf.scene;airbag.name='DRIVER_STEERING_AIRBAG';airbag.position.set(...bagMount);
    airbag.traverse(o=>{if(o.isMesh && o.morphTargetInfluences){bagMesh=o;o.frustumCulled=false;o.material.side=THREE.DoubleSide;}});
    if(!bagMesh || bagMesh.morphTargetInfluences.length!==4)throw new Error('氣囊模型缺少 4 個形變目標');
    vehicle.add(airbag);
    driver=await createDriver(loader,manifest,cabinAnchors(THREE,cabin));vehicle.add(driver.group);
    switchCamera('rear');setPosition(0);syncSettings();loaded=true;
    disableLoading(null);window.__crashlabReady=true;
    // Read-only snapshot for automated play-vs-scrub consistency checks; seek() mirrors a timeline drag at an exact time.
    window.__crashlabDebug={
      state:()=>{const p=driver.pose;const r=n=>Math.round(n*1e5)/1e5;
        return {time:clockTime,barrier:[r(barrier.position.x),r(barrier.position.z)],vehicle:[vehicle.rotation.x,vehicle.rotation.y,vehicle.rotation.z,vehicle.position.z].map(r),
          bag:[...bagMesh.morphTargetInfluences].map(r),torso:[p.pivot.rotation.x,p.pivot.rotation.z,p.pivot.position.z].map(r),belt:p.belted,status:$('stateText').textContent,
          bagVisible:bagMesh.visible,pixelRatio:pixelRatio,fps:window.__crashlabFps??null};},
      // Morph-aware bounds of the bag and the solved driver pose, in vehicle space, for geometry checks.
      geometry:()=>{vehicle.updateMatrixWorld(true);const inv=vehicle.matrixWorld.clone().invert();
        const box=new THREE.Box3().setFromObject(bagMesh,true).applyMatrix4(inv);
        const p=driver.pose, pt=v=>v.clone().add(driver.group.position).toArray();
        return {bagMin:box.min.toArray(),bagMax:box.max.toArray(),mount:bagMount,bagShape:bagState.airbag,
          face:pt(p.face),handL:pt(p.arms[-1].hand),handR:pt(p.arms[1].hand),elbowL:pt(p.arms[-1].elbow),elbowR:pt(p.arms[1].elbow),
          shoulderL:pt(p.arms[-1].shoulder),ankleL:pt(p.legs[-1].ankle),kneeL:pt(p.legs[-1].knee),
          bones:driver.measure?.()??null,driverKind:driver.kind};},
      renders:()=>renderer.info.render.frame,
      seek:(time)=>{stopPlaying();setPosition(time);impactTriggered=clockTime>=impactAt;finished=false;},
    };
  }catch(e){console.error(e);disableLoading(`3D 模型載入失敗：${e.message||e}\n\n請確認網路連線，並用 http:// 或 https:// 網址開啟（不能直接雙擊 index.html）。`);}
}

function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.067,(now-lastFrame)/1000);lastFrame=now;
  if(loaded&&playing){
    const next=Math.min(duration,clockTime+dt*(Number($('speedMode').value)||1));
    if(!impactTriggered&&clockTime<impactAt&&next>=impactAt){impactTriggered=true;collisionSound();}
    setPosition(next);
    if(next>=duration){if(!finished)openResults();else stopPlaying();}
  }
  if(controls.update())needsRender=true;
  if(!needsRender){perf.start=0;return;}
  needsRender=false;
  adaptQuality(now);
  // Subtle camera shake is temporary: restore camera pose after rendering so OrbitControls remains usable.
  let original=null;
  if(clockTime>=impactAt&&clockTime<impactAt+.26&&loaded){
    const age=clockTime-impactAt;const amp=Math.exp(-age*17)*.011*severity();
    original=camera.position.clone();
    camera.position.x+=Math.sin(age*95)*amp;camera.position.y+=Math.cos(age*118)*amp;
  }
  renderer.render(scene,camera);
  if(original)camera.position.copy(original);
}
init();
requestAnimationFrame(frame);
