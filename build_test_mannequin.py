"""Build assets/test_rig_mannequin.glb — a TEST skeleton for the rigged-driver interface (driver_rigged.js).

It is a box mannequin, NOT a character model and not based on the reference PNGs. It exists only so the
bone mapping / IK code can be verified without a real rigged GLB. Deliberately "awkward" like real exports:
Mixamo bone names with the "mixamorig:" prefix, facing +Z (glTF convention), authored in centimetres.

Usage:  py build_test_mannequin.py      (writes only assets/test_rig_mannequin.glb; standard library only)
"""
import json, struct, os

CM = 100.0  # authored in centimetres; the adapter must detect and rescale
# name, parent, head position (metres, T-pose, facing +Z so the character's left is +X)
BONES = [
    ('Hips', None, (0, .95, 0)), ('Spine', 'Hips', (0, 1.03, 0)), ('Spine1', 'Spine', (0, 1.15, 0)),
    ('Spine2', 'Spine1', (0, 1.27, 0)), ('Neck', 'Spine2', (0, 1.42, 0)), ('Head', 'Neck', (0, 1.50, 0)),
]
for s, x in (('Left', 1), ('Right', -1)):
    BONES += [
        (f'{s}Shoulder', 'Spine2', (x * .06, 1.37, 0)), (f'{s}Arm', f'{s}Shoulder', (x * .17, 1.38, 0)),
        (f'{s}ForeArm', f'{s}Arm', (x * .47, 1.38, 0)), (f'{s}Hand', f'{s}ForeArm', (x * .72, 1.38, 0)),
        (f'{s}UpLeg', 'Hips', (x * .09, .90, 0)), (f'{s}Leg', f'{s}UpLeg', (x * .09, .48, 0)),
        (f'{s}Foot', f'{s}Leg', (x * .09, .07, 0)), (f'{s}ToeBase', f'{s}Foot', (x * .09, .01, .13)),
    ]
INDEX = {b[0]: i for i, b in enumerate(BONES)}
POS = {b[0]: b[2] for b in BONES}

# Boxes rigidly skinned to one bone: (bone, centre, half size)
BOXES = [('Hips', (0, .93, 0), (.16, .08, .11)), ('Spine', (0, 1.09, 0), (.15, .06, .10)),
         ('Spine1', (0, 1.21, 0), (.16, .06, .11)), ('Spine2', (0, 1.33, 0), (.19, .07, .11)),
         ('Neck', (0, 1.46, 0), (.05, .05, .05)), ('Head', (0, 1.60, .01), (.09, .12, .11)),
         ('Head', (0, 1.58, .12), (.02, .025, .02))]  # nose: shows the facing
for s, x in (('Left', 1), ('Right', -1)):
    BOXES += [(f'{s}Arm', (x * .32, 1.38, 0), (.15, .05, .05)), (f'{s}ForeArm', (x * .595, 1.38, 0), (.125, .04, .04)),
              (f'{s}Hand', (x * .77, 1.38, 0), (.05, .02, .045)), (f'{s}UpLeg', (x * .09, .69, 0), (.075, .21, .08)),
              (f'{s}Leg', (x * .09, .275, 0), (.055, .205, .055)), (f'{s}Foot', (x * .09, .035, .06), (.045, .035, .12))]

pos, nrm, jnt, wgt, idx = [], [], [], [], []
FACES = [((1, 0, 0), (0, 1, 2)), ((-1, 0, 0), (0, 2, 1)), ((0, 1, 0), (1, 2, 0)), ((0, -1, 0), (1, 0, 2)), ((0, 0, 1), (2, 0, 1)), ((0, 0, -1), (2, 1, 0))]
for bone, c, h in BOXES:
    for n, (a, u, v) in FACES:
        base = len(pos)
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = [0, 0, 0]
            p[a] = c[a] + n[a] * h[a]; p[u] = c[u] + su * h[u]; p[v] = c[v] + sv * h[v]
            pos.append([q * CM for q in p]); nrm.append(n); jnt.append((INDEX[bone], 0, 0, 0)); wgt.append((1, 0, 0, 0))
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]
# Make every triangle counter-clockwise when seen from outside.
for t in range(0, len(idx), 3):
    a, b, c = (pos[i] for i in idx[t:t + 3])
    e1 = [b[i] - a[i] for i in range(3)]; e2 = [c[i] - a[i] for i in range(3)]
    cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    if sum(cr[i] * nrm[idx[t]][i] for i in range(3)) < 0:
        idx[t + 1], idx[t + 2] = idx[t + 2], idx[t + 1]

blob = bytearray(); views = []; accessors = []
def add(data, fmt, count, comp, typ, target=None, mm=None):
    while len(blob) % 4: blob.append(0)
    off = len(blob)
    blob.extend(b''.join(struct.pack('<' + fmt, *d) if isinstance(d, (list, tuple)) else struct.pack('<' + fmt, d) for d in data))
    view = {'buffer': 0, 'byteOffset': off, 'byteLength': len(blob) - off}
    if target: view['target'] = target
    views.append(view)
    acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': count, 'type': typ}
    if mm: acc['min'], acc['max'] = mm
    accessors.append(acc)
    return len(accessors) - 1

mins = [min(p[i] for p in pos) for i in range(3)]; maxs = [max(p[i] for p in pos) for i in range(3)]
a_pos = add(pos, '3f', len(pos), 5126, 'VEC3', 34962, (mins, maxs))
a_nrm = add(nrm, '3f', len(nrm), 5126, 'VEC3', 34962)
a_jnt = add(jnt, '4H', len(jnt), 5123, 'VEC4', 34962)
a_wgt = add(wgt, '4f', len(wgt), 5126, 'VEC4', 34962)
a_idx = add(idx, 'H', len(idx), 5123, 'SCALAR', 34963)
ibm = []
for name, parent, p in BONES:  # inverse bind = translate(-world position), column-major
    ibm.append((1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0] * CM, -p[1] * CM, -p[2] * CM, 1))
a_ibm = add(ibm, '16f', len(ibm), 5126, 'MAT4')

nodes = []
for name, parent, p in BONES:
    pp = POS[parent] if parent else (0, 0, 0)
    nodes.append({'name': 'mixamorig:' + name, 'translation': [(p[i] - pp[i]) * CM for i in range(3)]})
for name, parent, p in BONES:
    kids = [INDEX[b[0]] for b in BONES if b[1] == name]
    if kids: nodes[INDEX[name]]['children'] = kids
mesh_node = len(nodes); nodes.append({'name': 'TEST_MANNEQUIN_NOT_A_CHARACTER', 'mesh': 0, 'skin': 0})
nodes.append({'name': 'Armature', 'children': [INDEX['Hips'], mesh_node]})
doc = {
    'asset': {'version': '2.0', 'generator': 'Crash Lab build_test_mannequin.py (test rig only)'},
    'scene': 0, 'scenes': [{'nodes': [len(nodes) - 1]}], 'nodes': nodes,
    'meshes': [{'name': 'TestMannequin', 'primitives': [{'attributes': {'POSITION': a_pos, 'NORMAL': a_nrm, 'JOINTS_0': a_jnt, 'WEIGHTS_0': a_wgt}, 'indices': a_idx, 'material': 0}]}],
    'materials': [{'name': 'TEST_MANNEQUIN', 'pbrMetallicRoughness': {'baseColorFactor': [.55, .72, .82, 1], 'metallicFactor': 0, 'roughnessFactor': .8}}],
    'skins': [{'name': 'mixamorig', 'joints': list(range(len(BONES))), 'inverseBindMatrices': a_ibm, 'skeleton': INDEX['Hips']}],
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}],
}
js = json.dumps(doc, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4); blob += b'\0' * (-len(blob) % 4)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'test_rig_mannequin.glb')
with open(out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
    f.write(struct.pack('<II', len(blob), 0x004E4942) + bytes(blob))
print('wrote', out, len(BONES), 'bones', len(pos), 'vertices')
