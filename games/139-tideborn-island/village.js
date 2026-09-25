import * as THREE from '../../vendor/three-0.186.0/three.module.js';

// Buildings share island-relative dimensions; entrances are connected to the road graph.
export function createVillage({config, graph, surface, road, mark}) {
  const group = new THREE.Group(), facilities = [], rotors = [];
  const scale = config.radius / 120;
  const colors = {wall:'#f5e6c4',wood:'#785341',roof:'#b56e52',teal:'#437d7c',stone:'#aaa68a',dark:'#394f4c'};
  function mesh(parent, geometry, color, x=0,y=0,z=0) {
    const m=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color}));
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box=(p,w,h,d,c,x=0,y=0,z=0)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z);
  const cylinder=(p,rt,rb,h,c,x=0,y=0,z=0,n=12)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),c,x,y,z);
  function roof(p,w,d,y,c=colors.roof) {
    const h=w*.42, v=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);g.computeVertexNormals();mesh(p,g,c,0,y,0);
  }
  function house(p,{w=10,d=11,h=7,c=colors.roof,barn=false}={}) {
    box(p,w,h,d,colors.wall,0,h/2,0);roof(p,w+2,d+2,h,c);
    box(p,barn?4:2.2,barn?5:4,.35,colors.wood,0,barn?2.5:2,d/2+.18);
    for(const x of [-w*.32,w*.32]){box(p,1.7,2.1,.3,colors.dark,x,4.4,d/2+.2);box(p,2.3,.4,.5,colors.wall,x,5.55,d/2+.2);}
    for(const z of [-d*.26,d*.26])box(p,.3,2,1.8,colors.dark,w/2+.16,4.3,z);
    if(!barn){box(p,1.5,4,1.5,colors.stone,w*.27,h+1,-d*.22);box(p,4,.4,2,colors.stone,0,.2,d/2+1);}
    else {box(p,w+.1,.5,d+.1,colors.wood,0,1,0);for(const x of [-w/2,w/2])box(p,.5,h,.5,colors.wood,x,h/2,d/2+.1);}
  }
  function fence(p,w,d){for(const z of [-d/2,d/2])for(let i=0;i<=6;i++){if(z>0&&i===3)continue;const x=-w/2+i*w/6;box(p,.45,2.7,.45,colors.wood,x,1.35,z);}
    for(const x of [-w/2,w/2])for(let i=1;i<6;i++)box(p,.45,2.7,.45,colors.wood,x,1.35,-d/2+i*d/6);
    for(const y of [1,2]){box(p,w,.23,.25,colors.wall,0,y,-d/2);for(const x of [-w/2,w/2])box(p,.25,.23,d,colors.wall,x,y,0);for(const x of [-w*.29,w*.29])box(p,w*.42,.23,.25,colors.wall,x,y,d/2);}
  }
  function barrel(p,x,z){cylinder(p,.85,.8,1.9,colors.wood,x,.95,z);for(const y of [.3,1.5])cylinder(p,.88,.88,.12,colors.dark,x,y,z);}
  function stall(p,x,z,c){const g=new THREE.Group();g.position.set(x,0,z);p.add(g);for(const a of [-2.7,2.7])for(const b of [-1.8,1.8])box(g,.3,5,.3,colors.wood,a,2.5,b);for(let i=0;i<6;i++){const m=box(g,1, .3,5,i%2?colors.wall:c,-2.5+i,5.2,0);m.rotation.x=-.12;}box(g,6,2.3,2.5,colors.wood,0,1.15,.5);for(let i=0;i<5;i++)cylinder(g,.45,.45,.65,i%2?'#d99845':'#81954e',-2+i,2.65,.5,7);}
  function place(spec){
    const edge=graph.edges.find(e=>e.from===spec.spoke+1&&e.to===spec.spoke+7);
    const k=spec.k??18, anchor=edge.points[k], prev=edge.points[k-1],next=edge.points[k+1];
    const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz),side=spec.side??1;
    const x=anchor[0]-dz/len*spec.offset*scale*side,z=anchor[1]+dx/len*spec.offset*scale*side;
    const yaw=Math.atan2(anchor[0]-x,anchor[1]-z),w=spec.w,d=spec.d;
    const world=(lx,lz)=>[x+(lx*Math.cos(yaw)+lz*Math.sin(yaw))*scale,z+(-lx*Math.sin(yaw)+lz*Math.cos(yaw))*scale];
    let min=Infinity,max=-Infinity;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const [px,pz]=world(a*w/2,b*d/2),h=surface(px,pz);min=Math.min(min,h);max=Math.max(max,h);}
    const base=max+.12, root=new THREE.Group();root.position.set(x,base,z);root.rotation.y=yaw;root.scale.setScalar(scale);group.add(root);
    box(root,w,(base-min)/scale+.5,d,colors.stone,0,-((base-min)/scale+.5)/2,0);
    spec.build(root);
    const door=world(0,d/2),doorHeight=surface(...door),steps=Math.max(2,Math.ceil((base-doorHeight)/(.5*scale))),run=3*scale;
    for(let i=0;i<steps;i++){const depth=run/scale/steps,top=-(base-doorHeight)/scale*(i+1)/steps;box(root,3.4,.5,depth+.1,colors.stone,0,top-.25,d/2+(i+.5)*depth);}
    const entrance=world(0,d/2+run/scale),id=graph.nodes.length;
    const branch=Array.from({length:17},(_,i)=>[anchor[0]+(entrance[0]-anchor[0])*i/16,anchor[1]+(entrance[1]-anchor[1])*i/16]);road(branch,2.1*scale);
    const source=graph.nodes.find(n=>n.id===edge.to),points=[...edge.points.slice(k).reverse(),...branch.slice(1)];
    graph.nodes.push({id,x:entrance[0],z:entrance[1],facility:spec.name});graph.edges.push({from:source.id,to:id,points});
    const record={name:spec.name,type:spec.type,description:spec.description,root,x,z,base,w:w*scale,d:d*scale,yaw,node:id,foundationMin:min};facilities.push(record);root.userData.facility=record;
    return root;
  }
  const home=(name,spoke,side,c,k)=>place({name,type:'住家',description:'居民的家，也是工作、交易後返回休息的地方。',spoke,side,k,offset:15,w:13,d:16,build:p=>{house(p,{c});barrel(p,-5,5);}});
  home('海風小屋',1,1,colors.teal,12);home('暖陽小屋',1,-1,colors.roof,12);home('麥穗小屋',2,1,'#c49554',21);home('松木小屋',4,-1,colors.teal,14);home('潮汐小屋',5,1,colors.roof,20);
  place({name:'穀倉',type:'穀倉',description:'存放農產與食物的共用倉庫，透過環島道路連接農田與市集。',spoke:2,side:-1,offset:17,w:17,d:19,build:p=>{house(p,{w:13,d:14,h:9,c:'#ab6451',barn:true});barrel(p,-7,7);barrel(p,7,7);}});
  place({name:'海風市集',type:'市集',description:'三座遮陽攤位與中央交易空間，居民在此交易、交付貨物並聚會。',spoke:0,k:20,side:-1,offset:21,w:28,d:20,build:p=>{box(p,28,.2,20,'#dccba0',0,.1,0);stall(p,-8,-4,'#af6953');stall(p,0,-4,'#668e86');stall(p,8,-4,'#c69b52');barrel(p,-10,5);box(p,5,1,2,colors.wood,7,.5,6);}});
  place({name:'海丘風車',type:'風車',description:'高地邊緣的磨坊；風翼可轉動，替島上農產提供磨坊風景。',spoke:3,side:1,offset:16,w:15,d:18,build:p=>{cylinder(p,3.5,5.5,14,colors.wall,0,7,0);cylinder(p,0,5.5,5,colors.teal,0,16.5,0,8);box(p,2.5,4,.4,colors.wood,0,2,5);const rotor=new THREE.Group();rotor.position.set(0,12,5);p.add(rotor);for(let i=0;i<4;i++){const blade=new THREE.Group();blade.rotation.z=i*Math.PI/2;rotor.add(blade);box(blade,.4,12,.4,colors.wood,0,4,0);box(blade,2.2,6,.3,colors.wall,1,6,0);for(let j=0;j<4;j++)box(blade,2.3,.18,.4,colors.wood,1,3.5+j*1.6,0);}cylinder(rotor,.8,.8,1,colors.wood).rotation.x=Math.PI/2;rotors.push(rotor);}});
  place({name:'木匠工坊',type:'工坊',description:'木材加工與製作區；工作棚、木料堆和工作檯已就位。',spoke:4,side:1,offset:17,w:21,d:19,build:p=>{house(p,{w:11,d:10,h:6,c:colors.teal});for(let i=0;i<4;i++){const log=cylinder(p,1,1,8,colors.wood,-8,1+i*.55,-4+i*.5);log.rotation.x=Math.PI/2;}box(p,6,1.6,3,colors.wood,3,.8,7);box(p,2,.4,2,colors.stone,3,1.8,7);}});
  place({name:'紅蘿蔔田',type:'農田',description:'六排整齊耕作的菜畦，農夫會定期收成並搬運到市集。',spoke:0,k:18,side:1,offset:17,w:20,d:19,build:p=>{box(p,20,.25,19,'#886646',0,.13,0);for(let i=0;i<6;i++){box(p,2,.5,16,'#695038',-8+i*3.2,.4,0);for(let j=0;j<6;j++){const x=-8+i*3.2,z=-7+j*2.6;cylinder(p,.3,.4,.55,'#d48839',x,.85,z,5);for(let n=0;n<3;n++){const leaf=mesh(p,new THREE.ConeGeometry(.5,1.5,4),'#78964c',x,.8+1,z);leaf.rotation.z=(n-1)*.5;}}}}});
  place({name:'青草牧場',type:'牧場',description:'圍欄、草地、飲水槽與遮蔭棚；牧羊人在此工作並把食物送往市集。',spoke:3,side:-1,offset:23,w:30,d:27,build:p=>{box(p,30,.2,27,'#99ab69',0,.1,0);fence(p,30,27);for(const x of [-10,-3])for(const z of [-10,-4])box(p,.5,5,.5,colors.wood,x,2.5,z);const shelter=new THREE.Group();shelter.position.set(-6.5,0,-7);p.add(shelter);roof(shelter,9,9,5,colors.roof);box(p,7,1.3,2.8,colors.wood,8,.65,-8);box(p,6,.1,1.8,'#73bcc3',8,1.31,-8);for(let i=0;i<3;i++)cylinder(p,1.8,1.8,2,'#c5b168',-8+i*4,1,7);}});
  // The dock continues the eastern spoke with a terrain-following approach and level piles over water.
  const end=graph.nodes.find(n=>n.id===7),dir=new THREE.Vector2(end.x,end.z).normalize(),dockStart=[end.x+dir.x*10*scale,end.z+dir.y*10*scale];
  const approach=Array.from({length:21},(_,i)=>[end.x+(dockStart[0]-end.x)*i/20,end.z+(dockStart[1]-end.z)*i/20]);road(approach,3.5*scale);
  const dock=new THREE.Group();dock.position.set(...[dockStart[0],surface(...dockStart)+.4,dockStart[1]]);dock.rotation.y=Math.atan2(dir.x,dir.y);dock.scale.setScalar(scale);group.add(dock);
  for(let i=0;i<31;i++){box(dock,i>24?21:5,.65,1.15,colors.wood,0,0,i*1.15);if(i%5===0)for(const x of [-2.1,2.1]){box(dock,.6,8,.6,colors.wood,x,-3,i*1.15);box(dock,.85,.2,.85,colors.wall,x,1.1,i*1.15);}}
  for(const x of [-9,9])box(dock,.8,8,.8,colors.wood,x,-3,32);barrel(dock,7,32);barrel(dock,-7,32);
  const dockId=graph.nodes.length;graph.nodes.push({id:dockId,x:dockStart[0],z:dockStart[1],facility:'潮汐碼頭'});graph.edges.push({from:7,to:dockId,points:approach});
  const dockRecord={name:'潮汐碼頭',type:'碼頭與棧橋',description:'沿東側主路走向海面，以架高棧橋銜接 T 字碼頭；漁夫在此工作；升級可增加每趟漁獲。',root:dock,x:dockStart[0],z:dockStart[1],node:dockId};facilities.push(dockRecord);dock.userData.facility=dockRecord;
  const tower=new THREE.Group();tower.position.set(config.radius*.98,6.6,-config.radius*1.12);tower.scale.setScalar(scale);group.add(tower);
  cylinder(tower,6,7,1.2,colors.stone,0,.6);for(let i=0;i<4;i++)cylinder(tower,3.8-i*.5,4.3-i*.5,5,i%2?colors.wall:colors.roof,0,3.7+i*5);cylinder(tower,4.2,4.2,.8,colors.dark,0,22);cylinder(tower,2.5,2.5,3,'#ebc778',0,24);for(let i=0;i<8;i++){const a=i*Math.PI/4;box(tower,.22,3,.22,colors.dark,Math.cos(a)*2.5,24,Math.sin(a)*2.5);}cylinder(tower,0,4,3,colors.teal,0,27);box(tower,1.6,3,.3,colors.wood,0,2.7,4.3);
  const lighthouse={name:'守潮燈塔',type:'燈塔',description:'礁島上的航海地標；獨立選址，未與主島陸路相連。',root:tower,x:tower.position.x,z:tower.position.z};facilities.push(lighthouse);tower.userData.facility=lighthouse;
  mark('海風市集',facilities[6].x,facilities[6].z,facilities[6].base+9*scale);mark('守潮燈塔',tower.position.x,tower.position.z,6.6+30*scale);mark('潮汐碼頭',dock.position.x,dock.position.z,dock.position.y+5);
  const improvements=new THREE.Group();group.add(improvements);
  const greenhouse=new THREE.Group();const field=facilities.find(f=>f.type==='農田');greenhouse.position.copy(field.root.position);greenhouse.rotation.copy(field.root.rotation);greenhouse.scale.setScalar(scale);improvements.add(greenhouse);
  for(const x of [-9,9])for(const z of [-8,0,8])box(greenhouse,.35,6,.35,colors.wall,x,3,z);
  for(const z of [-8,0,8])box(greenhouse,18,.35,.35,colors.wall,0,6,z);
  const glass=box(greenhouse,18,.18,17,'#a6d8cd',0,6,0);glass.material.transparent=true;glass.material.opacity=.38;glass.castShadow=false;
  const bakery=new THREE.Group();bakery.position.set(24*scale,surface(24*scale,18*scale)+1.5*scale,18*scale);bakery.scale.setScalar(scale);bakery.rotation.y=Math.PI;improvements.add(bakery);box(bakery,13,5,14,colors.stone,0,-2.5,0);house(bakery,{w:10,d:11,h:7,c:'#be9855'});barrel(bakery,-5,5);
  const roadEdge=graph.edges.find(e=>e.from===0&&e.to===1);const bakeryDoor=[24*scale,9*scale];const bakeryAnchor=roadEdge.points.reduce((best,p)=>Math.hypot(p[0]-bakeryDoor[0],p[1]-bakeryDoor[1])<Math.hypot(best[0]-bakeryDoor[0],best[1]-bakeryDoor[1])?p:best);const bakeryPath=road(Array.from({length:20},(_,i)=>[bakeryAnchor[0]+(bakeryDoor[0]-bakeryAnchor[0])*i/19,bakeryAnchor[1]+(bakeryDoor[1]-bakeryAnchor[1])*i/19]),2.2*scale);
  const pennants=new THREE.Group();dock.add(pennants);for(const x of [-9,9]){box(pennants,.3,7,.3,colors.wall,x,3.5,32);box(pennants,3,1.8,.15,colors.teal,x+1.5,6,32);}
  const pasture=facilities.find(f=>f.type==='牧場');for(let i=0;i<4;i++){const sheep=new THREE.Group();sheep.position.set(-4+i*4,0,1+(i%2)*3);pasture.root.add(sheep);mesh(sheep,new THREE.IcosahedronGeometry(1.3,1),'#f1e9d2',0,1.6,0);box(sheep,.8,.8,1,colors.dark,0,1.7,1.3);for(const x of [-.65,.65])for(const z of [-.65,.65])box(sheep,.23,1,.23,colors.dark,x,.5,z);}
  function applyUpgrades(upgrades){greenhouse.visible=!!upgrades.garden;bakery.visible=!!upgrades.bakery;bakeryPath.visible=!!upgrades.bakery;pennants.visible=!!upgrades.dock;}
  applyUpgrades({});return {group,facilities,rotors,applyUpgrades};
}
