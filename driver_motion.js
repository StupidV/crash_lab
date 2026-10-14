/**
 * Crash Lab — driver motion solver shared by every driver body (procedural placeholder or rigged GLB).
 *
 * It solves a small kinematic skeleton in "driver root" space: origin on the floor below the seat
 * centreline (vehicle x = cabin.x), +Y up, -Z forward, metres. A body only has to render the pose.
 *
 *   cabin  — where the car parts are (vehicle space), see cabinAnchors()
 *   body   — the character's proportions, see PLACEHOLDER_BODY (a rigged GLB measures its own)
 *   solve(time, options) — time = seconds after impact (<=0: normal driving), options as in setTime():
 *            {intensity, belted, offset, airbag:{cx,cy,cz,rx,ry,rz}|null, airbagInflation:0..1}
 *
 * Visual demonstration only: no crash physics, no injury model.
 */

// Proportions of the procedural placeholder (adult, ~1.65 m). Torso/head offsets are relative to the
// torso pivot; probes are the points kept outside the airbag / steering wheel.
export const PLACEHOLDER_BODY = {
  pelvisSeat:[.17,.175],          // pelvis centre above the cushion top / in front of the backrest
  pivot:[0,.02,0],                // torso pivot relative to the pelvis centre
  shoulder:[.214,.525,-.08],      // torso-local; x = half shoulder width
  head:[0,.792,-.055],            // torso-local head joint
  faceProbes:[[0,.02,-.135],[0,-.1,-.12]], // head-local: forehead/nose, chin
  chestProbes:[[0,.45,-.2]],      // torso-local: upper chest
  upperArm:.31, forearm:.35,      // forearm length runs to the grip point in the palm
  hipJoint:[.118,-.05,-.10],      // pelvis-local; x = half hip width
  thigh:.46, shin:.44,
  footDrop:.09,                   // ankle height above the floor
};

// sedan_cabin.glb measurements with the driver seat moved SEAT_FORWARD (game.js) toward the wheel.
// Used when the cabin nodes cannot be found by name.
export const DEFAULT_CABIN = {
  x:-.745, seatTop:.618, seatBack:.513,
  wheel:{center:[-.745,1.15,-.47], radius:.285, outer:.32, gripZ:-.45},
  floorY:.18,
};

// Reads the anchors from the loaded cabin (call after the seat has been moved).
export function cabinAnchors(THREE, cabin) {
  const box=name=>{const o=cabin.getObjectByName(name);return o?new THREE.Box3().setFromObject(o):null;};
  const cushion=box('Seat_cushion_center_096'), back=box('Seat_backrest_099'), rim=box('Steering_outer_rim_133'), floor=box('Carpet_floor_000');
  if(!cushion||!back||!rim||!floor)return DEFAULT_CABIN;
  const c=rim.getCenter(new THREE.Vector3()), outer=(rim.max.x-rim.min.x)/2, tube=(rim.max.z-rim.min.z)/2;
  return {
    x:(cushion.min.x+cushion.max.x)/2, seatTop:cushion.max.y, seatBack:back.min.z,
    wheel:{center:c.toArray(), radius:outer-tube, outer, gripZ:rim.max.z-.015},
    floorY:floor.max.y,
  };
}

export function createDriverMotion(THREE, cabin=DEFAULT_CABIN, body=PLACEHOLDER_BODY) {
  const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const MAX_LEAN=1.0;
  let REST_LEAN=.20; // raised below for bodies whose arms cannot reach the rim sitting upright
  const pelvis=v3(0,cabin.seatTop+body.pelvisSeat[0],cabin.seatBack-body.pelvisSeat[1]);
  const pivot=new THREE.Object3D();
  pivot.position.copy(pelvis).add(v3(...body.pivot));
  const restPivotZ=pivot.position.z;
  const head=new THREE.Object3D();head.position.set(...body.head);pivot.add(head);
  const wheel=v3(...cabin.wheel.center).sub(v3(cabin.x,0,0));
  // The rim/hub as a flat disc: stops the head when the airbag is off.
  const wheelDisc={cx:wheel.x,cy:wheel.y,cz:wheel.z,rx:cabin.wheel.outer+.02,ry:cabin.wheel.outer+.02,rz:.05};
  const probes=[...body.faceProbes.map(p=>[head,v3(...p)]),...body.chestProbes.map(p=>[pivot,v3(...p)])];

  // Legs do not move in this demo: solve them once (feet flat on the floor, knees up).
  const legs={};
  for(const side of [-1,1]){
    const hip=pelvis.clone().add(v3(side*body.hipJoint[0],body.hipJoint[1],body.hipJoint[2]));
    const drop=hip.y-(cabin.floorY+body.footDrop), reach=(body.thigh+body.shin)*.85;
    const ankle=v3(hip.x,cabin.floorY+body.footDrop,hip.z-Math.sqrt(Math.max(.01,reach*reach-drop*drop)));
    const {elbow:knee,end}=twoBone(hip,ankle,body.thigh,body.shin,v3(0,1,-.3));
    legs[side]={hip,knee,ankle:end};
  }

  // Law of cosines; the middle joint bends toward `pole`. Out-of-reach targets give a straight limb.
  function twoBone(start,target,l1,l2,pole){
    const d=target.clone().sub(start);
    const dist=Math.min(Math.max(d.length(),Math.abs(l1-l2)+1e-3),l1+l2-1e-3);
    const dir=d.normalize();
    const a=(l1*l1-l2*l2+dist*dist)/(2*dist), h=Math.sqrt(Math.max(0,l1*l1-a*a));
    const bend=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
    return {elbow:start.clone().addScaledVector(dir,a).addScaledVector(bend,h),end:start.clone().addScaledVector(dir,dist)};
  }
  const crashKeys=[
    [0,0], [.015,.035], [.055,.19], [.105,.49], [.165,.56],
    [.255,.36], [.38,.17], [.56,.09], [.82,.055], [1.2,.055]
  ];
  function lurchAt(t){
    if(t<=0)return 0;
    for(let i=0;i<crashKeys.length-1;i++){
      const [a,va]=crashKeys[i],[b,vb]=crashKeys[i+1];
      if(t<=b){const s=Math.max(0,Math.min(1,(t-a)/(b-a)));return THREE.MathUtils.lerp(va,vb,s*s*(3-2*s));}
    }
    return crashKeys.at(-1)[1];
  }
  // lean may go slightly negative: a bag that fills the space pushes the chest back toward the seat.
  function pose(lean,side){
    pivot.rotation.x=-Math.min(MAX_LEAN,Math.max(0,REST_LEAN+lean));
    pivot.rotation.z=-side*Math.max(0,lean)*.17; // offset crash: torso swings toward the struck side
    pivot.position.z=restPivotZ-Math.max(0,lean)*.028;
    head.rotation.x=REST_LEAN*.8-Math.max(0,lean)*.19; // eyes stay on the road at rest
    pivot.updateMatrix();head.updateMatrix();
  }
  // Smallest rest lean (0.2–0.6 rad) that leaves the elbows slightly bent at the 10/2 o'clock grip.
  const restGrip=v3(wheel.x+cabin.wheel.radius*Math.cos(.61),wheel.y+cabin.wheel.radius*Math.sin(.61),cabin.wheel.gripZ);
  const restReach=lean=>{REST_LEAN=lean;pose(0,0);return v3(body.shoulder[0],body.shoulder[1],body.shoulder[2]).applyMatrix4(pivot.matrix).distanceTo(restGrip);};
  const comfortable=(body.upperArm+body.forearm)*.95;
  if(restReach(.20)>comfortable){
    let lo=.20,hi=.60;
    for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(restReach(mid)>comfortable)lo=mid;else hi=mid;}
    restReach(hi);
  }
  const probe=new THREE.Vector3();
  function hits(obstacles){
    for(const [parent,p] of probes){
      probe.copy(p);
      if(parent===head)probe.applyMatrix4(head.matrix);
      probe.applyMatrix4(pivot.matrix);
      for(const o of obstacles){
        // 0.92: the soft bag may be pressed in a little before it stops the head.
        const q=((probe.x-o.cx)/o.rx)**2+((probe.y-o.cy)/o.ry)**2+((probe.z-o.cz)/o.rz)**2;
        if(q<.92*.92)return true;
      }
    }
    return false;
  }
  function solve(time,options={}){
    const t=Math.max(0,Math.min(1.2,time));
    const intensity=Math.max(.2,Math.min(1.55,Number(options.intensity)||1));
    const belted=options.belted!==false;
    const side=Number(options.offset)||0;
    const bag=options.airbag&&options.airbag.rx>.01?options.airbag:null;
    const inflation=Math.max(0,Math.min(1,Number(options.airbagInflation)||0));
    const obstacles=[wheelDisc];
    if(bag)obstacles.push({...bag,cx:bag.cx-cabin.x});
    let lean=lurchAt(t)*intensity*(belted?.78:1.38);
    pose(lean,side);
    if(hits(obstacles)){
      // Largest lean that keeps head and chest on the bag / wheel surface (contact is monotonic in lean).
      let lo=-REST_LEAN*.5,hi=lean;
      for(let i=0;i<16;i++){const mid=(lo+hi)/2;pose(mid,side);if(hits(obstacles))hi=mid;else lo=mid;}
      lean=lo;pose(lean,side);
    }
    const arms={};
    for(const hand of [-1,1]){
      const shoulder=v3(hand*body.shoulder[0],body.shoulder[1],body.shoulder[2]).applyMatrix4(pivot.matrix);
      // Grip the rim at 10/2 o'clock; the inflating bag pushes the hands to 9/3 and outside its edge.
      const angle=THREE.MathUtils.degToRad(35*(1-inflation)), radius=cabin.wheel.radius+.18*inflation;
      const target=v3(wheel.x+hand*radius*Math.cos(angle),wheel.y+radius*Math.sin(angle),cabin.wheel.gripZ+.05*inflation);
      const {elbow,end}=twoBone(shoulder,target,body.upperArm,body.forearm,v3(hand*(1+1.5*inflation),-.7,.15).normalize());
      arms[hand]={shoulder,elbow,hand:end};
    }
    const probePoint=(parent,p)=>{const q=v3(...p);if(parent===head)q.applyMatrix4(head.matrix);return q.applyMatrix4(pivot.matrix);};
    return {
      lean,belted,
      pivot:{position:pivot.position.clone(),rotation:pivot.rotation.clone()},
      headRotationX:head.rotation.x,
      arms,legs,
      face:probePoint(head,body.faceProbes[0]),
    };
  }
  return {solve,pelvis,cabin,body};
}
