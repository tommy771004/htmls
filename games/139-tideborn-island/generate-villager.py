"""Original low-poly skinned villager. Generates an embedded glTF; no external assets."""
import base64,json,math,struct
from pathlib import Path
blob=bytearray();views=[];accessors=[]
def acc(values,kind,component=5126):
    width={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[kind]
    flat=[n for row in values for n in (row if isinstance(row,(list,tuple)) else [row])]
    while len(blob)%4:blob.append(0)
    start=len(blob);blob.extend(struct.pack('<'+{5126:'f',5123:'H'}[component]*len(flat),*flat))
    views.append({'buffer':0,'byteOffset':start,'byteLength':len(blob)-start})
    a={'bufferView':len(views)-1,'componentType':component,'count':len(values),'type':kind}
    if kind in ('SCALAR','VEC3'):
        rows=[flat[i:i+width] for i in range(0,len(flat),width)];a['min']=[min(r[i] for r in rows) for i in range(width)];a['max']=[max(r[i] for r in rows) for i in range(width)]
    accessors.append(a);return len(accessors)-1
bones=[('hips',[0,1.1,0],None),('spine',[0,1.65,0],0),('head',[0,2.35,0],1),('armL',[-.52,1.95,0],1),('armR',[.52,1.95,0],1),('legL',[-.24,1.05,0],0),('legR',[.24,1.05,0],0)]
materials=[{'name':'ivory','pbrMetallicRoughness':{'baseColorFactor':[.91,.85,.67,1],'metallicFactor':0,'roughnessFactor':.9}}, {'name':'eyes','pbrMetallicRoughness':{'baseColorFactor':[.08,.14,.12,1],'metallicFactor':0,'roughnessFactor':1}}, {'name':'cloth','pbrMetallicRoughness':{'baseColorFactor':[.25,.47,.4,1],'metallicFactor':0,'roughnessFactor':1}}]
parts=[]
def box(center,size,joint,mat=0):
    x,y,z=center;w,h,d=[v/2 for v in size];vs=[];ns=[];ix=[]
    for normal,face in [([0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]),([0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]),([1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]),([-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]),([0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]),([0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]])]:
        k=len(vs);vs.extend([[x+a*w,y+b*h,z+c*d] for a,b,c in face]);ns.extend([normal]*4);ix.extend([k,k+1,k+2,k,k+2,k+3])
    parts.append({'attributes':{'POSITION':acc(vs,'VEC3'),'NORMAL':acc(ns,'VEC3'),'JOINTS_0':acc([[joint,0,0,0]]*24,'VEC4',5123),'WEIGHTS_0':acc([[1,0,0,0]]*24,'VEC4')},'indices':acc(ix,'SCALAR',5123),'material':mat})
box([0,2.45,0],[.85,.78,.65],2)
for x in [-.21,.21]:box([x,2.51,.332],[.20,.24,.025],2,1)
box([0,2.21,.34],[.38,.08,.03],2,1)
box([0,1.68,0],[.18,.9,.22],1)
for y in [1.55,1.75,1.95]:box([0,y,0],[.72,.10,.35],1)
box([0,1.13,0],[.73,.35,.44],0,2)
for j,x in [(3,-.54),(4,.54)]:
    box([x,1.5,0],[.17,.85,.18],j);box([x,1.06,.02],[.23,.19,.24],j)
for j,x in [(5,-.24),(6,.24)]:
    box([x,.62,0],[.19,.87,.20],j);box([x,.13,.10],[.27,.24,.44],j,2)
nodes=[{'name':'Villager','children':[1,8]}]
for i,(name,pos,parent) in enumerate(bones):
    origin=bones[parent][1] if parent is not None else [0,0,0]
    nodes.append({'name':name,'translation':[a-b for a,b in zip(pos,origin)],'children':[j+1 for j,(_,_,p) in enumerate(bones) if p==i]})
nodes.append({'name':'Body','mesh':0,'skin':0})
inverses=[]
for _,p,_ in bones:inverses.append([1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1])
skin={'inverseBindMatrices':acc(inverses,'MAT4'),'joints':list(range(1,8)),'skeleton':1}
anims=[]
for name,duration,motions in [('idle',2,[(1,.045,0),(2,.035,2)]),('walk',.8,[(3,.75,0),(4,-.75,0),(5,-.65,0),(6,.65,0)]),('work',1.1,[(3,1.0,0),(4,1.0,0),(1,.12,0)])]:
    times=[duration*i/4 for i in range(5)];inp=acc(times,'SCALAR');samplers=[];channels=[]
    for bone,amplitude,axis in motions:
        values=[]
        for i in range(5):
            angle=amplitude*math.sin(i*math.pi/2)+(-.6 if name=='work' and bone in [3,4] else 0);q=[0,0,0,math.cos(angle/2)];q[axis]=math.sin(angle/2);values.append(q)
        samplers.append({'input':inp,'output':acc(values,'VEC4'),'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':bone+1,'path':'rotation'}})
    anims.append({'name':name,'samplers':samplers,'channels':channels})
gltf={'asset':{'version':'2.0','generator':'Tideborn original procedural villager'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':[{'primitives':parts}],'materials':materials,'skins':[skin],'animations':anims,'bufferViews':views,'accessors':accessors,'buffers':[{'byteLength':len(blob),'uri':'data:application/octet-stream;base64,'+base64.b64encode(blob).decode()}]}
Path(__file__).resolve().parents[2].joinpath('assets/tideborn-island/villager.gltf').write_text(json.dumps(gltf,separators=(',',':')))
