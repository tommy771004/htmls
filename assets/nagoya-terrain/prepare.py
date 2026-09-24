"""Public geodata -> metre-based local meshes. Python 3.11+, see README.md."""
import argparse, concurrent.futures, hashlib, io, json, math, pathlib, re
import subprocess, zipfile, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer, CRS
from shapely import Polygon, constrained_delaunay_triangles
from scipy.spatial import Delaunay
from scipy.ndimage import map_coordinates

ROOT = pathlib.Path(__file__).resolve().parent
def fetch(url, target=None, byte_range=None):
    if target and target.exists(): return target.read_bytes()
    args = ['curl', '-fLsS', '--retry', '3', '--max-time', '90']
    if byte_range: args += ['-r', byte_range]
    data = subprocess.check_output(args + [url])
    if target: target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    return data

class RemoteZip(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        headers = subprocess.check_output(['curl','-fLsSI','--max-time','30',url]).decode()
        self.size = int(re.findall(r'(?im)^content-length:\s*(\d+)', headers)[-1])
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else (self.pos if whence == 1 else self.size) + offset
        return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        if n == 0: return b''
        data = fetch(self.url, byte_range=f'{self.pos}-{self.pos+n-1}')
        if len(data) != n: raise ValueError('Server did not honor HTTP Range')
        self.pos += n
        return data

def mesh_code(lat, lon):
    p=int(lat*1.5); q=int(lon)-100; a=(lat*1.5-p)*8; b=(lon-int(lon))*8
    return f'{p:02}{q:02}{int(a)}{int(b)}{int((a%1)*10)}{int((b%1)*10)}'

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--place',default='愛知県体育館')
    p.add_argument('--lat',type=float); p.add_argument('--lon',type=float)
    p.add_argument('--radius',type=float,default=1000)
    p.add_argument('--out',type=pathlib.Path,default=ROOT)
    p.add_argument('--dataset',help='Optional CKAN dataset id; otherwise discover from municipality')
    p.add_argument('--epsg',type=int,help='Optional projected CRS; otherwise choose a Japanese plane zone')
    a=p.parse_args()
    if not 100 <= a.radius <= 5000: p.error('radius must be 100..5000 metres')
    if (a.lat is None) != (a.lon is None): p.error('supply both lat and lon')
    if a.lat is None:
        if a.place == '愛知県体育館': a.lat,a.lon=35.1830861,136.9025611
        else:
            from urllib.parse import quote
            hits=json.loads(fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+quote(a.place)))
            if len(hits)!=1: raise ValueError('Place is missing or ambiguous. Supply --lat and --lon explicitly.')
            a.lon,a.lat=hits[0]['geometry']['coordinates']
    if not a.epsg:
        matches=[]
        for code in range(6669,6688):
            area=CRS.from_epsg(code).area_of_use
            if area.west<=a.lon<=area.east and area.south<=a.lat<=area.north:
                matches.append(((area.east-area.west)*(area.north-area.south),code))
        if not matches:raise ValueError('Outside Japanese plane coordinate coverage; supply --epsg')
        a.epsg=min(matches)[1]
    if not a.dataset:
        if a.place=='愛知県体育館' and abs(a.lat-35.1830861)<.001 and abs(a.lon-136.9025611)<.001:
            a.dataset='plateau-23100-nagoya-shi-2022'
        else:
            rev=json.loads(fetch(f'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat={a.lat}&lon={a.lon}'))['results']
            code=str(rev['muniCd']).zfill(5)
            catalog=json.loads(fetch('https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets'))['datasets']
            cities=[v for v in catalog if v.get('city_code')==code or v.get('ward_code')==code]
            if not cities:raise ValueError('No PLATEAU coverage found; supply --dataset')
            city=cities[0]['city_code']
            hits=json.loads(fetch('https://www.geospatial.jp/ckan/api/3/action/package_search?q=plateau-'+city+'&rows=100'))['result']['results']
            hits=[v for v in hits if v['name'].startswith('plateau-'+city) and any(r['name'].startswith('CityGML') for r in v['resources'])]
            if not hits:raise ValueError('No CityGML dataset found; supply --dataset')
            a.dataset=max(hits,key=lambda v:v['name'])['name']
    a.out.mkdir(parents=True,exist_ok=True)
    cache=a.out/'cache';cache.mkdir(exist_ok=True)
    forward=Transformer.from_crs(4326,a.epsg,always_xy=True)
    city_forward=Transformer.from_crs(6668,a.epsg,always_xy=True)
    inverse=Transformer.from_crs(a.epsg,4326,always_xy=True)
    merc=Transformer.from_crs(a.epsg,3857,always_xy=True)
    cx,cy=forward.transform(a.lon,a.lat);r=a.radius
    def pixels(x,y,z):
        mx,my=merc.transform(x+cx,y+cy);span=2*math.pi*6378137
        return (np.asarray(mx)/span+.5)*256*2**z,(.5-np.asarray(my)/span)*256*2**z
    provenance=[]
    def mosaic(layer,z):
        px,py=pixels(np.array([-r,r,-r,r]),np.array([-r,-r,r,r]),z)
        x0,x1=int(px.min()//256),int(px.max()//256);y0,y1=int(py.min()//256),int(py.max()//256)
        out=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256,3),dtype=np.uint8)
        def tile(xy):
            x,y=xy;ext='jpg' if layer=='seamlessphoto' else 'png'
            url=f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{x}/{y}.{ext}'
            raw=fetch(url,cache/f'{layer}-{z}-{x}-{y}.{ext}')
            return x,y,np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')),url,hashlib.sha256(raw).hexdigest()
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for x,y,img,url,sha in pool.map(tile,[(x,y) for x in range(x0,x1+1) for y in range(y0,y1+1)]):
                out[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=img
                provenance.append({'url':url,'sha256':sha})
        return out,x0*256,y0*256
    print('Downloading DEM5A and aerial tiles',flush=True)
    dem,dx,dy=mosaic('dem5a_png',15)
    code=dem[:,:,0].astype(np.int32)*65536+dem[:,:,1].astype(np.int32)*256+dem[:,:,2]
    missing=code==8388608;heights=np.where(code<8388608,code,code-16777216)*.01
    fallback_count=int(missing.sum())
    if fallback_count:
        low,lx,ly=mosaic('dem_png',14)
        val=low[:,:,0].astype(np.int32)*65536+low[:,:,1].astype(np.int32)*256+low[:,:,2]
        hh=np.where(val<8388608,val,val-16777216)*.01
        sy,sx=np.where(missing);coords=[(sy+dy+.5)/2-ly-.5,(sx+dx+.5)/2-lx-.5]
        if np.any(map_coordinates((val==8388608).astype(float),coords,order=1)>0):raise ValueError('DEM10B also has missing data')
        heights[sy,sx]=map_coordinates(hh,coords,order=1);missing[:]=False
    def elevation(x,y):
        px,py=pixels(x,y,15);coords=[py-dy-.5,px-dx-.5]
        if np.any(map_coordinates(missing.astype(float),coords,order=1)>0): raise ValueError('DEM contains missing elevation in requested area')
        return map_coordinates(heights,coords,order=1)
    z0=float(elevation(np.array([0.]),np.array([0.]))[0])
    photo,ix,iy=mosaic('seamlessphoto',17)
    size=2048;v=(np.arange(size)+.5)/size*2*r-r
    xx,yy=np.meshgrid(v,-v);px,py=pixels(xx,yy,17)
    sampled=np.stack([map_coordinates(photo[:,:,c],[py-iy-.5,px-ix-.5],order=1) for c in range(3)],axis=-1).astype(np.uint8)
    Image.fromarray(sampled).save(a.out/'aerial.jpg',quality=92)
    step=10.;grid=np.arange(-r,r+step,step);xx,yy=np.meshgrid(grid,grid);inside=xx*xx+yy*yy<(r-step*.1)**2
    theta=np.linspace(0,2*math.pi,512,endpoint=False)
    points=np.concatenate([np.column_stack([xx[inside],yy[inside]]),np.column_stack([r*np.cos(theta),r*np.sin(theta)])])
    z=elevation(points[:,0],points[:,1])-z0
    terrain={'vertices':np.column_stack([points,z]).round(4).tolist(),'faces':Delaunay(points).simplices.tolist(),'boundary':list(range(len(points)-512,len(points)))}
    cat=json.loads(fetch('https://www.geospatial.jp/ckan/api/3/action/package_show?id='+a.dataset,cache/(a.dataset+'.json')))['result']
    resources=[v for v in cat['resources'] if v['name'].startswith('CityGML')]
    resource=max(resources,key=lambda v:v['name'])
    print('Reading CityGML archive directory',flush=True)
    archive=zipfile.ZipFile(RemoteZip(resource['url']))
    # Collect all intersecting standard 1 km mesh cells, with a half-cell safety margin.
    lon,lat=inverse.transform(np.array([-r,r,-r,r])+cx,np.array([-r,-r,r,r])+cy)
    codes={mesh_code(la,lo) for la in np.arange(min(lat)-.00834,max(lat)+.00834,.004) for lo in np.arange(min(lon)-.0125,max(lon)+.0125,.006)}
    ns={'g':'http://www.opengis.net/gml','b':'http://www.opengis.net/citygml/building/2.0','t':'http://www.opengis.net/citygml/transportation/2.0'}
    # Convex cylinder clipping interpolates all XYZ values, preserving measured building heights.
    normals=np.column_stack([np.cos(theta),np.sin(theta)])
    def clip(poly):
        poly=np.array(poly)
        if np.all(np.linalg.norm(poly[:,:2],axis=1)<=r):return poly
        if np.linalg.norm(poly[:,:2].mean(axis=0))-np.ptp(poly[:,:2],axis=0).max()>r:return []
        for normal in normals:
            dist=poly[:,:2]@normal-r
            if np.all(dist<=0):continue
            if np.all(dist>0):return []
            result=[]
            for j in range(len(poly)):
                k=(j+1)%len(poly)
                if dist[j]<=0:result.append(poly[j])
                if (dist[j]<=0)!=(dist[k]<=0):result.append(poly[j]+(poly[k]-poly[j])*dist[j]/(dist[j]-dist[k]))
            poly=np.array(result)
        return poly
    groups={k:{'vertices':[],'faces':[],'count':0} for k in ['Buildings','Roads']}
    footprints=[]
    for kind,group,path in [('bldg','Buildings','.//b:Building'),('tran','Roads','.//t:Road')]:
        names=[n for n in archive.namelist() if n.startswith('udx/'+kind+'/') and n.endswith('.gml') and n.split('/')[-1][:8] in codes]
        for name in names:
            dest=cache/pathlib.Path(name).name
            if not dest.exists():dest.write_bytes(archive.read(name))
            print('Process',name,flush=True)
            raw=dest.read_bytes();tree=ET.fromstring(raw)
            env=tree.find('.//g:Envelope',ns)
            if env is None or not env.attrib.get('srsName','').endswith('/6697'):raise ValueError('Expected EPSG:6697 latitude, longitude, orthometric height')
            provenance.append({'url':resource['url']+'#'+name,'sha256':hashlib.sha256(raw).hexdigest()})
            for obj in tree.findall(path,ns):
                geom=obj.find('b:lod1Solid',ns) if kind=='bldg' else obj.find('t:lod1MultiSurface',ns)
                if geom is None:continue
                polys=[]
                for face in geom.findall('.//g:Polygon',ns):
                    rings=[]
                    for ring in face.findall('g:exterior/g:LinearRing/g:posList',ns)+face.findall('g:interior/g:LinearRing/g:posList',ns):
                        arr=np.fromstring(ring.text,sep=' ').reshape(-1,3)[:-1]
                        if len(arr)<3:continue
                        e,n=city_forward.transform(arr[:,1],arr[:,0]);rings.append(np.column_stack([e-cx,n-cy,arr[:,2]-z0]))
                    if not rings:continue
                    candidates=[rings[0]]
                    if len(rings)>1:
                        # Preserve courtyards and road islands via constrained triangulation.
                        allpts=np.concatenate(rings);_,_,vh=np.linalg.svd(allpts-allpts.mean(axis=0),full_matrices=False)
                        axes=[i for i in range(3) if i!=np.argmax(np.abs(vh[-1]))]
                        lookup={tuple(v[axes]):v for v in allpts}
                        shape=Polygon(rings[0][:,axes],[v[:,axes] for v in rings[1:]])
                        candidates=[[lookup[tuple(xy)] for xy in list(t.exterior.coords)[:-1]] for t in constrained_delaunay_triangles(shape).geoms]
                    for candidate in candidates:
                        poly=clip(candidate)
                        if len(poly)>=3:polys.append(np.array(poly))
                if not polys:continue
                g=groups[group];g['count']+=1
                for poly in polys:
                    start=len(g['vertices']);g['vertices'].extend(poly.round(4).tolist());g['faces'].append(list(range(start,start+len(poly))))
                    if kind=='bldg' and np.ptp(poly[:,2])<.1:footprints.append(poly[:,:2].tolist())
    if groups['Buildings']['count']==0:raise ValueError('No PLATEAU buildings intersect this area; choose a matching --dataset')
    data={'place':a.place,'dataset':a.dataset,'datasetTitle':cat['title'],'lat':a.lat,'lon':a.lon,'radius':r,'epsg':a.epsg,'origin':[cx,cy,z0],'heightScale':1,'baseDepth':70,'terrainStep':step,'demFallbackPixels':fallback_count,'terrain':terrain,**groups}
    (a.out/'scene.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
    (a.out/'sources.json').write_text(json.dumps({'dataset':a.dataset,'resource':resource,'tiles':provenance,'crs':{'sourceCityGML':'EPSG:6697; latitude, longitude, orthometric height','sourceTiles':'EPSG:3857 XYZ','target':f'EPSG:{a.epsg}; east, north; subtract origin','origin':data['origin']},'counts':{k:v['count'] for k,v in groups.items()},'demRange':[float(z.min()+z0),float(z.max()+z0)],'photoGroundPixelMetres':math.cos(math.radians(a.lat))*2*math.pi*6378137/(256*2**17)},ensure_ascii=False,indent=2),encoding='utf-8')
    # Independent outline-on-orthophoto proof: no manual offset or rotation applied.
    proof=Image.fromarray(sampled);draw=ImageDraw.Draw(proof)
    for poly in footprints:
        xy=[((x+r)/(2*r)*size,(r-y)/(2*r)*size) for x,y in poly]
        draw.line(xy+[xy[0]],fill='#ffcf4a',width=2)
    draw.ellipse((size/2-8,size/2-8,size/2+8,size/2+8),fill='#ff3b30')
    proof.save(a.out/'alignment.jpg',quality=93)
    print('Done',data['origin'],{k:v['count'] for k,v in groups.items()},flush=True)

if __name__=='__main__':main()
