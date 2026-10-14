"""Procedural sedan cabin and morph-animated steering airbag asset generator.
Python 3.11+, numpy, trimesh. All dimensions approximate meters.
Coordinate convention: +Y up, +Z toward the rear of the car, driver's seat is -X.
"""
import os, json, struct, math, copy
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

OUT=Path(__file__).resolve().parent / 'assets'
OUT.mkdir(exist_ok=True)
scene=trimesh.Scene()
assets_count=0

COL={
  'charcoal':(23,29,37), 'dark':(35,43,51), 'black':(14,19,24),
  'dashboard':(44,52,60), 'dash_top':(30,35,40), 'trim':(87,97,105),
  'silver':(158,172,180), 'chrome':(178,194,204), 'seats':(75,83,90),
  'seat_high':(98,107,114), 'seat_inset':(53,61,68), 'accent':(60,137,164),
  'screen':(18,39,55), 'screen_blue':(45,154,202), 'warn':(224,151,48),
  'glass':(97,129,143), 'floor':(28,34,41), 'stitch':(139,151,160),
  'cream':(232,231,224)
}

def material(key, metallic=0.0, rough=.75, alpha=255):
    c=COL.get(key,key)
    return trimesh.visual.material.PBRMaterial(name=str(key),baseColorFactor=[*c,alpha],metallicFactor=metallic,roughnessFactor=rough,doubleSided=True)

def add(m, name, color='charcoal', mat=None):
    global assets_count
    m.metadata['name']=name
    m.visual=trimesh.visual.TextureVisuals(material=mat or material(color, .35 if color in ('silver','chrome') else .0,.4 if color in ('silver','chrome') else .78))
    scene.add_geometry(m, geom_name=f'{name}_{assets_count:03d}', node_name=f'{name}_{assets_count:03d}')
    assets_count+=1

def box(name, center, size, col='dark', rot=None):
    m=trimesh.creation.box(extents=size)
    if rot:
        ax,theta=rot
        m.apply_transform(rotation_matrix(theta,ax))
    m.apply_translation(center)
    add(m,name,col)

def ellipsoid(name,center,scale,col='dark', subdivisions=2):
    m=trimesh.creation.icosphere(subdivisions=subdivisions)
    m.apply_scale(scale)
    m.apply_translation(center)
    add(m,name,col)

def rod(name,a,b,r=.01,col='silver',sections=10):
    a=np.array(a,dtype=float); b=np.array(b,dtype=float)
    vec=b-a; L=float(np.linalg.norm(vec))
    if L<1e-5: return
    m=trimesh.creation.cylinder(radius=r,height=L,sections=sections)
    m.apply_transform(trimesh.geometry.align_vectors([0,0,1],vec/L))
    m.apply_translation((a+b)/2)
    add(m,name,col)

def curve(name,pts,r=.013,col='trim',closed=False):
    p=list(pts)
    if closed:p.append(p[0])
    for i,(a,b) in enumerate(zip(p,p[1:])):rod(f'{name}_{i}',a,b,r,col)

def torus(name, center, major, minor, color='dark', rot=None, section=12, segs=64):
    # trimesh expects major/minor radii; rotate standard Z-normal torus
    m=trimesh.creation.torus(major_radius=major,minor_radius=minor,major_sections=segs,minor_sections=section)
    if rot:m.apply_transform(rotation_matrix(rot[1],rot[0]))
    m.apply_translation(center)
    add(m,name,color)

def panel(name, points, thickness, color='dark'):
    # quad or convex polygon flat in world space with surfaces both sides
    points=np.array(points,dtype=float)
    n=np.cross(points[1]-points[0],points[2]-points[0]);n=n/np.linalg.norm(n)
    a=points-n*thickness/2; b=points+n*thickness/2
    vs=np.vstack([a,b]);L=len(points)
    faces=[]
    for i in range(1,L-1):
        faces.extend([(0,i+1,i),(L,L+i,L+i+1)])
    for i in range(L):
        j=(i+1)%L;faces.extend([(i,j,L+j),(i,L+j,L+i)])
    m=trimesh.Trimesh(vertices=vs,faces=np.asarray(faces),process=False)
    add(m,name,color)

# === Passenger compartment foundation ===
box('Carpet_floor',(0,.12,.13),(2.21,.12,3.55),'floor')
box('Front_firewall',(0,.68,-1.61),(2.2,1.25,.105),'dark')
box('Dashboard_top',(0,1.28,-1.13),(2.24,.18,.81),'dash_top')
box('Dashboard_lower',(0,1.05,-1.00),(2.19,.37,.24),'dashboard')
box('Dashboard_bottom_edge',(0,.825,-.95),(2.11,.05,.11),'black')
box('Dashboard_brushed_trim',(0,1.093,-.843),(2.06,.022,.012),'silver')
box('Windshield_bottom_seal',(0,1.38,-1.53),(2.24,.048,.045),'black')

# Side doors with inner panels
for side in [-1,1]:
    x=side*1.126
    box('Door_inner_card', (x,.78,.12),(.09,.87,2.66),'dashboard')
    box('Door_upper_rail',(x,1.22,-.07),(.11,.13,2.25),'dark')
    box('Door_armrest',(side*1.035,.82,.36),(.23,.13,.77),'seats')
    box('Door_handle_trim',(side*.997,1.02,-.20),(.045,.055,.29),'silver')
    box('Door_lower_speaker',(side*1.070,.52,-.78),(.03,.28,.36),'seat_inset')
    for q in range(5):
        rod('Door_speaker_grille',(side*1.046,.42+q*.043,-.94),(side*1.046,.42+q*.043,-.62),.0038,'trim')
    box('Window_switch',(side*.968,.916,.4),(.07,.021,.13),'black')
    box('Threshold_sill',(side*1.077,.23,.48),(.13,.09,1.96),'black')

# windshield frame, A-pillars, crossbars, glass tint strip
for s in [-1,1]:
    curve('A_pillar',[(s*1.1,1.29,-1.40),(s*1.02,1.86,-1.72)],.043,'dashboard')
    curve('Window_side_frame',[(s*1.07,1.85,-1.69),(s*1.15,1.72,.5)],.025,'trim')
curve('Windshield_roof_front',[(-1.04,1.85,-1.72),(1.04,1.85,-1.72)],.045,'dark')
# glass as lightly colored geometry. opaque but minimal small strip near top
panel('Windshield_sunshade_tint',[(-1.01,1.83,-1.716),(1.01,1.83,-1.716),(1.02,1.69,-1.64),(-1.02,1.69,-1.64)],.004,'glass')
box('Rearview_mirror_post',(0,1.63,-1.41),(.03,.21,.045),'black')
box('Rearview_mirror',(0,1.55,-1.43),(.36,.113,.055),'black')
box('Rearview_mirror_reflective',(0,1.55,-1.391),(.32,.083,.012),'glass')

# instrument binnacle and steering column
box('Cluster_hood',(-.72,1.38,-.88),(.74,.12,.37),'black')
box('Cluster_screen',(-.72,1.28,-.817),(.65,.20,.024),'screen')
# digital gauges arcs and indicators, needle strokes
for x0 in (-.86,-.56):
    torus('Digital_gauge_ring',(x0,1.287,-.798),.091,.008,'screen_blue',segs=48)
    rod('Digital_needle',(x0,1.285,-.772),(x0+.052,1.344,-.772),.006,'cream')
for q in range(5):
    box('Dashboard_cluster_indicator',(-.74+(q-2)*.062,1.17,-.79),(.023,.009,.008),'warn' if q==0 else 'accent')

# middle console floating infotainment
box('Infotainment_frame',(.14,1.38,-.89),(.48,.36,.07),'black')
box('Infotainment_screen',(.14,1.39,-.85),(.434,.295,.014),'screen')
for i in range(3):
    box('UI_row',(.10,1.48-i*.072,-.836),(.31-i*.039,.012,.006),'screen_blue' if i==0 else 'trim')
box('UI_accent',(-.02,1.25,-.836),(.08,.022,.007),'accent')
# air vents
for x0 in (-1.01,-.20,.56,.89):
    box('Air_vent_frame',(x0,1.12,-.825),(.18,.12,.022),'black')
    for i in range(3):
        box('Air_vent_slat',(x0,1.087+i*.032,-.808),(.155,.008,.007),'silver')
# climate controls
for i in range(5):
    torus('Climate_knob_ring',(-.20+i*.13,.955,-.843),.024,.004,'silver',segs=24)
    ellipsoid('Climate_knob_inner',(-.20+i*.13,.955,-.831),(.016,.016,.008),'black',1)

# center transmission console x 0.0 around z=.2
box('Center_tunnel',(0,.375,.13),(.43,.35,1.76),'dark')
box('Console_brushed_top',(0,.556,.00),(.395,.018,1.28),'trim')
box('Console_black_overlay',(0,.569,-.34),(.345,.024,.39),'black')
box('Gear_selector_base',(0,.6,-.41),(.15,.031,.22),'silver')
box('Gear_selector_stick',(0,.665,-.43),(.092,.14,.092),'black')
box('Gear_selector_highlight',(0,.745,-.43),(.067,.015,.073),'trim')
for zc in (.045,.31):
    torus('Cup_holder_bezel',(0,.583,zc),.10,.012,'silver',rot=([1,0,0],np.pi/2),segs=48)
    ellipsoid('Cup_holder_dark_inset',(0,.573,zc),(.089,.005,.089),'black',1)
box('Padded_center_armrest',(0,.67,.83),(.42,.17,.53),'seats')

# front seats. Seat backs project towards rear but center gap remains open.
for s in [-1,1]:
    cx=s*.738
    box('Seat_rails_front',(cx,.22,.47),(.49,.11,1.15),'black')
    box('Seat_cushion_base',(cx,.495,.55),(.63,.20,.80),'seats',rot=([1,0,0],-.035))
    box('Seat_cushion_center',(cx,.607,.54),(.43,.022,.63),'seat_high')
    # Raised side bolster cushions
    for dx in (-.27,.27):
        ellipsoid('Seat_cushion_bolster',(cx+dx,.61,.56),(.069,.065,.39),'seats',2)
    # backrest slopes backwards; top back further +z
    box('Seat_backrest',(cx,1.055,.925),(.61,.98,.26),'seats',rot=([1,0,0],-.13))
    box('Seat_backrest_insert',(cx,1.025,1.063),(.404,.67,.025),'seat_inset',rot=([1,0,0],-.13))
    for dx in (-.22,.22):
        ellipsoid('Seat_back_bolster',(cx+dx,1.07,1.083),(.09,.40,.095),'seat_high',2)
    for h in range(4):
        rod('Seat_stitch_row',(cx-.16,.87+h*.115,1.092+h*.015),(cx+.16,.87+h*.115,1.092+h*.015),.0026,'stitch')
    # headrest poles and pad
    for dx in (-.13,.13):
        rod('Headrest_post',(cx+dx,1.50,1.00),(cx+dx,1.67,1.02),.014,'silver')
    box('Headrest_pad',(cx,1.67,1.06),(.45,.25,.20),'seats',rot=([1,0,0],-.1))
    # belt buckle by inner edge
    box('Seatbelt_buckle',(cx-s*.37,.57,.80),(.055,.16,.052),'black')
    box('Seatbelt_red_release',(cx-s*.37,.65,.806),(.047,.016,.036),'warn')
    # seatbelt running diagonally, visible on seats for placeholder
    rod('Seatbelt_diagonal',(cx+s*.21,1.48,1.18),(cx-s*.16,.69,1.17),.019,'black')

# Steering wheel column and frame left hand drive
sx,sy,sz=-.745,1.15,-.47
rod('Steering_column',(sx,1.04,-.87),(sx,sy,sz-.025),.060,'black',20)
torus('Steering_outer_rim',(sx,sy,sz),.285,.035,'black',segs=96,section=16)
torus('Steering_leather_highlight',(sx,sy,sz+.01),.261,.008,'seat_high',segs=96,section=12)
# metallic spokes: hub to ring
for theta in [math.pi/6,5*math.pi/6,3*math.pi/2]:
    p1=(sx+.085*math.cos(theta),sy+.085*math.sin(theta),sz+.005)
    p2=(sx+.252*math.cos(theta),sy+.252*math.sin(theta),sz+.003)
    rod('Steering_spoke',p1,p2,.027,'trim',12)
# spokes face buttons
for s in [-1,1]:
    box('Steering_spoke_buttons',(sx+s*.162,sy-.005,sz+.045),(.090,.068,.014),'black')
    for b in range(3):
        box('Steering_button',(sx+s*.162+(b-1)*.024,sy,sz+.055),(.016,.019,.005),'silver')
# hub base and cover, airbag mounts forward of this centre
ellipsoid('Steering_hub_back',(sx,sy,sz+.007),(.117,.103,.05),'black',2)
ellipsoid('Airbag_hub_cover',(sx,sy,sz+.049),(.085,.074,.015),'dark',3)
box('Horn_mark',(sx,sy-.024,sz+.071),(.053,.006,.005),'silver')
# left stalk and right stalk
rod('Turn_signal_stalk',(sx-.1,sy+.10,sz-.16),(sx-.39,sy+.09,sz-.11),.016,'black')
rod('Wiper_stalk',(sx+.1,sy+.10,sz-.16),(sx+.34,sy+.08,sz-.14),.016,'black')

# pedals visible under lower left dash
for px in (-.90,-.67):
    box('Pedal_plate',(px,.36,-1.16),(.14,.24,.047),'black',rot=([1,0,0],-.12))
    for j in range(3):
        box('Pedal_rubber_grip',(px,.28+j*.055,-1.126),(.10,.012,.009),'trim')

# windshield and A-pillar edges finished, console details
box('Glovebox_seam',(.72,.94,-.847),(.64,.012,.008),'black')
box('Passenger_deploy_panel',(.70,1.265,-.969),(.59,.009,.22),'dashboard')
for s in [-1,1]:
    box('Sun_visor',(s*.65,1.805,-1.44),(.50,.035,.21),'seats')

model_file=OUT/'sedan_cabin.glb'
model_file.write_bytes(scene.export(file_type='glb'))
print('Exported cabin:',model_file, 'geometries', len(scene.geometry), 'size',model_file.stat().st_size)

# === Morphing airbag mesh, standalone root at (0,0,0), deployed +Z toward driver ===
# Generate a fixed rectangular UV topology for each state, including 3D pleats and sagging.
N_LAT=26; N_LON=72
faces=[]
for i in range(N_LAT):
    for j in range(N_LON):
        a=i*N_LON+j; b=i*N_LON+(j+1)%N_LON
        c=(i+1)*N_LON+j; d=(i+1)*N_LON+(j+1)%N_LON
        faces.extend([(a,c,b),(b,c,d)])
faces=np.asarray(faces,dtype=np.int64)

def bag_vertices(radiusX,radiusY,thickness,zc,sag=0,wave=0):
    vertices=[]
    for i in range(N_LAT+1):
        phi=math.pi*i/N_LAT
        for j in range(N_LON):
            theta=2*math.pi*j/N_LON
            n0=math.sin(phi)
            # waves fade toward center, mostly at side pleats
            ripple=wave*(.62*math.sin(9*theta+phi*2)+.38*math.cos(13*theta-phi*3))*(n0**3)
            rx=radiusX*(1+ripple)
            ry=radiusY*(1+ripple)
            x=rx*n0*math.cos(theta)
            y=ry*n0*math.sin(theta)-sag*(max(0,1+math.cos(phi))/2)*.35
            z=zc+thickness*math.cos(phi) + .009*wave*math.sin(12*theta)*n0**2
            vertices.append((x,y,z))
    return np.asarray(vertices,np.float32)

stages=[
 bag_vertices(.082,.073,.025,.082,0,.18),  # packed under split wheel cover
 bag_vertices(.17,.157,.080,.145,0,.14),  # popped
 bag_vertices(.31,.275,.16,.205,0,.10),  # opening
 bag_vertices(.420,.375,.206,.244,0,.052),  # fully inflated
 bag_vertices(.375,.292,.054,.245,.080,.14) # deflated
]
base=trimesh.Trimesh(vertices=stages[0],faces=faces,process=False)
base.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name='woven_ivory_nylon',baseColorFactor=[239,237,229,255],roughnessFactor=.94,metallicFactor=0.0,doubleSided=True))
bag_scene=trimesh.Scene()
bag_scene.add_geometry(base,geom_name='DriverAirbagMorph',node_name='DriverAirbagMorph')
blob=bag_scene.export(file_type='glb')

def unpack_glb(blob):
    magic,version,length=struct.unpack_from('<4sII',blob,0)
    assert magic==b'glTF' and version==2
    p=12; jsonchunk=None; binchunk=None
    while p<len(blob):
        sz,typ=struct.unpack_from('<I4s',blob,p);p+=8
        dat=blob[p:p+sz];p+=sz
        if typ==b'JSON':jsonchunk=json.loads(dat)
        elif typ==b'BIN\0':binchunk=bytearray(dat)
    return jsonchunk,binchunk

def pack_glb(doc,binary):
    encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf8')
    encoded+=b' ' * (-len(encoded)%4)
    binary+=b'\0'*(-len(binary)%4)
    size=12+8+len(encoded)+8+len(binary)
    return struct.pack('<4sII',b'glTF',2,size)+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary

doc,binary=unpack_glb(blob)
primitive=doc['meshes'][0]['primitives'][0]
assert doc['accessors'][primitive['attributes']['POSITION']]['count']==len(stages[0])

def accessor_float(array,component='VEC3',minimum=None,maximum=None):
    arr=np.asarray(array,dtype=np.float32).reshape(-1)
    pad=(-len(binary))%4
    if pad:binary.extend(b'\0'*pad)
    start=len(binary)
    binary.extend(arr.tobytes())
    vi=len(doc.setdefault('bufferViews',[]))
    doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':arr.nbytes})
    ac={'bufferView':vi,'componentType':5126,'count':int(len(arr)/(3 if component=='VEC3' else 1)),'type':component}
    if minimum is not None:ac['min']=minimum
    if maximum is not None:ac['max']=maximum
    ai=len(doc['accessors']);doc['accessors'].append(ac)
    return ai
baseNormals=base.vertex_normals.astype(np.float32)
primitive['targets']=[]
for v in stages[1:]:
    delta=v-stages[0]
    dNorm=trimesh.Trimesh(vertices=v,faces=faces,process=False).vertex_normals.astype(np.float32)-baseNormals
    pi=accessor_float(delta)
    ni=accessor_float(dNorm)
    primitive['targets'].append({'POSITION':pi,'NORMAL':ni})
doc['meshes'][0]['weights']=[0.,0.,0.,0.]
doc['meshes'][0]['extras']={'targetNames':['burst','expanding','full','deflated']}
# Clip keys are seconds; weights multiplied by scalar channels.
times=[0.0,.010,.025,.065,.18,.42,.80]
weights=[
 [0,0,0,0],[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,1,0],[0,0,0,1],[0,0,0,1]
]
ti=accessor_float(times,'SCALAR', [0.0], [max(times)])
wi=accessor_float(np.array(weights).reshape(-1),'SCALAR')
doc.setdefault('animations',[]).append({'name':'DeployAndDeflate','samplers':[{'input':ti,'output':wi,'interpolation':'LINEAR'}], 'channels':[{'sampler':0,'target':{'node':1,'path':'weights'}}]})
doc['buffers'][0]['byteLength']=len(binary)
file=OUT/'driver_airbag_animated.glb'
file.write_bytes(pack_glb(doc,binary))
print('Exported airbag:',file,'morph targets',len(primitive['targets']),'animation',doc['animations'][0]['name'],'size',file.stat().st_size)

# Optional expanded bag direct static GLB as scene reference for asset reuse
full=trimesh.Trimesh(vertices=stages[3],faces=faces,process=False)
full.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name='woven_ivory_nylon',baseColorFactor=[239,237,229,255],roughnessFactor=.94,metallicFactor=0.0,doubleSided=True))
(OUT/'driver_airbag_full.glb').write_bytes(full.export(file_type='glb'))

# metadata guide
metadata={
 'asset_scale':'1 Three.js unit ~= 1 meter',
 'coordinate_system':'+Y up, +Z toward rear, driver is -X',
 'driver_airbag_mount':[-.745,1.15,-.399],
 'airbag_model_local_axes':'+Z toward driver, origin at hub',
 'car_model':'sedan_cabin.glb',
 'animated_airbag_model':'driver_airbag_animated.glb',
 'animation':'DeployAndDeflate, 0.0 through 0.8 seconds (intentionally slowed for viewing)',
 'animation_states':['closed','initial burst','expanding','fully inflated','deflated'],
 'note':'Visual demonstration only, not calibrated physical crash-test data.'
}
(OUT/'asset_manifest.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False),encoding='utf8')
