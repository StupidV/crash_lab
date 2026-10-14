/**
 * Crash Lab — rigged GLB driver adapter (Stage 4 interface).
 *
 * createRiggedDriver(THREE, gltf, cabin, config) -> {group, setTime(time, options), pose, bones, measure()}
 * Same {group, setTime} contract as driver_prototype.js, and the same motion (driver_motion.js):
 * this file only maps a humanoid skeleton onto the solved pose.
 *
 *  - Bones are found through BONE_PRESETS (Mixamo, VRoid/VRM, Unreal, Blender Rigify) or a custom map.
 *  - The model may face +Z (glTF convention) or -Z, and be authored in metres or centimetres.
 *  - Proportions (arm/leg lengths, shoulder width, head height) are measured from the bind pose,
 *    so a taller or shorter character still sits on the seat and reaches the wheel.
 *  - Every setTime() starts from the bind pose, so seeking to any time gives the same result.
 *
 * config: {bone_map:'auto'|'mixamo'|'vroid'|'unreal'|'rigify'|{canonical:boneName}, height_m?, seat_offset?:[up,back]}
 * This adapts an existing rigged model; it does not create one. Without a real rigged character GLB
 * the game keeps the procedural placeholder.
 */
import {createDriverMotion} from './driver_motion.js';

export const REQUIRED_BONES = ['hips','spine','head',
  'leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand',
  'leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];

// Canonical (VRM humanoid) name -> bone name after normalise(): lower-case letters/digits only,
// Mixamo's "mixamorig:" / "mixamorig1:" prefix removed. GLTFLoader already strips ":" "." "/" from names.
const side=(l,r)=>({left:l,right:r});
function preset(map){
  const out={};
  for(const [k,v] of Object.entries(map)){
    if(typeof v==='string'){out[k]=v;continue;}
    const cap=k[0].toUpperCase()+k.slice(1);
    out['left'+cap]=v.left;out['right'+cap]=v.right;
  }
  return out;
}
export const BONE_PRESETS = {
  mixamo:preset({hips:'hips',spine:'spine',chest:'spine2',neck:'neck',head:'head',
    upperArm:side('leftarm','rightarm'),lowerArm:side('leftforearm','rightforearm'),hand:side('lefthand','righthand'),
    upperLeg:side('leftupleg','rightupleg'),lowerLeg:side('leftleg','rightleg'),foot:side('leftfoot','rightfoot')}),
  vroid:preset({hips:'jbipchips',spine:'jbipcspine',chest:'jbipcchest',neck:'jbipcneck',head:'jbipchead',
    upperArm:side('jbiplupperarm','jbiprupperarm'),lowerArm:side('jbipllowerarm','jbiprlowerarm'),hand:side('jbiplhand','jbiprhand'),
    upperLeg:side('jbiplupperleg','jbiprupperleg'),lowerLeg:side('jbipllowerleg','jbiprlowerleg'),foot:side('jbiplfoot','jbiprfoot')}),
  unreal:preset({hips:'pelvis',spine:'spine01',chest:'spine03',neck:'neck01',head:'head',
    upperArm:side('upperarml','upperarmr'),lowerArm:side('lowerarml','lowerarmr'),hand:side('handl','handr'),
    upperLeg:side('thighl','thighr'),lowerLeg:side('calfl','calfr'),foot:side('footl','footr')}),
  rigify:preset({hips:'defspine',spine:'defspine001',chest:'defspine003',neck:'defspine004',head:'defspine006',
    upperArm:side('defupperarml','defupperarmr'),lowerArm:side('defforearml','defforearmr'),hand:side('defhandl','defhandr'),
    upperLeg:side('defthighl','defthighr'),lowerLeg:side('defshinl','defshinr'),foot:side('deffootl','deffootr')}),
};
const normalise=name=>String(name).toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^mixamorig\d*/,'');

// Returns {preset, bones:{canonical:Object3D}, missing:[canonical]} for the best matching preset.
export function findHumanoidBones(model, boneMap='auto') {
  const byName=new Map();
  model.traverse(o=>{if(o.name&&!byName.has(normalise(o.name)))byName.set(normalise(o.name),o);});
  const resolve=(name,map)=>{
    const bones={};
    for(const [k,v] of Object.entries(map)){const o=byName.get(normalise(v));if(o)bones[k]=o;}
    return {preset:name,bones,missing:REQUIRED_BONES.filter(k=>!bones[k])};
  };
  if(boneMap&&typeof boneMap==='object')return resolve('custom',boneMap);
  if(boneMap&&boneMap!=='auto'){
    if(!BONE_PRESETS[boneMap])throw new Error(`未知的骨架對應表：${boneMap}`);
    return resolve(boneMap,BONE_PRESETS[boneMap]);
  }
  const tries=Object.entries(BONE_PRESETS).map(([n,m])=>resolve(n,m));
  return tries.sort((a,b)=>a.missing.length-b.missing.length)[0];
}

export function createRiggedDriver(THREE, gltf, cabin, config={}) {
  const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const model=gltf.scene||gltf.scenes?.[0];
  const found=findHumanoidBones(model,config.bone_map||'auto');
  if(found.missing.length)throw new Error(`人物模型缺少骨骼（${found.preset}）：${found.missing.join('、')}`);
  const B=found.bones;

  const root=new THREE.Group();root.name='DRIVER_RIGGED_GLB';
  const fit=new THREE.Group();fit.name='DRIVER_RIGGED_FIT';
  fit.add(model);root.add(fit);
  model.traverse(o=>{if(o.isSkinnedMesh||o.isMesh)o.frustumCulled=false;});
  const at=o=>{root.updateMatrixWorld(true);return o.getWorldPosition(new THREE.Vector3());}; // root space while root is at the origin

  // Units and facing. The driver must face -Z with its left hand toward -X.
  let size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  let scale=config.height_m?config.height_m/size.y:(size.y>3?.01:1);
  fit.scale.setScalar(scale);
  if(at(B.leftUpperArm).x>at(B.rightUpperArm).x)fit.rotation.y=Math.PI;
  const bounds=(root.updateMatrixWorld(true),new THREE.Box3().setFromObject(model));
  const height=bounds.max.y-bounds.min.y, k=height/1.65;

  // Body proportions from the bind pose (torso pivot = spine bone).
  const P={};for(const [n,o] of Object.entries(B))P[n]=at(o);
  const rel=(a,b)=>a.clone().sub(b).toArray();
  const halfX=(l,r)=>Math.abs(l.x-r.x)/2;
  const body={
    pelvisSeat:config.seat_offset||[.10*k,.12*k],
    pivot:rel(P.spine,P.hips),
    shoulder:[halfX(P.leftUpperArm,P.rightUpperArm),P.leftUpperArm.y-P.spine.y,(P.leftUpperArm.z+P.rightUpperArm.z)/2-P.spine.z],
    head:rel(P.head,P.spine),
    faceProbes:[[0,.09*k,-.11*k],[0,-.02*k,-.10*k]],
    chestProbes:[[0,(P.leftUpperArm.y-P.spine.y)*.8,-.12*k]],
    upperArm:P.leftLowerArm.distanceTo(P.leftUpperArm),
    forearm:P.leftHand.distanceTo(P.leftLowerArm)+.07*k,
    hipJoint:[halfX(P.leftUpperLeg,P.rightUpperLeg),P.leftUpperLeg.y-P.hips.y,(P.leftUpperLeg.z+P.rightUpperLeg.z)/2-P.hips.z],
    thigh:P.leftLowerLeg.distanceTo(P.leftUpperLeg),
    shin:P.leftFoot.distanceTo(P.leftLowerLeg),
    footDrop:P.leftFoot.y-bounds.min.y,
  };
  body.shoulder[0]=Math.abs(body.shoulder[0]);
  const motion=createDriverMotion(THREE,cabin,body);
  // Put the hips bone on the seat's pelvis point, then move the whole rig to the seat centreline.
  fit.position.add(motion.pelvis.clone().sub(P.hips));
  root.position.set(cabin.x,0,0);

  // Seatbelt straps (the character GLB has none); drawn from the solved pose like the placeholder's.
  const beltMat=new THREE.MeshStandardMaterial({color:0x222930,roughness:.93});
  const strap=name=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),beltMat);m.name=name;root.add(m);return m;};
  const diagonal=strap('Diagonal_Seatbelt'), lap=strap('Lap_Seatbelt');
  function span(mesh,a,b,width){
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(v3(0,1,0),b.clone().sub(a).normalize());
    mesh.scale.set(width,a.distanceTo(b),.012);
  }

  const bind=new Map(Object.values(B).map(o=>[o,o.quaternion.clone()]));
  const spineBindPosition=B.spine.position.clone(), restPivot=motion.solve(0).pivot.position.clone();
  const qa=new THREE.Quaternion(), qb=new THREE.Quaternion(), pa=new THREE.Vector3(), pb=new THREE.Vector3();
  function setWorldQuaternion(bone,q){
    bone.parent.getWorldQuaternion(qa);
    bone.quaternion.copy(qa.invert().multiply(q));
    bone.updateWorldMatrix(false,true);
  }
  // Swing `bone` so the direction to `child` points along `dir` (world space).
  function aim(bone,child,dir){
    bone.getWorldPosition(pa);child.getWorldPosition(pb);
    qb.setFromUnitVectors(pb.sub(pa).normalize(),dir.clone().normalize());
    setWorldQuaternion(bone,qb.multiply(bone.getWorldQuaternion(qa)));
  }

  let pose=null;
  function setTime(time,options={}){
    for(const [o,q] of bind)o.quaternion.copy(q);
    B.spine.position.copy(spineBindPosition);
    root.updateWorldMatrix(true,true);
    pose=motion.solve(time,options);
    const rootQ=root.getWorldQuaternion(new THREE.Quaternion());
    const inWorld=q=>rootQ.clone().multiply(q).multiply(rootQ.clone().invert());
    const W=p=>root.localToWorld(p.clone());
    // The torso also slides forward in the seat with the lean: move the spine joint by the same amount.
    const slide=W(pose.pivot.position).sub(W(restPivot));
    B.spine.position.copy(B.spine.parent.worldToLocal(B.spine.getWorldPosition(pa).add(slide)));
    B.spine.updateWorldMatrix(false,true);
    const footBind={left:B.leftFoot.getWorldQuaternion(new THREE.Quaternion()),right:B.rightFoot.getWorldQuaternion(new THREE.Quaternion())};
    const headBind=B.head.getWorldQuaternion(new THREE.Quaternion());
    // Torso lean/roll about the spine bone, then the extra head pitch.
    const torsoQ=inWorld(new THREE.Quaternion().setFromEuler(pose.pivot.rotation));
    setWorldQuaternion(B.spine,torsoQ.clone().multiply(B.spine.getWorldQuaternion(new THREE.Quaternion())));
    const headQ=inWorld(new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.headRotationX,0,0)));
    setWorldQuaternion(B.head,torsoQ.clone().multiply(headQ).multiply(headBind));
    for(const [s,name] of [[-1,'left'],[1,'right']]){
      const arm=pose.arms[s], leg=pose.legs[s];
      aim(B[name+'UpperArm'],B[name+'LowerArm'],W(arm.elbow).sub(B[name+'UpperArm'].getWorldPosition(pa)));
      aim(B[name+'LowerArm'],B[name+'Hand'],W(arm.hand).sub(B[name+'LowerArm'].getWorldPosition(pa)));
      aim(B[name+'UpperLeg'],B[name+'LowerLeg'],W(leg.knee).sub(B[name+'UpperLeg'].getWorldPosition(pa)));
      aim(B[name+'LowerLeg'],B[name+'Foot'],W(leg.ankle).sub(B[name+'LowerLeg'].getWorldPosition(pa)));
      setWorldQuaternion(B[name+'Foot'],footBind[name]); // feet stay flat on the floor
    }
    const front=v3(0,0,-.11*k).applyEuler(pose.pivot.rotation);
    const hipFront=v3(0,.03,-.12*k);
    span(diagonal,pose.arms[-1].shoulder.clone().add(front).add(v3(.03,.02,0)),pose.legs[1].hip.clone().add(hipFront),.05);
    span(lap,pose.legs[-1].hip.clone().add(hipFront).add(v3(-.06,0,0)),pose.legs[1].hip.clone().add(hipFront).add(v3(.06,0,0)),.045);
    diagonal.visible=lap.visible=pose.belted;
  }
  setTime(0);
  // Actual bone positions in the parent (vehicle) space, to check that the skeleton follows the pose.
  function measure(){
    root.updateWorldMatrix(true,true);
    const toParent=o=>{const p=o.getWorldPosition(new THREE.Vector3());return (root.parent?root.parent.worldToLocal(p):p).toArray();};
    return Object.fromEntries(Object.entries(B).map(([n,o])=>[n,toParent(o)]));
  }
  return {group:root,setTime,get pose(){return pose;},bones:B,preset:found.preset,body,measure};
}
