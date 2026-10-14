/**
 * Crash Lab / Stage 2 - procedural driver motion placeholder.
 * This IS a real Three.js articulated 3D character built from simple geometry.
 * It is NOT a reconstruction of the PNG references, nor a photo-realistic rig.
 * Axis: +Y up, -Z forward, driver at X≈-0.745. Model units ~= meters.
 *
 * createDriverPrototype(THREE, cabin?) -> {group, setTime(time, options), pose}
 * Motion (lean, airbag/wheel contact, arm and leg IK) comes from driver_motion.js, shared with the
 * rigged-GLB driver (driver_rigged.js); this file only draws the pose with simple shapes.
 * options: {intensity, belted, offset, airbag, airbagInflation} — see driver_motion.js.
 */
import {createDriverMotion, DEFAULT_CABIN, PLACEHOLDER_BODY} from './driver_motion.js';

export function createDriverPrototype(THREE, cabin=DEFAULT_CABIN) {
  const motion=createDriverMotion(THREE,cabin,PLACEHOLDER_BODY);
  const root = new THREE.Group();
  root.name = 'DRIVER_PLACEHOLDER_REPLACE_WITH_RIGGED_GLB';
  root.position.set(cabin.x, 0, 0);
  const skin = new THREE.MeshStandardMaterial({color:0xe8b8a0,roughness:.78});
  const face = new THREE.MeshStandardMaterial({color:0xf0c4ae,roughness:.82});
  const shirt = new THREE.MeshStandardMaterial({color:0xc5b4a4,roughness:.95});
  const pants = new THREE.MeshStandardMaterial({color:0x292e36,roughness:.98});
  const shoes = new THREE.MeshStandardMaterial({color:0xe3e1dc,roughness:.82});
  const hair = new THREE.MeshStandardMaterial({color:0x18191f,roughness:.75});
  const eyes = new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.65});
  const belt = new THREE.MeshStandardMaterial({color:0x222930,roughness:.93});
  const fabricSeam = new THREE.MeshStandardMaterial({color:0xa49486,roughness:1});
  const sphere = new THREE.SphereGeometry(1,16,12);
  const unitY = new THREE.Vector3(0,1,0);
  const v3 = (x,y,z) => new THREE.Vector3(x,y,z);

  function oval(parent,name,where,scale,material) {
    const m = new THREE.Mesh(sphere,material);
    m.name=name;
    m.position.set(...where);
    m.scale.set(...scale);
    parent.add(m);
    return m;
  }
  function link(parent,name,a,b,r,material,flat=false) {
    const m=oval(parent,name,[0,0,0],[r,r,r],material);
    place(m,v3(...a),v3(...b),r,flat);
    return m;
  }
  function place(mesh,a,b,r,flat=false) {
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    const axis=b.clone().sub(a);
    mesh.quaternion.setFromUnitVectors(unitY,axis.clone().normalize());
    mesh.scale.set(r,axis.length()*.5+r*.1,flat?r*.28:r);
  }

  // Pelvis sits on the cushion against the seatback; legs are solved once (feet on the carpet).
  oval(root,'Hips_Pants',motion.pelvis.toArray(),[.205,.17,.175],pants);
  for (const side of [-1,1]) {
    const {hip,knee,ankle}=motion.solve(0).legs[side];
    place(oval(root,'Thigh_'+side,[0,0,0],[1,1,1],pants),hip,knee,.1);
    oval(root,'Knee_'+side,knee.toArray(),[.092,.092,.092],pants);
    place(oval(root,'Calf_'+side,[0,0,0],[1,1,1],pants),knee,ankle,.068);
    oval(root,'Shoe_'+side,[ankle.x,ankle.y-.04,ankle.z-.09],[.055,.045,.13],shoes);
  }

  // Articulated upper body rotates around the pelvis in a frontal crash.
  const torsoPivot = new THREE.Group();
  torsoPivot.name='SPINE_LURCH_PIVOT';
  root.add(torsoPivot);
  oval(torsoPivot,'Torso_Shirt',[0,.335,-.065],[.219,.333,.148],shirt);
  oval(torsoPivot,'Shoulders_Shirt',[0,.555,-.09],[.258,.101,.135],shirt);
  oval(torsoPivot,'Neck',[0,.627,-.06],[.067,.095,.069],skin);
  const head = new THREE.Group();
  head.name='HEAD_JOINT';head.position.set(...PLACEHOLDER_BODY.head);
  torsoPivot.add(head);
  oval(head,'Face',[0,0,-.016],[.113,.144,.107],face);
  oval(head,'Hair_Cap',[0,.056,.012],[.128,.122,.12],hair);
  oval(head,'Hair_Left',[-.11,-.075,.05],[.052,.198,.10],hair);
  oval(head,'Hair_Right',[.11,-.075,.05],[.052,.198,.10],hair);
  oval(head,'Hair_Back',[0,-.15,.115],[.141,.19,.063],hair);
  oval(head,'Nose',[0,-.01,-.116],[.019,.030,.029],face);
  for (const side of [-1,1]) {
    oval(head,'Eye_'+side,[side*.042,.014,-.111],[.017,.010,.008],eyes);
  }
  oval(head,'Mouth',[0,-.065,-.117],[.029,.004,.003],fabricSeam);

  // Seatbelt follows the chest, not the moving camera.
  const diagonalBelt=link(torsoPivot,'Diagonal_Seatbelt',[-.19,.585,-.198],[.145,.02,-.214],.042,belt,true);
  const lapBelt=link(torsoPivot,'Lap_Seatbelt',[-.17,.02,-.195],[.18,.01,-.196],.038,belt,true);

  const arms={};
  for (const side of [-1,1]) {
    arms[side]={
      upper:oval(root,'Arm_Upper_'+side,[0,0,0],[1,1,1],shirt),
      lower:oval(root,'Arm_Forearm_'+side,[0,0,0],[1,1,1],skin),
      palm:oval(root,'Hand_'+side,[0,0,0],[.045,.07,.03],skin), // long axis follows the forearm
      elbow:oval(root,'Elbow_'+side,[0,0,0],[.062,.06,.062],shirt),
    };
  }

  let pose=null;
  function setTime(time, options = {}) {
    pose=motion.solve(time,options);
    torsoPivot.position.copy(pose.pivot.position);
    torsoPivot.rotation.copy(pose.pivot.rotation);
    head.rotation.x=pose.headRotationX;
    diagonalBelt.visible=pose.belted;
    lapBelt.visible=pose.belted;
    for (const side of [-1,1]) {
      const {shoulder,elbow,hand}=pose.arms[side], m=arms[side];
      place(m.upper,shoulder,elbow,.064);
      place(m.lower,elbow,hand,.047);
      m.elbow.position.copy(elbow);
      m.palm.position.copy(hand);
      m.palm.quaternion.copy(m.lower.quaternion);
    }
  }
  setTime(0);
  return {group:root,setTime,get pose(){return pose;}};
}
