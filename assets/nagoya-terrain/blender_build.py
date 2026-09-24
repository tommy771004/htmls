"""Run: blender --background --python blender_build.py -- /path/to/data"""
import bpy, bmesh, json, math, pathlib, sys
from mathutils import Vector

ROOT=pathlib.Path(sys.argv[sys.argv.index('--')+1]).resolve()
d=json.loads((ROOT/'scene.json').read_text())
# Background process owns its new scene; never clears the user's open Blender session.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene['projected_crs']=f"EPSG:{d['epsg']}"
scene['origin_easting_northing_orthometric_height']=d['origin']
scene['centre_lat_lon']=[d['lat'],d['lon']]
scene['height_scale']=1
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
collections={name:collection(name) for name in ['Terrain','Buildings','Roads','Textures','Annotations','Studio']}
def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9
    return m
stone=material('PLATEAU · warm limestone',(.67,.65,.54))
road=material('PLATEAU · road surface',(.32,.39,.33))
earth=material('Display plinth · not geological strata',(.16,.22,.19))
photo=material('GSI aerial · replace image to update',(.8,.8,.8))
im=bpy.data.images.load(str(ROOT/'aerial.jpg'));im.pack()
tex=photo.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
photo.node_tree.links.new(tex.outputs['Color'],photo.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
def mesh(name,vertices,faces,group,mat):
    m=bpy.data.meshes.new(name);m.from_pydata(vertices,[],faces);m.update()
    obj=bpy.data.objects.new(name,m);collections[group].objects.link(obj);obj.data.materials.append(mat);return obj
terrain=mesh('Terrain',d['terrain']['vertices'],d['terrain']['faces'],'Terrain',photo)
uv=terrain.data.uv_layers.new(name='Projected aerial UV')
r=d['radius']
for poly in terrain.data.polygons:
    for loop in poly.loop_indices:
        x,y,_=terrain.data.vertices[terrain.data.loops[loop].vertex_index].co
        uv.data[loop].uv=((x+r)/(2*r),(y+r)/(2*r))
boundary=[d['terrain']['vertices'][i] for i in d['terrain']['boundary']];n=len(boundary)
bottom=min(v[2] for v in d['terrain']['vertices'])-d['baseDepth']
verts=boundary+[[x,y,bottom] for x,y,z in boundary]
faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]+[tuple(reversed(range(n,n*2)))]
mesh('Cut edge · 70 m display base',verts,faces,'Terrain',earth)
for name,mat in [('Buildings',stone),('Roads',road)]:
    obj=mesh(name,d[name]['vertices'],d[name]['faces'],name,mat)
    obj['source']=d.get('dataset','plateau-23100-nagoya-shi-2022')+' / LOD1';obj['feature_count']=d[name]['count']
    if name=='Buildings':
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.001)
        bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    if name=='Roads':obj.location.z=.25;obj.hide_render=True;obj.hide_set(True)
ref=bpy.data.objects.new('Aerial image stored in GSI aerial material',None)
collections['Textures'].objects.link(ref);ref['image']='aerial.jpg';ref['source']='GSI seamlessphoto z17';ref.hide_render=True
def link_operator(obj,group):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    collections[group].objects.link(obj)
bpy.ops.object.camera_add(location=(r*1.5,-r*2.25,r*2.6))
camera=bpy.context.object;link_operator(camera,'Studio');camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=r*2.9;camera.data.clip_end=r*20;scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(-r,-r,r*3));light=bpy.context.object;link_operator(light,'Studio');light.data.energy=5e7;light.data.shape='DISK';light.data.size=r*2
light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Survey paper');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.65,.60,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
# GLB contains only reusable scene layers, in real metres (glTF exports Y-up).
bpy.ops.object.select_all(action='DESELECT')
for name in ['Terrain','Buildings','Roads']:
    for obj in collections[name].objects:obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'nagoya.glb'),export_format='GLB',use_selection=True)
for obj in collections['Roads'].objects:obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'nagoya.blend'))
scene.render.filepath=str(ROOT/'render-raw.png');bpy.ops.render.render(write_still=True)
print('Saved layered Blender scene, GLB and render')
