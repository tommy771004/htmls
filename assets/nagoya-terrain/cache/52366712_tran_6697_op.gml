<?xml version="1.0" encoding="UTF-8"?>
<core:CityModel xmlns:brid="http://www.opengis.net/citygml/bridge/2.0" xmlns:tran="http://www.opengis.net/citygml/transportation/2.0" xmlns:frn="http://www.opengis.net/citygml/cityfurniture/2.0" xmlns:wtr="http://www.opengis.net/citygml/waterbody/2.0" xmlns:sch="http://www.ascc.net/xml/schematron" xmlns:veg="http://www.opengis.net/citygml/vegetation/2.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:tun="http://www.opengis.net/citygml/tunnel/2.0" xmlns:tex="http://www.opengis.net/citygml/texturedsurface/2.0" xmlns:gml="http://www.opengis.net/gml" xmlns:app="http://www.opengis.net/citygml/appearance/2.0" xmlns:gen="http://www.opengis.net/citygml/generics/2.0" xmlns:dem="http://www.opengis.net/citygml/relief/2.0" xmlns:luse="http://www.opengis.net/citygml/landuse/2.0" xmlns:uro="https://www.geospatial.jp/iur/uro/3.1" xmlns:xAL="urn:oasis:names:tc:ciq:xsdschema:xAL:2.0" xmlns:bldg="http://www.opengis.net/citygml/building/2.0" xmlns:smil20="http://www.w3.org/2001/SMIL20/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:smil20lang="http://www.w3.org/2001/SMIL20/Language" xmlns:pbase="http://www.opengis.net/citygml/profiles/base/2.0" xmlns:core="http://www.opengis.net/citygml/2.0" xmlns:grp="http://www.opengis.net/citygml/cityobjectgroup/2.0" xsi:schemaLocation="https://www.geospatial.jp/iur/uro/3.1 ../../schemas/iur/uro/3.1/urbanObject.xsd http://www.opengis.net/citygml/2.0 http://schemas.opengis.net/citygml/2.0/cityGMLBase.xsd http://www.opengis.net/citygml/landuse/2.0 http://schemas.opengis.net/citygml/landuse/2.0/landUse.xsd http://www.opengis.net/citygml/building/2.0 http://schemas.opengis.net/citygml/building/2.0/building.xsd http://www.opengis.net/citygml/transportation/2.0 http://schemas.opengis.net/citygml/transportation/2.0/transportation.xsd http://www.opengis.net/citygml/generics/2.0 http://schemas.opengis.net/citygml/generics/2.0/generics.xsd http://www.opengis.net/citygml/relief/2.0 http://schemas.opengis.net/citygml/relief/2.0/relief.xsd http://www.opengis.net/citygml/cityobjectgroup/2.0 http://schemas.opengis.net/citygml/cityobjectgroup/2.0/cityObjectGroup.xsd http://www.opengis.net/gml http://schemas.opengis.net/gml/3.1.1/base/gml.xsd http://www.opengis.net/citygml/appearance/2.0 http://schemas.opengis.net/citygml/appearance/2.0/appearance.xsd">
	<gml:boundedBy>
		<gml:Envelope srsName="http://www.opengis.net/def/crs/EPSG/0/6697" srsDimension="3">
			<gml:lowerCorner>35.174662173987755 136.89988278646172 0</gml:lowerCorner>
			<gml:upperCorner>35.1833718623902 136.91281405223228 0</gml:upperCorner>
		</gml:Envelope>
	</gml:boundedBy>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c6c09c22-4baa-4666-84a2-9ad034e168ff">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18241563979664 136.90567011800312 0 35.18252731766599 136.90550737607796 0 35.182335372413256 136.90497569642693 0 35.182184321399596 136.90486484573447 0 35.181726022517424 136.90490419536138 0 35.18163060157279 136.90509049734789 0 35.181801968974746 136.90563509134677 0 35.181965498823565 136.90580618184939 0 35.18241563979664 136.90567011800312 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b8f2a232-e385-4d79-a746-46f3cea7f0ee">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17871327377034 136.90107878363656 0 35.17871534400109 136.90108089440324 0 35.17872924519685 136.90109506779342 0 35.17885764715008 136.90122598590924 0 35.17913205261894 136.9011990467923 0 35.17913170564113 136.90119380378948 0 35.17911016586902 136.90086712819675 0 35.179220244638664 136.90070855712358 0 35.17919291182545 136.90036261581673 0 35.17895911772693 136.90039001882388 0 35.17895904096837 136.9003551047883 0 35.178851884706845 136.900366653195 0 35.178775550354 136.90037480725812 0 35.17875734542547 136.90037673311278 0 35.178761123910824 136.9005373480748 0 35.178706664202394 136.90061372192844 0 35.178615989614784 136.9007318668755 0 35.178519758769504 136.90085725014313 0 35.17871327377034 136.90107878363656 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d58e6a28-3f8e-4f8d-be71-60f1d09d488c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17830468486876 136.90536410544001 0 35.17803272465792 136.90549200523768 0 35.17791788986292 136.90566353822126 0 35.177923541745784 136.90611147141723 0 35.177945814117 136.90613470479803 0 35.17800586330573 136.90619734501522 0 35.17806330865979 136.9062572685869 0 35.178328414761346 136.90625790200943 0 35.1783834716696 136.90616959480596 0 35.17841355403669 136.9061215282353 0 35.17842903991778 136.90609679304043 0 35.17844260509597 136.90607512059418 0 35.17844353350184 136.90552258599462 0 35.17843110807972 136.90550840758505 0 35.17838174882675 136.905452067287 0 35.17830468486876 136.90536410544001 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_599d9d67-29b1-4730-be41-487722c2d60b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180222683345335 136.9057898772206 0 35.18034410187714 136.9057779845647 0 35.18045964249884 136.90576663583306 0 35.18061348639927 136.90575154140967 0 35.180652150255966 136.90574779459521 0 35.18075473795424 136.9057377006119 0 35.180718653703046 136.90519366259144 0 35.18070635803781 136.90518114682874 0 35.18058015800411 136.90505268946526 0 35.180579115786095 136.9050378632884 0 35.18030966346306 136.90506596304866 0 35.18018654701514 136.90524257852212 0 35.180222683345335 136.9057898772206 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c47f279d-dfcb-42bd-9762-d74e5beaaa60">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18126149968708 136.90216143203924 0 35.18131028684915 136.90221145099014 0 35.181370186591515 136.90227285285857 0 35.18139936867184 136.90230284263447 0 35.181848986086955 136.90225451143704 0 35.181802800140574 136.9016171083248 0 35.18135461602553 136.90166528901835 0 35.181308364970405 136.90173213503482 0 35.18123842668968 136.901833215488 0 35.18126149968708 136.90216143203924 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_712c68d2-6778-4a83-a680-4dc3903653e5">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.181534391768395 136.90399558223925 0 35.181976843796264 136.90391369433078 0 35.18197094927864 136.90386644485972 0 35.18196232755264 136.903797338679 0 35.18194850590883 136.90365914827768 0 35.18193041189125 136.90338021148258 0 35.18192505133427 136.90330598939548 0 35.18146530301869 136.9033552503837 0 35.1813518056249 136.90351855455202 0 35.18137513649956 136.9038555870876 0 35.18138760076052 136.90385430706345 0 35.18148313327048 136.90394624967783 0 35.181534391768395 136.90399558223925 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ea0d1a57-4ed7-4eca-93b5-5ac9a1a4dbf3">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18306086836702 136.9087918837351 0 35.18305292962324 136.90878352934632 0 35.18300382705403 136.90873185721642 0 35.182875210271256 136.90878277095288 0 35.18284425646726 136.9088090007981 0 35.182836882920675 136.90883325883277 0 35.18283633954874 136.9088350458739 0 35.182832798242664 136.90884669790424 0 35.182817821363116 136.9088829787289 0 35.18280164923828 136.90890828345937 0 35.18278645233392 136.90892589920435 0 35.18277268814754 136.9089390086811 0 35.182752338327994 136.90894972337608 0 35.182732310907525 136.90895266331765 0 35.182730169746776 136.90895297751237 0 35.182711959779766 136.90895259580273 0 35.182697074617415 136.90894726266947 0 35.18266783370585 136.9089312146175 0 35.18264760365984 136.90891349115293 0 35.18262103878031 136.90888414907886 0 35.182593948314526 136.90890476689438 0 35.182502793474036 136.90902297790362 0 35.1825004740167 136.90905011779714 0 35.182490993755124 136.90906967934598 0 35.182480925445056 136.90908277708985 0 35.18246580091244 136.90909204784938 0 35.182440929882155 136.9090961888457 0 35.18240568321647 136.90909608045098 0 35.18239548016325 136.9090882071851 0 35.182382098260724 136.9090691445568 0 35.182374856637864 136.90905500346778 0 35.18223414317179 136.9091406505588 0 35.18220798464357 136.90917520956532 0 35.1826143489528 136.90930539598384 0 35.182660418042104 136.90934397004753 0 35.18301713975617 136.9093116628032 0 35.18303304797774 136.90928090740408 0 35.183041828018496 136.90926393226732 0 35.183158850850624 136.90925425782999 0 35.18317990486514 136.90925251700907 0 35.18321901595465 136.90903510125437 0 35.183246203602366 136.90897583371773 0 35.18306291384325 136.9087940363057 0 35.18306086836702 136.9087918837351 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6c595c01-097f-41cb-b47d-4854100d1f37">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18168403574573 136.89999607367469 0 35.181227432593424 136.8999450823919 0 35.181110179872746 136.90012026106277 0 35.18112848988943 136.90049405758177 0 35.18119648194473 136.90056206447346 0 35.181274122572425 136.90063972189057 0 35.181717091356155 136.90043438536654 0 35.18173144700712 136.9004037051679 0 35.18171723087161 136.90004702088146 0 35.18168403574573 136.89999607367469 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
							<gml:interior>
								<gml:LinearRing>
									<gml:posList>35.18163868761698 136.90025126854036 0 35.1816291465937 136.90024582140904 0 35.18162371865186 136.900237055367 0 35.18162300786154 136.90023006964864 0 35.18162261301699 136.9002261890787 0 35.18162412444623 136.90021663181275 0 35.181625487869105 136.90021431067424 0 35.181629423116966 136.90020761117066 0 35.18163536052237 136.90020210194507 0 35.181645180869175 136.90019965436025 0 35.18164534692074 136.90020191927488 0 35.18164541993648 136.90020291519696 0 35.18164559392945 136.9002052884315 0 35.18164585448652 136.90020884238746 0 35.1816460930597 136.9002120964877 0 35.181646209634046 136.90021368654376 0 35.18164625262973 136.9002142729984 0 35.18164657515937 136.90021867225462 0 35.181648572830056 136.9002459202342 0 35.181649084044615 136.90025289315093 0 35.181640428802424 136.90025226261272 0 35.18163868761698 136.90025126854036 0</gml:posList>
								</gml:LinearRing>
							</gml:interior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_cda22675-acc9-4235-89bb-705e433ce8dd">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1803610156323 136.90021372708995 0 35.18034117360385 136.90019266724593 0 35.18033110802016 136.90018198408632 0 35.180267035542826 136.9001128949293 0 35.1802225871549 136.90006496737595 0 35.179951867973436 136.90009878975596 0 35.17994387392322 136.90011146529994 0 35.17989850839994 136.90018339602562 0 35.17988674329472 136.90020330724704 0 35.179872642903 136.90022706889394 0 35.17983689756135 136.9002871333552 0 35.179856692222145 136.90063939951506 0 35.18000807273988 136.9007753811729 0 35.180277542640404 136.90074727442672 0 35.18039444136771 136.9005836972772 0 35.1803610156323 136.90021372708995 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1063779b-13a4-48c7-84f9-4625eb24816e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17917559597465 136.90592082249296 0 35.17924840514903 136.90590730924364 0 35.17954542133133 136.90586101569016 0 35.1796039667718 136.9058530552387 0 35.17955340996802 136.9053014790989 0 35.17946448795812 136.90521835979604 0 35.179414577978655 136.9051717078514 0 35.17914925141426 136.90520057635825 0 35.179152598979464 136.90524621839884 0 35.17910166777126 136.9053299343638 0 35.17917559597465 136.90592082249296 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_84d8e89f-c66b-4ab8-af64-ac185e0fdd3b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18008269298503 136.90365670448864 0 35.180105855219 136.9039867831538 0 35.18024381248543 136.9041283043609 0 35.18051526262507 136.90409723006098 0 35.18063001610133 136.90393206549373 0 35.18060622294345 136.90360209655486 0 35.18046826531018 136.90346068541135 0 35.18019879474936 136.90348878327595 0 35.18008269298503 136.90365670448864 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_60158e5b-c1ba-4d9a-a95d-29e2ef043ca8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180080274170706 136.9018020573913 0 35.17999148149972 136.90193048468566 0 35.179960583311946 136.90197035251225 0 35.17998688678639 136.90229819338208 0 35.18012475563177 136.90243960201576 0 35.180394494452194 136.90241062148567 0 35.180415746374635 136.90237981440487 0 35.18042774269759 136.9023624235187 0 35.18049145402191 136.90227031850756 0 35.180510594472366 136.9022426978681 0 35.180487521705544 136.90191448430974 0 35.180349652016346 136.9017729661481 0 35.180080274170706 136.9018020573913 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f438dc45-8c12-431a-a5fd-ede4535189d6">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17935689210562 136.90236647780995 0 35.17933291511851 136.90203831855212 0 35.17922327592886 136.90193426885793 0 35.17917766748927 136.9018885383586 0 35.17890842825159 136.90191785271577 0 35.17892426636683 136.90213365020804 0 35.17895560438904 136.90256075831707 0 35.17922801882703 136.90253110750876 0 35.17933637866606 136.90236870122055 0 35.17935689210562 136.90236647780995 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b959b684-2a32-485b-8989-f79b1e4bfe6d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.178016228869794 136.90767538375425 0 35.17831328231339 136.9076748416272 0 35.17831258737945 136.90711054945038 0 35.17831255761491 136.9070966596955 0 35.17831247043903 136.90705598294838 0 35.17832689254198 136.907055937094 0 35.1783268203015 136.90699733929853 0 35.17805976028922 136.90699782803156 0 35.177940575517376 136.90715960129737 0 35.17791336166428 136.9071620997122 0 35.17792811041312 136.90740041473896 0 35.177977614184336 136.90757570525642 0 35.17799347643771 136.90757422762778 0 35.178016228869794 136.90767538375425 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4521efe4-524e-4e05-b734-bf3c4ed2e2cf">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18268996375251 136.90762592597932 0 35.182679586695144 136.90760949819347 0 35.1826709305492 136.90759451951843 0 35.1826180022167 136.90750388429026 0 35.18260716236419 136.90748534961614 0 35.18258832629161 136.90745314190409 0 35.18255805659919 136.90737769684262 0 35.182551436618034 136.90735927176948 0 35.18254363447316 136.90733057004962 0 35.18207547777645 136.90736078350963 0 35.18196859604128 136.9075008950983 0 35.18197982106321 136.90764746324828 0 35.18199694029846 136.9076455181719 0 35.18210958686186 136.9077561661654 0 35.18212216553965 136.9078628495686 0 35.18212310149476 136.90787363608018 0 35.1822816103167 136.90785323090293 0 35.18228322155668 136.90780278137134 0 35.18229535637622 136.90774734218806 0 35.18231717190525 136.90770587919658 0 35.182350901145 136.90767085646522 0 35.18238754432451 136.90764954920743 0 35.18242520772849 136.90764163405362 0 35.18247822444584 136.90764717534546 0 35.18251710902591 136.90766231392018 0 35.182548823234434 136.90768785667603 0 35.18256095236907 136.90769891879964 0 35.18258610959095 136.90772325264018 0 35.18268996375251 136.90762592597932 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c481ce75-8cdc-4bd5-aec7-3ea9a791740a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17934923588842 136.9042189061582 0 35.17946048830973 136.90405912761386 0 35.17946947865712 136.9040581198204 0 35.17944407156977 136.90372189320175 0 35.17930124200345 136.90357852326454 0 35.17903241835821 136.90360777699522 0 35.17907940147195 136.90424826867815 0 35.17934923588842 136.9042189061582 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5e11afdc-1c0a-4a38-8d85-73b8336ba097">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17834981967907 136.90833505725072 0 35.178342774085294 136.90820157180468 0 35.17834220032734 136.90819839196112 0 35.17832744946907 136.9081166408986 0 35.17801779365892 136.90794360091178 0 35.178000399425414 136.90794530290745 0 35.17797323636145 136.9081426477946 0 35.177972792754986 136.9081458706604 0 35.17796550088433 136.90836174489633 0 35.17798089482624 136.90837864589713 0 35.17799596438641 136.90839519000812 0 35.17806965683637 136.9084760944365 0 35.17810177254641 136.90851837158587 0 35.17834436067843 136.90835330008503 0 35.17834981967907 136.90833505725072 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3a9f2a43-985d-4e3a-8ad2-852c7f38ea7d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175497171520504 136.9064268414115 0 35.175677660935996 136.9063943176345 0 35.17570517912187 136.90636359879778 0 35.17566689734519 136.90591633088462 0 35.17564132425142 136.9058874282703 0 35.175460501676916 136.9058907504313 0 35.17544652263236 136.9059140384258 0 35.17541764648094 136.90595248088835 0 35.17545751747603 136.90638931027075 0 35.175483178791545 136.90641359718 0 35.175497171520504 136.9064268414115 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3de0e631-f4d8-49f2-9a78-4b47cf35362e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17788234280887 136.90373230223284 0 35.17791202613938 136.90376787256565 0 35.17794868222969 136.90381179760715 0 35.17821311611127 136.90378897625914 0 35.178193440859104 136.90345079465587 0 35.17791874212104 136.9034745032866 0 35.17787585995442 136.90352821995666 0 35.177870490115566 136.90352868364906 0 35.17788234280887 136.90373230223284 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_fb15584f-89b0-4e74-9f2a-cedddf8a2957">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17698062089779 136.90577160379928 0 35.17695557761545 136.90575013739326 0 35.17694323207838 136.90573955459462 0 35.176811807399865 136.90574228014916 0 35.176772798739194 136.90579521399187 0 35.176804863892954 136.90624382521287 0 35.17683621294638 136.9062758938547 0 35.17697707323507 136.90625941523083 0 35.17700501306138 136.90621519025106 0 35.17698062089779 136.90577160379928 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1abdd0f3-914f-4ab4-865b-b6c2c06c7645">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177763771160386 136.90140246391604 0 35.17806748670974 136.90128773257746 0 35.178085250131424 136.9012488633096 0 35.178085970226476 136.90100166387526 0 35.17807288725901 136.90100028792688 0 35.178053655181465 136.90098189663783 0 35.17778188228087 136.90109936661503 0 35.17775850490268 136.901138322097 0 35.17772806002155 136.90135493033034 0 35.177745558479515 136.90137822068425 0 35.177763771160386 136.90140246391604 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1414cda3-3a5f-429a-97de-8d1a7e14829a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17580773996381 136.90761409948016 0 35.17577179218418 136.9073705915326 0 35.175742780808044 136.9073355511569 0 35.1755627960368 136.90735127359144 0 35.175527355987 136.90738717726686 0 35.17553581643949 136.9076338457713 0 35.175552347505075 136.90765004207535 0 35.17558682795384 136.90775554957207 0 35.175777930978484 136.9077540653525 0 35.17580773996381 136.90761409948016 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5a87ab54-f9bf-4a74-b6dd-44ab8e0f485a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17561906966905 136.90824807006888 0 35.1755951745593 136.90837165814483 0 35.175591800543664 136.90860727568574 0 35.175646077083094 136.90865409382306 0 35.175824869114955 136.90862849698647 0 35.175850654786956 136.9085882326602 0 35.175846542376384 136.90835055205872 0 35.17581149909583 136.90823450599763 0 35.17561906966905 136.90824807006888 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_57981053-e8ec-4efc-a3cc-792dca3095a6">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1778554584895 136.90256233677755 0 35.17814032782167 136.9025377555901 0 35.17812571305772 136.90228651585284 0 35.17781209726036 136.90231357897972 0 35.1777960082197 136.90232841672835 0 35.177759648633725 136.90236194735652 0 35.17777181147277 136.90252046987118 0 35.177809744720555 136.9025161524903 0 35.1778554584895 136.90256233677755 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f1b5f03f-5d5c-4c5c-bb48-ce671ae8956a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17712682917433 136.90747844784406 0 35.17712661627961 136.90747520200046 0 35.17708085711708 136.90723852839045 0 35.17704708572345 136.90721173693808 0 35.176910511284035 136.90720909675008 0 35.176878978978046 136.90725970060575 0 35.176874558303226 136.9075106958922 0 35.176874805536194 136.90751395460953 0 35.176877897665754 136.90755471131456 0 35.176929571231774 136.90760658811064 0 35.17707891955054 136.90759678207286 0 35.17712987772584 136.90752492693193 0 35.17712682917433 136.90747844784406 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_099461d5-b003-44fb-97d6-e5a7524b6ee8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176961505500046 136.90812371073002 0 35.17691639459937 136.90819005730967 0 35.176919205349655 136.90822665872602 0 35.17691945438255 136.9082299016239 0 35.17696646262334 136.90846141121617 0 35.17700455853974 136.9084872013702 0 35.17710217492154 136.9084825010939 0 35.177119414428894 136.9084504974328 0 35.17716935919994 136.90819913775837 0 35.17716684214353 136.908160169933 0 35.17715111189825 136.90813903007944 0 35.17710774702417 136.90809426290247 0 35.176961505500046 136.90812371073002 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5d32f27f-b6b8-4fcf-a5e9-7737d94f1766">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17770179661401 136.89994507113988 0 35.17767393835764 136.89998435774712 0 35.17768277361727 136.90014868696866 0 35.17771954811237 136.90018765277745 0 35.177986741323146 136.90018963538077 0 35.177985202398595 136.9001698954022 0 35.177967144361375 136.89991696759623 0 35.17770179661401 136.89994507113988 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1c862f44-91c6-4f5d-8c3b-7501800eea83">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17826269505009 136.90464319011153 0 35.177997766755965 136.90466516315618 0 35.177970331373594 136.9046926991967 0 35.17794149249223 136.90469608548185 0 35.17796893321854 136.9048798991 0 35.17799540347477 136.90490671329178 0 35.17827662909488 136.90488241434525 0 35.17826269505009 136.90464319011153 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_02489115-9b97-41da-acd1-b6aeeaa2ec8c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17816272359491 136.90986441345441 0 35.17817043771835 136.90986371424876 0 35.17819942112001 136.90989526195852 0 35.17846962537515 136.90986222171531 0 35.17845333935466 136.90966464868046 0 35.17845138232103 136.90962711061644 0 35.17818359161069 136.90964782114457 0 35.17815231963925 136.90969414213512 0 35.17816272359491 136.90986441345441 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_a58405a8-2743-4268-91a9-670b31790d82">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175330817878915 136.90134032214334 0 35.17514939163091 136.90135606238718 0 35.17511766993832 136.90140139818124 0 35.17513719446735 136.90163167043772 0 35.17517062669346 136.90166768227155 0 35.17535088471815 136.90165359333423 0 35.17537333178413 136.90161289872995 0 35.17535387812536 136.90137384250173 0 35.175330817878915 136.90134032214334 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_29a8f549-50fa-4eea-b0ee-0ed489b15580">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.182544457955416 136.9070829152602 0 35.182537384041474 136.90698523398953 0 35.18251272325129 136.906961266636 0 35.18205064688722 136.90700976110293 0 35.18206063008239 136.9071508870052 0 35.18251582179569 136.9071031159954 0 35.18252218387971 136.90708530846544 0 35.182544457955416 136.9070829152602 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f6f7f9f3-c613-404c-b261-f664186e6e8f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1753161337552 136.90374243157495 0 35.175288195061874 136.90378676626415 0 35.17529865759077 136.90399719702495 0 35.17533695450211 136.90403209637 0 35.175506854852884 136.90402199832752 0 35.17553370500088 136.903974483227 0 35.17552125664301 136.90375454286698 0 35.17548916575741 136.90372156355716 0 35.1753161337552 136.90374243157495 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_aba59d96-f08d-4a99-9168-fd9016b7de90">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17543030088617 136.9028092999121 0 35.17546039692964 136.90276232291257 0 35.17546912723362 136.90259058522471 0 35.17543875464107 136.90259337326478 0 35.17541022647928 136.90257386825516 0 35.17522777209764 136.90257292127228 0 35.17520477092062 136.90260768876388 0 35.175217693994405 136.90278802919988 0 35.17524850142566 136.90281932912413 0 35.17543030088617 136.9028092999121 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f1604485-8906-4a11-b28c-ce002404bb92">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175033720575236 136.9004289902439 0 35.17507012122026 136.9004295489626 0 35.17508754845684 136.90045029151045 0 35.1752642924124 136.90043697987696 0 35.175295221271504 136.90040020971014 0 35.17528007389193 136.90023480797322 0 35.17525529456203 136.90019854886785 0 35.17507040967996 136.90019915215626 0 35.17507255591927 136.900232301167 0 35.175040736054314 136.90027379509064 0 35.175033720575236 136.9004289902439 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b67b819f-1d9f-403a-ae4a-0ad5a17b4770">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1757044002066 136.90992669344985 0 35.17571628569595 136.91009046130029 0 35.175749352519595 136.9101253801165 0 35.17593735442681 136.9101067840464 0 35.17596557494012 136.91006673205737 0 35.175943940850416 136.9098968461611 0 35.1759158332694 136.9098625704948 0 35.175734776200656 136.90988290190816 0 35.1757044002066 136.90992669344985 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_06085d63-8127-4757-b947-936933315522">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17667930408223 136.90147109248923 0 35.17665998333817 136.90125168449947 0 35.17663141250182 136.90121280183453 0 35.17649001182657 136.90122918105467 0 35.17646827329735 136.90126405514943 0 35.17647979092711 136.90150149353133 0 35.176496936748364 136.90150989168785 0 35.176511664548684 136.90152554384363 0 35.176643094876695 136.90152544646318 0 35.17667930408223 136.90147109248923 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_7bca477b-8f8e-4c30-8c7a-8414fd12a695">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175408669883716 136.9051804739608 0 35.17558728821588 136.905158273609 0 35.17561369757417 136.9051151518002 0 35.17560371712107 136.9049600521154 0 35.175570647868014 136.90492469631005 0 35.17539463260167 136.90494172876228 0 35.17536010917543 136.90498432756945 0 35.175371267628265 136.90514227752428 0 35.175408669883716 136.9051804739608 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6e2888d3-df8e-4224-a330-98cc10461507">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17682190904302 136.90361922914337 0 35.1767895665169 136.9035866157778 0 35.17665397285685 136.9036205386563 0 35.17663464177254 136.90364354708737 0 35.17664467242426 136.90386254632713 0 35.17666565807094 136.90388167232422 0 35.17668188549923 136.90389646155504 0 35.17668343284159 136.90392119342886 0 35.1768110348573 136.90388374942435 0 35.1768216941756 136.90386701049852 0 35.176837447325205 136.90384227340363 0 35.17682190904302 136.90361922914337 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c7a41df2-d109-4b20-b126-ad73e96e888c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17655307944732 136.90006465184987 0 35.176418157203095 136.9000755223946 0 35.176407925756884 136.9000914709442 0 35.176391475837924 136.9001171100832 0 35.17638163836407 136.90028347167578 0 35.176406439234675 136.90028075800905 0 35.176418205330776 136.90029612864313 0 35.17643410289644 136.9003168984503 0 35.17657091649262 136.9003052536017 0 35.176599951076064 136.90026794002236 0 35.17658641377282 136.90009693111526 0 35.17655307944732 136.90006465184987 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_e0fd4685-0c2f-4bae-820f-06c50da4b483">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1822806083025 136.90856692005306 0 35.182284379832744 136.90856010066312 0 35.18229058500929 136.9085531637805 0 35.18229490769656 136.90855117375244 0 35.18230212013083 136.90855159014106 0 35.182308888397905 136.9085550822747 0 35.18238361951462 136.90849845672727 0 35.18236276818918 136.90845763094345 0 35.18235228009498 136.9084315091477 0 35.182344115044785 136.90841005191177 0 35.18233512071091 136.90838100807173 0 35.18232347631057 136.90833598934273 0 35.18231427061907 136.90828858578428 0 35.1821608202167 136.9083083388147 0 35.18216698730996 136.90837941540718 0 35.182182305776976 136.90854571047578 0 35.18219214010113 136.90854974189878 0 35.18219533545175 136.9085801949379 0 35.1822806083025 136.90856692005306 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_e331dc9c-9884-45d8-9315-21ea338ced3c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.178592921704734 136.91127353704624 0 35.178585731824434 136.91118464376945 0 35.17856324965879 136.91116747663654 0 35.17830027578106 136.91117168990186 0 35.17828936747672 136.9111990755379 0 35.178284030440956 136.91131854645027 0 35.17831193857219 136.911343931038 0 35.17857551037365 136.91129622530573 0 35.178592921704734 136.91127353704624 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_e59d7c97-e406-4c44-9c0c-ec0906b23a85">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180733583277096 136.90947202611844 0 35.1807000553942 136.90947476683328 0 35.180688988800846 136.90947581840246 0 35.1806531357036 136.90947922411468 0 35.18060094543112 136.90948418109366 0 35.18055311454133 136.90948872797549 0 35.180562287739356 136.90963187904327 0 35.18061593634129 136.90968034960247 0 35.18061737305542 136.90970256165556 0 35.180737653869365 136.90969101962605 0 35.18074830301223 136.9096542407527 0 35.18080363673446 136.90961363039068 0 35.180733583277096 136.90947202611844 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_083b3773-df8c-409e-9f3e-f43ae86ebc8f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176726917650726 136.90267577721954 0 35.176758742637645 136.90263625957866 0 35.176732602676175 136.90247176834262 0 35.17671073208669 136.90244625795472 0 35.17656949835364 136.90245659605816 0 35.17655027727 136.90248860717404 0 35.17656016673689 136.90265468874887 0 35.17659109659057 136.9026879638634 0 35.176726917650726 136.90267577721954 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_dc89af7d-ef20-4221-93d8-38c81255cf8b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17588175307238 136.90157479847625 0 35.17598487754909 136.9015744637038 0 35.17599278064685 136.9015609339558 0 35.17600690774839 136.90154925041767 0 35.175983780430435 136.9013204146989 0 35.175959572113754 136.90129776697202 0 35.17586354951432 136.90128918609025 0 35.17583613936202 136.90132748179337 0 35.175850447253886 136.90155563869084 0 35.17587198967266 136.90156209462327 0 35.17588175307238 136.90157479847625 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ab681d3e-761f-4d75-9b8a-0f1e7a2c3dab">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18311725333647 136.91069810823043 0 35.18284934557664 136.91074133048932 0 35.182829756647266 136.91077092771772 0 35.18285216193151 136.91085836698764 0 35.18313176351498 136.91083148388506 0 35.183143007139584 136.91081309684364 0 35.183137711935046 136.91071959872656 0 35.18311725333647 136.91069810823043 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9cccd304-8476-433a-b94d-1142378eb777">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175820524706985 136.9114283538854 0 35.17584078203653 136.9115447769015 0 35.17585886190617 136.9115689838334 0 35.17603054546648 136.91154923435656 0 35.17604429908867 136.91153096633676 0 35.176041353591415 136.91140793997948 0 35.17602945546135 136.91139768990067 0 35.17602344728091 136.9113865430965 0 35.176021291074264 136.9113544880286 0 35.17584039398009 136.9114033696353 0 35.175820524706985 136.9114283538854 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_809277d8-20b7-451d-a80d-63409067e62e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1761522356396 136.90391430498937 0 35.176153469246 136.903693514155 0 35.176125989257336 136.90365846999396 0 35.17603076400755 136.90368490657758 0 35.17601314182673 136.90370615268353 0 35.17602208706139 136.90392350691616 0 35.1760342040007 136.90393293946354 0 35.17604989849883 136.903945155743 0 35.1761385852225 136.90393806345907 0 35.1761522356396 136.90391430498937 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f0c182bc-9127-4057-b806-caab6ba91bb2">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18223414317179 136.9091406505588 0 35.182374856637864 136.90905500346778 0 35.18237471070377 136.90905415724507 0 35.18233880481179 136.90884595218478 0 35.182233438227705 136.90884632704086 0 35.182233617363416 136.9089210902884 0 35.18223414317179 136.9091406505588 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9f754f19-3753-4ca5-95e5-1f1848084fd0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175898374559864 136.9003578406006 0 35.175926625873 136.9003332654594 0 35.17591066468862 136.9001667672204 0 35.17588393358157 136.90014478682565 0 35.17579426348446 136.90015550945427 0 35.17577583932652 136.90018071128165 0 35.17577565823928 136.9003442975887 0 35.17578810024328 136.9003591817397 0 35.175804761287836 136.9003791156108 0 35.175898374559864 136.9003578406006 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_8f4ef8d8-7637-4a26-9965-562d67db4eb9">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177188606849505 136.90117706506578 0 35.17710650177307 136.90118457821166 0 35.17709122064716 136.90120439024557 0 35.177107639888625 136.9014234728969 0 35.1771649541957 136.9014171010514 0 35.177202076913645 136.9014131465614 0 35.17721994931103 136.90141125719006 0 35.17721488416031 136.9011977301306 0 35.177188606849505 136.90117706506578 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_7f8827e9-9b5a-4090-b86f-a9c2dea32810">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17592318209424 136.90254805569748 0 35.175945443540606 136.90271319135053 0 35.175965132038336 136.90272852346854 0 35.176059308844344 136.9027174597055 0 35.17607252122232 136.90269963110353 0 35.17606188153117 136.9025330050917 0 35.176049603542936 136.90252459101836 0 35.17604227340622 136.90251154978608 0 35.17595032435715 136.90251074933215 0 35.17592318209424 136.90254805569748 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_87059a6c-388a-4577-bb70-c809754625d6">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18289040411248 136.90029186979507 0 35.1828899259992 136.90028451849955 0 35.18288971246246 136.9002812352386 0 35.18286130759508 136.8999167776141 0 35.18279085033911 136.89992492459197 0 35.182819979101254 136.9002986649144 0 35.18289040411248 136.90029186979507 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_bcac0314-19b5-41f9-9938-e4f6eea2c7e8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17720430671951 136.90996611357772 0 35.177220677293555 136.90994926408428 0 35.17721166130367 136.90977845758616 0 35.17719798612719 136.90976430463007 0 35.17709391532039 136.90977026432347 0 35.17707918365779 136.90979479403026 0 35.177092773457815 136.9099544969967 0 35.177114634795984 136.90997638644885 0 35.17720430671951 136.90996611357772 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f295fc43-11cc-4147-bc4b-a01c6df2cb0e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176117785833476 136.90486508349517 0 35.17609551938646 136.90490643573952 0 35.17610634566485 136.90506537700392 0 35.17623843338933 136.9050520313884 0 35.17622782959751 136.90489635012312 0 35.176202981447496 136.9048693117317 0 35.176117785833476 136.90486508349517 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d595acbc-327d-411c-bf72-1eeffbf21a7b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.182062760390515 136.91212589197028 0 35.182057652049146 136.91207545784349 0 35.18203722339285 136.9120616661986 0 35.18203467724694 136.91202799594487 0 35.18203031745711 136.91197035157316 0 35.182026933457266 136.91192560951572 0 35.1819308600888 136.911936389694 0 35.18191458932579 136.9119579607431 0 35.18191874864425 136.91204973836508 0 35.1819405206044 136.91207217893077 0 35.18194532100092 136.91215150951965 0 35.18204118019632 136.91214290403218 0 35.18205430818988 136.91212716205507 0 35.182062760390515 136.91212589197028 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9c54798e-3dc2-478a-b796-a8042e6b8b3f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180784235730556 136.91108619472806 0 35.18081038763231 136.91104823328635 0 35.18086276422845 136.91104310194777 0 35.180857814828265 136.9109681533569 0 35.18084031919639 136.91095343950204 0 35.18082945915368 136.91094430665626 0 35.18070380615813 136.91094821367898 0 35.18068556121205 136.9109739630182 0 35.180698265466184 136.91105648961485 0 35.18072484581353 136.9110934075693 0 35.180784235730556 136.91108619472806 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_84ccb17c-b9d7-4800-ba74-8dc119550824">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17705763970572 136.9002385599906 0 35.17713289089733 136.90022975077122 0 35.177147175692824 136.9002078557691 0 35.177134186655195 136.90004024745437 0 35.17709082795769 136.90004473044067 0 35.177088133351724 136.90004500904394 0 35.177039646649895 136.9000499981548 0 35.17704380979741 136.90022136796287 0 35.17705763970572 136.9002385599906 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_32e5c07a-40bf-476f-928e-09be2bdaa1ee">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18318639160619 136.91155146941463 0 35.183179312221085 136.91148583169925 0 35.18290391958242 136.91151551951955 0 35.18290870698067 136.9115814046485 0 35.18318639160619 136.91155146941463 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_50c3a3fc-9d90-49ac-b590-71f8d80fa902">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17729957774465 136.91127620659412 0 35.17720482785195 136.91127877341603 0 35.17718801725148 136.9113007841935 0 35.177199066618186 136.91141087002936 0 35.17721207833082 136.91142554135368 0 35.17730647788521 136.91143424915342 0 35.17731976387719 136.9114079675331 0 35.17731338948683 136.91129193819134 0 35.17729957774465 136.91127620659412 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_8f2fa7a9-c8ea-4a53-af48-066a7eace46f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17953614091705 136.90974358606815 0 35.17952547727616 136.90959723753255 0 35.17942076706462 136.90960855562705 0 35.179431509606474 136.90975599265005 0 35.17945788025922 136.9097788566309 0 35.179522484706894 136.90976514869078 0 35.17953614091705 136.90974358606815 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f39ae3b0-6e95-4bae-a495-3d9ecc47ee14">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.182518986109 136.90876352143076 0 35.18250606530549 136.90873859037674 0 35.18248817577823 136.9087034996938 0 35.18241002169218 136.9087626101819 0 35.18240501408822 136.908781621057 0 35.182364428603684 136.90877197724004 0 35.182360889575016 136.90877277254387 0 35.18231653737122 136.90878273953177 0 35.182313881816846 136.90878333629723 0 35.18223216599231 136.90879618761926 0 35.182233344715854 136.90880730701505 0 35.182233438227705 136.90884632704086 0 35.18233880481179 136.90884595218478 0 35.18234535491992 136.90883165776856 0 35.18237082492469 136.90881247248376 0 35.182372415378424 136.90881211007098 0 35.182383529113025 136.90880957761107 0 35.182400837877786 136.90881007193224 0 35.18241483306289 136.9088207879355 0 35.182426131180804 136.90883491619957 0 35.182518986109 136.90876352143076 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_0b9e9982-0d42-42e4-82fc-d49e1bb1d341">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18292143865692 136.91175663278327 0 35.18319818649821 136.91172941873307 0 35.18319488112032 136.9116795501549 0 35.182917818129184 136.91170679547403 0 35.18292143865692 136.91175663278327 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d3980b43-973e-4fed-8570-4b90f4cad191">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18184018176251 136.91086991132158 0 35.18184539138275 136.91094683400965 0 35.181867161460076 136.91096828609085 0 35.18195478582246 136.91097020760336 0 35.18196449190938 136.9109562329315 0 35.18195784475738 136.91085808876417 0 35.18184018176251 136.91086991132158 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ab06de8e-3163-4d5b-8c82-559648d9172d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17642487346983 136.9100301559943 0 35.17645976866764 136.9100345477162 0 35.1764746876478 136.91001331135175 0 35.17647208919083 136.90985061068503 0 35.176438292705136 136.9098542302549 0 35.17643559553153 136.90985446329157 0 35.17640063367535 136.90985748400573 0 35.17641006708591 136.91001944311245 0 35.17642487346983 136.9100301559943 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6044be8f-fb7f-41cb-846b-fe66d6a65981">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180801091365716 136.9121987034365 0 35.180867699773536 136.91219476277163 0 35.18088747903858 136.91216977743588 0 35.180876019841364 136.91207281500874 0 35.1808559337818 136.9120436104381 0 35.18079098209255 136.91206836981502 0 35.180801091365716 136.9121987034365 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b5bbee42-55bf-48af-9a33-d607fa7d51ff">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.179103536834695 136.91113606376794 0 35.17897358605497 136.91114825238722 0 35.17898893849055 136.91122301758236 0 35.17901143291806 136.91124600383407 0 35.17908282032199 136.91124270629905 0 35.17910250253905 136.9112145375721 0 35.179103536834695 136.91113606376794 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ed4cfcc5-cc8e-47c1-8147-4bd5df7ea759">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17954676674932 136.9110591064003 0 35.179533322562 136.91109581973623 0 35.179533212185625 136.9111716878434 0 35.17956049605234 136.91120025875134 0 35.179619337020014 136.91118920501415 0 35.17963730139479 136.91115862598966 0 35.17962379949313 136.91108125449267 0 35.179612421082574 136.91107295453017 0 35.17954676674932 136.9110591064003 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_abda36fe-fd99-42d2-b1fb-ff719409f5ed">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17588196176116 136.9094030443523 0 35.175702418050065 136.90945976706158 0 35.17570540358589 136.90950729629682 0 35.17588785501009 136.90948308959614 0 35.175884926904814 136.90944393150474 0 35.175883311990674 136.90942165706048 0 35.17588196176116 136.9094030443523 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ad00b37c-1b18-4b53-a293-edee6da785b8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17764723856206 136.91139848987243 0 35.177701778116976 136.91139952707982 0 35.177716496450785 136.91136851980434 0 35.177709170291564 136.91125428539954 0 35.17765644456904 136.91125930129607 0 35.17762374761058 136.91126241190176 0 35.177631394442066 136.91138164796658 0 35.17764723856206 136.91139848987243 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_a3c66736-2122-44db-ab66-d8bb3c9f91bd">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18323861996948 136.91233955423925 0 35.182966517565845 136.9123692584444 0 35.18296951124133 136.9124099439574 0 35.183243302368744 136.91238005553805 0 35.18324030514936 136.91233937005728 0 35.18323861996948 136.91233955423925 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6e04e190-5eb5-4396-9441-0de4a1290d7f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176500851818254 136.91133432368184 0 35.176501293575754 136.91134190724904 0 35.17647836313041 136.91136865792862 0 35.17647885683641 136.91148830667916 0 35.17649700256769 136.91150140941286 0 35.176497645284286 136.9115101504451 0 35.176529044785674 136.9115067252339 0 35.17654449077883 136.91147879027415 0 35.17654865171847 136.91135723958203 0 35.176532371675975 136.91133159959423 0 35.176500851818254 136.91133432368184 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_bd09ce1e-fee0-4adb-bef7-b0dfca6a1031">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17968706909612 136.91219009809544 0 35.179626107321525 136.912196038664 0 35.17963509132575 136.91233281187726 0 35.17969835351731 136.9123266471351 0 35.17971488948303 136.91230255065017 0 35.17970785337522 136.9122144076718 0 35.17968706909612 136.91219009809544 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d2c55e30-38ca-445f-af32-446b10fcad67">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180652388556695 136.91020670504346 0 35.1806354020622 136.91023069384883 0 35.18063675704816 136.910274607848 0 35.18065546013626 136.9102937413964 0 35.18077915003028 136.91025802070246 0 35.18077442520088 136.91019345624795 0 35.180652388556695 136.91020670504346 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_fc650157-25ae-4f93-828f-c4383ceac9bf">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17999423854407 136.90969350548212 0 35.18001456491575 136.909714192725 0 35.18004920193922 136.90971032585173 0 35.18004833645325 136.9096988249593 0 35.18005803703956 136.90968232520015 0 35.18004772432572 136.90954078755902 0 35.17998361570014 136.9095477171364 0 35.17999423854407 136.90969350548212 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2e119ede-8832-416a-ab4a-ea309a900dd7">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18327293852041 136.91070091406797 0 35.18328711472481 136.91079738311967 0 35.1833718623902 136.91078814254692 0 35.18336570430663 136.910704356387 0 35.18334142742807 136.9106765797213 0 35.18328513889367 136.91067287701895 0 35.18327293852041 136.91070091406797 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6840e48b-4924-461e-bef7-24d6f6b37546">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17516329249532 136.90841305377072 0 35.1751787649095 136.90865249623704 0 35.17522058416575 136.90864885088052 0 35.175205088402684 136.9084090476791 0 35.17516329249532 136.90841305377072 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_e2ae9964-bc00-473e-9b2a-283853a3832e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18025244640032 136.9122719998277 0 35.18029976151038 136.9122669116199 0 35.18031445191834 136.91222250858186 0 35.180308798801306 136.91214734872514 0 35.18022208938606 136.9121570246123 0 35.18022858825084 136.91224341764516 0 35.18023960005165 136.91225660924962 0 35.18025244640032 136.9122719998277 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6bc46ee4-4ffe-4339-88de-67c5ac609fcc">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17640041091176 136.90852962400297 0 35.17638226906883 136.90829030926534 0 35.1763491028056 136.90829403885576 0 35.17636715299069 136.9085321445147 0 35.17636728363107 136.90853371407835 0 35.17640041091176 136.90852962400297 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5f625265-3aa8-4b0d-aaee-73705f9b4212">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17948677348604 136.91056730688462 0 35.17949705816329 136.9106198023219 0 35.17951522370346 136.91063583897937 0 35.17958192598434 136.91062904150343 0 35.17957624789077 136.91054638757058 0 35.17951180327898 136.91055295514022 0 35.17948677348604 136.91056730688462 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6bb91b7e-0fa0-44b0-8262-172b0a461780">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17778901658762 136.90972668594048 0 35.17779936178487 136.90989716046363 0 35.17781745101035 136.90989553208013 0 35.177838202384784 136.9098936639616 0 35.17782786158027 136.90972326995183 0 35.17778901658762 136.90972668594048 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d8fca8d9-bb14-44db-85d3-948e0752aee8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180327781892885 136.90965534491298 0 35.1803565316968 136.90965239973607 0 35.18034604987273 136.90950854104784 0 35.18031731219829 136.9095116473622 0 35.180327781892885 136.90965534491298 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d44d41ca-f14d-46a9-ae95-d84eaf2fb1de">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180396187374356 136.91029608668123 0 35.18039359374492 136.91025299626355 0 35.18036664492806 136.9102554766302 0 35.18036923387032 136.91029849309757 0 35.180396187374356 136.91029608668123 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">9</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_611767e2-85a6-4ebd-8d86-abf426313bdf">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18241563979664 136.90567011800312 0 35.181965498823565 136.90580618184939 0 35.18199512722551 136.90622495896926 0 35.18205064688722 136.90700976110293 0 35.18251272325129 136.906961266636 0 35.182466195517584 136.90636718739785 0 35.182456380911454 136.9062406873913 0 35.18245080510924 136.90616883136428 0 35.18243584490641 136.90597784697152 0 35.18241563979664 136.90567011800312 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">52.576</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_19663e9e-3cdc-4a54-9763-02e48a49d321">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18163060157279 136.90509049734789 0 35.181568916936634 136.90510438006265 0 35.18130950771164 136.90513237040597 0 35.180899352528606 136.9051748577608 0 35.180718653703046 136.90519366259144 0 35.18075473795424 136.9057377006119 0 35.18081131144627 136.9057321341253 0 35.18084817266298 136.9057285028491 0 35.18087259664653 136.905726119075 0 35.18116505343129 136.90569751568785 0 35.181230484291014 136.90569104814648 0 35.18135646887213 136.90567879838147 0 35.18136683958571 136.9056777792561 0 35.18141641293819 136.90567288635262 0 35.18146685334252 136.905667930283 0 35.18154231792663 136.9056605160078 0 35.181608469929785 136.90565404609941 0 35.18178439003269 136.90563681317437 0 35.181801968974746 136.90563509134677 0 35.18163060157279 136.90509049734789 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">51.346</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_386b2e0f-030a-4d82-86c0-4595ae70a442">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.181274122572425 136.90063972189057 0 35.18131752491759 136.90119339414164 0 35.18132492226237 136.90128640618317 0 35.18135461602553 136.90166528901835 0 35.181802800140574 136.9016171083248 0 35.18173931863141 136.90074108925165 0 35.181717091356155 136.90043438536654 0 35.181274122572425 136.90063972189057 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">48.013</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_16702e7f-f892-4f8a-9923-2bc426c8844b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17566689734519 136.90591633088462 0 35.17570517912187 136.90636359879778 0 35.175803323553794 136.90635296577182 0 35.17582429073569 136.90635067680088 0 35.175840102866545 136.90634895101226 0 35.17598600615281 136.9063330242603 0 35.17607879798427 136.90632289568924 0 35.17636703745438 136.90629143208423 0 35.17644567721911 136.90628284827403 0 35.176517730901814 136.9062750430002 0 35.176610502977745 136.90626495607663 0 35.176804863892954 136.90624382521287 0 35.176772798739194 136.90579521399187 0 35.17653439403778 136.9058212723597 0 35.176480182226626 136.9058271974315 0 35.176420405307134 136.90583373094125 0 35.17636513454818 136.90583977246206 0 35.176306413875686 136.90584619278934 0 35.17616906351773 136.90586125985743 0 35.17612421284112 136.90586618114412 0 35.1760577317138 136.90587347708512 0 35.175985074443886 136.90588144927827 0 35.175949539793315 136.90588534829598 0 35.17588793342324 136.90589210933467 0 35.175835552955895 136.90589785719055 0 35.175788928653866 136.90590297403475 0 35.17566689734519 136.90591633088462 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">45.196</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4c91aa43-cd03-49c5-bbc4-8417dba6699d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18139936867184 136.90230284263447 0 35.181430019821626 136.90279200837674 0 35.18145269569362 136.90315392387078 0 35.18146530301869 136.9033552503837 0 35.18192505133427 136.90330598939548 0 35.18191396100195 136.90315243506626 0 35.18188802901335 136.90279337180291 0 35.181848986086955 136.90225451143704 0 35.18139936867184 136.90230284263447 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">48.013</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_87b00af5-9f38-4228-a54c-254bea626a78">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.181726022517424 136.90490419536138 0 35.182184321399596 136.90486484573447 0 35.18212431286808 136.90462749101192 0 35.18211455871049 136.90458849366152 0 35.18204903918359 136.90429290507748 0 35.18202405621307 136.9041720818652 0 35.18200740690162 136.9040915605283 0 35.181999348690844 136.9040453123091 0 35.18197792333218 136.90392234772762 0 35.181976843796264 136.90391369433078 0 35.181534391768395 136.90399558223925 0 35.18156763961494 136.9041959698467 0 35.18158946825309 136.90432754066484 0 35.18160555728598 136.9044037484194 0 35.18160950553725 136.90442245062277 0 35.18163147812997 136.90452609974105 0 35.18164074400297 136.90456980761317 0 35.181653403925665 136.90462982592345 0 35.18169486574005 136.90480401981176 0 35.18171041433229 136.90485637388397 0 35.181726022517424 136.90490419536138 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">48.013</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_005afacc-0cec-4e78-bb17-1231b6c86f4d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177923541745784 136.90611147141723 0 35.17791788986292 136.90566353822126 0 35.17782432070097 136.90567433121458 0 35.17777802142502 136.90567967125475 0 35.17763756538599 136.90569587198436 0 35.1775748368682 136.9057031079059 0 35.17737094303826 136.9057266257534 0 35.17729155455892 136.90573578241066 0 35.17725251911001 136.90574028451837 0 35.177139596227704 136.90575330973823 0 35.177108615865826 136.90575687482672 0 35.177045044659614 136.9057641901979 0 35.17698062089779 136.90577160379928 0 35.17700501306138 136.90621519025106 0 35.17703390093662 136.9062119284506 0 35.177091846116596 136.90620538563766 0 35.17719167303422 136.90619411336925 0 35.17724968580295 136.90618756262933 0 35.17731509762836 136.90618017582196 0 35.177423746634574 136.90616790808443 0 35.17749422153974 136.9061599495473 0 35.17758670706678 136.90614950645693 0 35.17762628527065 136.906145037927 0 35.177709112364205 136.90613568510852 0 35.177770403780514 136.90612876370488 0 35.17781676640246 136.90612352802 0 35.17783229361112 136.9061217756039 0 35.17788259909199 136.9061160947494 0 35.177923541745784 136.90611147141723 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">45.196</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_0860e02c-1389-4b58-98dc-2832c9a1e3bd">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18279085033911 136.89992492459197 0 35.18272763655001 136.89993223399478 0 35.18264734833014 136.89994151734376 0 35.18242690696385 136.89996700578192 0 35.18196993572446 136.9000198442411 0 35.18178789046165 136.90004086108138 0 35.18171723087161 136.90004702088146 0 35.18173144700712 136.9004037051679 0 35.18254525410453 136.90032517498696 0 35.182817283212195 136.9002989250599 0 35.182819979101254 136.9002986649144 0 35.18279085033911 136.89992492459197 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">27.516</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_25d0f679-6b44-4040-8b05-1147bf369b5f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18311725333647 136.91069810823043 0 35.18311486770604 136.91066507170993 0 35.183110250550804 136.91060112389937 0 35.18310081091555 136.91047038954378 0 35.18309649917892 136.91041067025222 0 35.18309359986876 136.91037049623418 0 35.18309148163796 136.91034117997955 0 35.18308320530921 136.91022654074928 0 35.18307886379495 136.91016643837924 0 35.18307521960851 136.91011595440528 0 35.183073846106964 136.91009694484353 0 35.18307086406189 136.91005563688537 0 35.18306787830858 136.91001428721844 0 35.183057009720635 136.90986379040072 0 35.18305344525092 136.9098143998003 0 35.18305066467618 136.90977589878656 0 35.18303532390041 136.9095634730866 0 35.18301713975617 136.9093116628032 0 35.182660418042104 136.90934397004753 0 35.1827100146727 136.90947941477432 0 35.182722183766415 136.9095165915214 0 35.182736690129104 136.9095609109943 0 35.1827424776585 136.9095920371029 0 35.18274712444454 136.90961702358305 0 35.18275000316272 136.90963250818226 0 35.182753336880225 136.90965043436637 0 35.18277188751041 136.90975020257207 0 35.18277556638558 136.9097846677276 0 35.182781553785446 136.90984163432006 0 35.182784826251385 136.90987277716093 0 35.18279088366521 136.9099300476882 0 35.182810946791236 136.91018817590978 0 35.18283474874744 136.91053078254393 0 35.18284934557664 136.91074133048932 0 35.18311725333647 136.91069810823043 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">31.565</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4d96ce3f-0ed2-40dc-a15e-2dc0e2bc6b1c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180222683345335 136.9057898772206 0 35.18018654701514 136.90524257852212 0 35.17955340996802 136.9053014790989 0 35.1796039667718 136.9058530552387 0 35.179627699051885 136.90584982834588 0 35.1796659113721 136.90584569878845 0 35.17970403390281 136.90584173420552 0 35.179791038626576 136.90583256401396 0 35.179852287738576 136.90582610895825 0 35.17996981130071 136.90581464423767 0 35.180215004528876 136.9057906293411 0 35.180222683345335 136.9057898772206 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">51.346</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d021df8a-7523-4285-8f32-60c0309a4069">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">1</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17856324965879 136.91116747663654 0 35.1785570152427 136.9110802975709 0 35.17854769968512 136.91095001581596 0 35.17854246363968 136.91087679381366 0 35.17853933980576 136.91083310056825 0 35.17853491278242 136.9107712077617 0 35.17853134954094 136.91072136860254 0 35.17852684347142 136.91065835616962 0 35.178513538713496 136.91047230460717 0 35.178491087325675 136.91015838095544 0 35.17848071454182 136.91001333012414 0 35.178471751824404 136.9098880189213 0 35.17846962537515 136.90986222171531 0 35.17819942112001 136.90989526195852 0 35.178229501521514 136.9102429710231 0 35.17823599190097 136.91032813966874 0 35.17824078546326 136.9103910389679 0 35.178244991143096 136.91044621622243 0 35.178252918486535 136.91055023943937 0 35.178259146267635 136.91063196696493 0 35.178275361195496 136.91084474222308 0 35.17827669717265 136.91086225981695 0 35.17828883549322 136.91102170085932 0 35.17830027578106 136.91117168990186 0 35.17856324965879 136.91116747663654 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_35fd999f-ba23-4430-88a2-e0e5bab97a4a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">1</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.178665317692236 136.91259336820428 0 35.178653622152055 136.9124244343033 0 35.17864041102209 136.91223360038055 0 35.178638345331876 136.91220376179825 0 35.178610739539806 136.91180503164335 0 35.17861069768372 136.91180441803158 0 35.178606815235234 136.9117483347554 0 35.178602605537314 136.91168754129296 0 35.17858626936379 136.91145160128673 0 35.17857551037365 136.91129622530573 0 35.17831193857219 136.911343931038 0 35.1783192089739 136.9114526984223 0 35.178326575115975 136.91156288514466 0 35.17833457881123 136.91168265039371 0 35.1783373794119 136.9117245307994 0 35.17833959558639 136.91175771307059 0 35.17834639648514 136.91185944319372 0 35.178350240401166 136.91191694603464 0 35.17835950021851 136.91205551271023 0 35.17836220223275 136.91209601116063 0 35.17836987458089 136.91221106085857 0 35.17837556712134 136.91229642992357 0 35.178392637353085 136.91255348362662 0 35.178665317692236 136.91259336820428 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c5cad1c7-b8eb-41f2-8585-bc2ab7794332">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.174733600959215 136.90602756157875 0 35.17476249933312 136.90647112155062 0 35.17495247581984 136.9064487782254 0 35.175025983520044 136.90644011446452 0 35.175096583896035 136.90643179370858 0 35.17536031398949 136.90640071092184 0 35.17537469559661 136.90639901606184 0 35.17545751747603 136.90638931027075 0 35.17541764648094 136.90595248088835 0 35.17537210003562 136.905957474563 0 35.1753624451406 136.90595853300738 0 35.17513117107019 136.9059838924618 0 35.17503414806933 136.9059945310418 0 35.174951518637336 136.90600359101248 0 35.174733600959215 136.90602756157875 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">45.196</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_dede9e47-4e75-4a06-8b91-83a3c536f23e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">1</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177763771160386 136.90140246391604 0 35.177807573273874 136.90222825794226 0 35.17781209726036 136.90231357897972 0 35.17812571305772 136.90228651585284 0 35.178115159111584 136.9021050905174 0 35.178103950919315 136.90191217471425 0 35.178099943649435 136.90184314927347 0 35.17809830351222 136.90181492592066 0 35.178087338969334 136.9016260475643 0 35.17808640447524 136.901610119752 0 35.178083188086646 136.90155531974176 0 35.1780749900197 136.9014155820291 0 35.17806748670974 136.90128773257746 0 35.177763771160386 136.90140246391604 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ce383301-07fd-47b8-ad3b-e9f5d8547f4f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17930124200345 136.90357852326454 0 35.17927202899122 136.90316096184753 0 35.17922801882703 136.90253110750876 0 35.17895560438904 136.90256075831707 0 35.178999704761274 136.90316184070508 0 35.17902362680377 136.9034879323877 0 35.17903241835821 136.90360777699522 0 35.17930124200345 136.90357852326454 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.687</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_77b37e76-ea0a-4d5b-84db-133be07c81c4">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18019879474936 136.90348878327595 0 35.18046826531018 136.90346068541135 0 35.18044696232042 136.90315716991182 0 35.18042929770704 136.9029058120711 0 35.180394494452194 136.90241062148567 0 35.18012475563177 136.90243960201576 0 35.180175449436994 136.90315804620187 0 35.18019879474936 136.90348878327595 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.494</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_dc1d7555-b192-4223-9559-0c8ac86f2ec3">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180080274170706 136.9018020573913 0 35.180349652016346 136.9017729661481 0 35.180277542640404 136.90074727442672 0 35.18000807273988 136.9007753811729 0 35.180080274170706 136.9018020573913 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.494</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c024336d-4d5a-45a2-88c1-c8ea66c619b8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1803610156323 136.90021372708995 0 35.18039444136771 136.9005836972772 0 35.18066437098734 136.90055068807897 0 35.180740883203114 136.90054143544265 0 35.18112848988943 136.90049405758177 0 35.181110179872746 136.90012026106277 0 35.18093354729318 136.90014312630782 0 35.18090290689496 136.90014706918998 0 35.18082506337954 136.90015718626245 0 35.18077899386849 136.90016317448712 0 35.18064138261927 136.9001809713787 0 35.18045014528542 136.90020322524674 0 35.1803610156323 136.90021372708995 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">23.613</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_69b8e678-36e1-4c3f-9add-927d78e4af84">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17580773996381 136.90761409948016 0 35.176874558303226 136.9075106958922 0 35.176878978978046 136.90725970060575 0 35.17577179218418 136.9073705915326 0 35.17580773996381 136.90761409948016 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">22.068</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6cb8ed03-d845-418b-abb2-6871a06ee63d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180733583277096 136.90947202611844 0 35.18080363673446 136.90961363039068 0 35.18108635850917 136.90940613503443 0 35.181220819171294 136.90938979086746 0 35.18129102319455 136.90938111530798 0 35.18155246419872 136.9093492189044 0 35.18162149704602 136.90934087635512 0 35.181707832825104 136.90933028331162 0 35.18190033156671 136.90930694850562 0 35.18191762250469 136.90931220489747 0 35.181967171702695 136.90932726992312 0 35.18202210679639 136.9093447741612 0 35.18208498036726 136.9093649983429 0 35.182591830922476 136.90930795280246 0 35.1826143489528 136.90930539598384 0 35.18220798464357 136.90917520956532 0 35.18211255160447 136.90918923525825 0 35.1819928967049 136.90917439139955 0 35.181908215869605 136.90915694047968 0 35.18189386572052 136.90915860305665 0 35.18173288954938 136.90917725696076 0 35.18165752580535 136.90918598964237 0 35.18161887061253 136.90919046829444 0 35.18151889721145 136.90920205312514 0 35.18148186421709 136.90920634438345 0 35.181368864555054 136.90921943823108 0 35.18133267600297 136.90922363128738 0 35.181208593113325 136.90923800951526 0 35.18117476125393 136.90924192941677 0 35.18109873870564 136.90925073871426 0 35.1810263833638 136.90926512615545 0 35.180849224140715 136.90939693033653 0 35.18081303844646 136.90942029912603 0 35.180761128797464 136.9094538230386 0 35.180733583277096 136.90947202611844 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_91b73ba1-89b2-46bc-a87b-92d499099ff0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17907940147195 136.90424826867815 0 35.17914925141426 136.90520057635825 0 35.179414577978655 136.9051717078514 0 35.1793949696143 136.90488576838462 0 35.17934923588842 136.9042189061582 0 35.17907940147195 136.90424826867815 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.687</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4921db99-2b2c-42f9-bdb1-3757ace1660f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1778554584895 136.90256233677755 0 35.1778973377755 136.9031653981948 0 35.17791874212104 136.9034745032866 0 35.178193440859104 136.90345079465587 0 35.178176783411544 136.90316449640372 0 35.17814032782167 136.9025377555901 0 35.1778554584895 136.90256233677755 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_425f674f-4e67-4433-9b2e-fe96b2b0766f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18051526262507 136.90409723006098 0 35.18024381248543 136.9041283043609 0 35.18030966346306 136.90506596304866 0 35.180579115786095 136.9050378632884 0 35.18051988972291 136.90419538000933 0 35.18051526262507 136.90409723006098 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.494</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d05bfa40-7b11-4a0c-8566-a9ce6bace338">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18060622294345 136.90360209655486 0 35.18063001610133 136.90393206549373 0 35.180756100013646 136.90391914303726 0 35.180815762293356 136.90391302205776 0 35.18111939096595 136.90388185092615 0 35.18137513649956 136.9038555870876 0 35.1813518056249 136.90351855455202 0 35.18060622294345 136.90360209655486 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">22.062</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1d15597d-4211-4365-b3bf-440131d49699">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18126149968708 136.90216143203924 0 35.18123842668968 136.901833215488 0 35.18073250312083 136.90188797025579 0 35.180487521705544 136.90191448430974 0 35.180510594472366 136.9022426978681 0 35.180585644352206 136.9022345330577 0 35.18087153683941 136.902203429699 0 35.18091605752065 136.90219856426043 0 35.181207925962454 136.90216719094641 0 35.18126149968708 136.90216143203924 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">21.686</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ddeb5507-00b5-421b-aab4-818f7248de4f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175749352519595 136.9101253801165 0 35.17576847513413 136.91039379828527 0 35.175778412000675 136.9105332794102 0 35.175815874488585 136.9110591562657 0 35.17582415428302 136.91117539049097 0 35.17583353662046 136.91130710705627 0 35.17584039398009 136.9114033696353 0 35.176021291074264 136.9113544880286 0 35.17601593819887 136.91127490523425 0 35.17600920425549 136.91117480603114 0 35.176004521349114 136.91110519882557 0 35.17599769324033 136.91100368805397 0 35.175980942327065 136.91075468439064 0 35.17597614283846 136.9106833451232 0 35.17596726221437 136.91055133808223 0 35.175954886603314 136.9103673765462 0 35.17593735442681 136.9101067840464 0 35.175749352519595 136.9101253801165 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.593</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2a28fd5d-4888-478c-8058-c92acb4e5f82">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">1</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17778188228087 136.90109936661503 0 35.178053655181465 136.90098189663783 0 35.1780517662202 136.90095952988295 0 35.17801309874955 136.90050168824612 0 35.177986741323146 136.90018963538077 0 35.17771954811237 136.90018765277745 0 35.17774498497481 136.90054064346504 0 35.177776362565666 136.90101578096213 0 35.17778188228087 136.90109936661503 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6d006076-4c1d-4a32-bc33-5597a12f56d3">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17794868222969 136.90381179760715 0 35.177997766755965 136.90466516315618 0 35.17826269505009 136.90464319011153 0 35.17822903665967 136.90406363716198 0 35.17821864091571 136.90388394049066 0 35.17821311611127 136.90378897625914 0 35.17794868222969 136.90381179760715 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ffec4b8d-cf24-41e5-bc02-3e71bb6e674c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17919291182545 136.90036261581673 0 35.179220244638664 136.90070855712358 0 35.179856692222145 136.90063939951506 0 35.17983689756135 136.9002871333552 0 35.179687799372275 136.90030460936632 0 35.17968468839133 136.90030497415094 0 35.17919291182545 136.90036261581673 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.687</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c2e082a2-f2c6-4c7b-b662-810994c5ba3c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17788234280887 136.90373230223284 0 35.177870490115566 136.90352868364906 0 35.17717529627064 136.903588713977 0 35.177013781483026 136.90360266065014 0 35.17682190904302 136.90361922914337 0 35.176837447325205 136.90384227340363 0 35.177232730241826 136.90380059801745 0 35.1772800454756 136.90379572468305 0 35.177298962444965 136.90379372487308 0 35.17780925194843 136.90373978385253 0 35.177849988348726 136.90373570017363 0 35.17788234280887 136.90373230223284 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">18.679</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3ca1f440-d72b-4b96-85ad-ffff24f092da">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17585886190617 136.9115689838334 0 35.175867862425505 136.91169766492337 0 35.17587162282451 136.91175142794904 0 35.17588102277467 136.91188581577651 0 35.175882300695704 136.91190408950354 0 35.17588802943226 136.9119859930808 0 35.17589700162135 136.91211427252364 0 35.175903743228076 136.9122106651593 0 35.17590747226044 136.91226719941224 0 35.17591258599756 136.9123370962037 0 35.175919573686635 136.912437003564 0 35.17592298154269 136.91248573062285 0 35.17593906987899 136.91271578470253 0 35.17594594294156 136.91281405223228 0 35.17612494976456 136.9128044930136 0 35.17612179558951 136.91276190446473 0 35.17611639957684 136.912690112279 0 35.17611521169839 136.91267431286366 0 35.176110710831175 136.91261458487497 0 35.17610812936922 136.91258033417358 0 35.17610271696551 136.91250851461587 0 35.17609944186495 136.91246505363995 0 35.17609253462022 136.91237339649007 0 35.176083683723355 136.91225595365654 0 35.17608135344928 136.9122250343073 0 35.176073279494986 136.91211790600434 0 35.17605997815041 136.9119414103617 0 35.176053982061035 136.91186184267175 0 35.176049821145575 136.91180664033288 0 35.17604441848818 136.9117349580856 0 35.17604139905294 136.91169489106446 0 35.17603054546648 136.91154923435656 0 35.17585886190617 136.9115689838334 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.593</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b57042b4-fddb-4307-bd3b-67482288ce1a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18008269298503 136.90365670448864 0 35.17944407156977 136.90372189320175 0 35.17946947865712 136.9040581198204 0 35.180105855219 136.9039867831538 0 35.18008269298503 136.90365670448864 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">21.239</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_0e70476a-2809-4d3c-b24e-82983bd0da66">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17935689210562 136.90236647780995 0 35.17998688678639 136.90229819338208 0 35.179960583311946 136.90197035251225 0 35.17968632260896 136.9019987692769 0 35.17933291511851 136.90203831855212 0 35.17935689210562 136.90236647780995 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">21.003</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_70c493f7-86c5-4fd9-96df-f0c24f7af41d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17792811041312 136.90740041473896 0 35.17791336166428 136.9071620997122 0 35.17708085711708 136.90723852839045 0 35.17712661627961 136.90747520200046 0 35.17792811041312 136.90740041473896 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">22.068</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_0803491f-5cf1-4d11-a404-46534f5dc232">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.178328414761346 136.90625790200943 0 35.17806330865979 136.9062572685869 0 35.17806319132369 136.90628193926057 0 35.17806303935358 136.9063135653782 0 35.1780626564975 136.9063933811108 0 35.17806222769703 136.9064833066517 0 35.17806184933305 136.90656190806743 0 35.178061818233154 136.90656850932186 0 35.17806174282738 136.90658451461323 0 35.17806158746379 136.90661669628918 0 35.17805976028922 136.90699782803156 0 35.1783268203015 136.90699733929853 0 35.178326452845695 136.90669963309938 0 35.17832623990312 136.9065273815082 0 35.178328414761346 136.90625790200943 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f1d8dddf-f74c-4cf9-b77e-6133994de315">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177119414428894 136.9084504974328 0 35.17715843803664 136.90844631176566 0 35.1771909726944 136.9084428053607 0 35.17724639919677 136.90843703073858 0 35.17729166774843 136.90843230050703 0 35.17738025001494 136.90842302626785 0 35.177532216686615 136.9084071133692 0 35.17785213986548 136.908373615183 0 35.1779396568462 136.9083644506807 0 35.17796550088433 136.90836174489633 0 35.177972792754986 136.9081458706604 0 35.17716935919994 136.90819913775837 0 35.177119414428894 136.9084504974328 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.744</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4defac1a-0c49-4da6-a3a5-9bc7e42475a7">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17913205261894 136.9011990467923 0 35.17885764715008 136.90122598590924 0 35.17890842825159 136.90191785271577 0 35.17917766748927 136.9018885383586 0 35.17915753028431 136.90158403615038 0 35.17913205261894 136.9011990467923 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">29.687</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_fd397a16-3749-4e60-a3ea-cf1c1d4519eb">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176908605150096 136.90481522830984 0 35.17692078269219 136.90498580389064 0 35.17703815123082 136.90497394474784 0 35.17719061704031 136.9049585399203 0 35.17720758211863 136.904956825507 0 35.17727312713086 136.90495020363295 0 35.17745685809872 136.90493163971198 0 35.17757179776112 136.9049200264418 0 35.17796893321854 136.9048798991 0 35.17794149249223 136.90469608548185 0 35.177850486519226 136.904706597982 0 35.17778870436912 136.90471373612837 0 35.177775307750814 136.904715283253 0 35.17772952563807 136.90472048054303 0 35.176908605150096 136.90481522830984 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">15.39</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_323065a6-00e0-4e84-b2a4-6c3b443d56d8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.183179312221085 136.91148583169925 0 35.18317905816465 136.91148255461707 0 35.18317238936757 136.9113965340065 0 35.18317166381864 136.91138717810222 0 35.183164900282605 136.91129993975807 0 35.18315521955692 136.91117506596035 0 35.18315345264898 136.91115238042354 0 35.18313176351498 136.91083148388506 0 35.18285216193151 136.91085836698764 0 35.18287759663831 136.91115326686185 0 35.18290391958242 136.91151551951955 0 35.183179312221085 136.91148583169925 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">31.565</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6221f65c-776c-48ec-87ff-0e1a224e1a51">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17483659269326 136.9077011266806 0 35.17486536983704 136.9076983319334 0 35.17495869523301 136.90768936272974 0 35.17553581643949 136.9076338457713 0 35.175527355987 136.90738717726686 0 35.175468655676454 136.90739304630597 0 35.1754465470754 136.90739525628123 0 35.17538987187472 136.90740092235737 0 35.175340075915585 136.90740589577734 0 35.17527077237114 136.90741282167915 0 35.17521455682387 136.90741845004072 0 35.175106335438116 136.9074292695937 0 35.17504564876238 136.90743533700513 0 35.174986929516656 136.9074412071308 0 35.17495461063521 136.9074444386795 0 35.174933519555374 136.9074465520764 0 35.17488096939867 136.90745181633622 0 35.174820401139 136.90745382557984 0 35.17483659269326 136.9077011266806 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">19.132</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4943ab57-a6bf-4206-98ae-55bcbb3dff37">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175677660935996 136.9063943176345 0 35.175497171520504 136.9064268414115 0 35.17550683275174 136.9065600941391 0 35.17551431371465 136.90666584736908 0 35.17552108248722 136.90676153745292 0 35.175529547768654 136.90688121539088 0 35.17553568515383 136.9069679794962 0 35.175543470691075 136.90707805202229 0 35.1755478575077 136.9071400742304 0 35.175552364202076 136.90720378790968 0 35.17555815275913 136.90728562255714 0 35.1755627960368 136.90735127359144 0 35.175742780808044 136.9073355511569 0 35.17573622813675 136.90724079767622 0 35.17573152288091 136.90717275330505 0 35.17571508028069 136.90693499706978 0 35.1757067159895 136.9068140471763 0 35.17568445158328 136.9064921179607 0 35.175677660935996 136.9063943176345 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.593</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_61f4322a-08b0-4377-b320-87b67c70c01a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18323861996948 136.91233955423925 0 35.18323675895895 136.91231144596708 0 35.18323066676407 136.9122194884117 0 35.183229136259925 136.91219638815113 0 35.183223892135764 136.91211725031013 0 35.18321679532255 136.9120101612081 0 35.18321346339631 136.91195991215793 0 35.18320860177135 136.91188655517476 0 35.183203595802425 136.91181102353102 0 35.18319859725906 136.91173561594644 0 35.18319818649821 136.91172941873307 0 35.18292143865692 136.91175663278327 0 35.18292168008937 136.9117599137631 0 35.18295322692815 136.91218863445994 0 35.182966517565845 136.9123692584444 0 35.18323861996948 136.91233955423925 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">31.565</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f2c80b02-4af8-48cb-9c48-38f1e3f46bbe">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176758742637645 136.90263625957866 0 35.176987157560234 136.9026101264287 0 35.177102137809634 136.9025969705634 0 35.17740951302348 136.90256180289816 0 35.17757542746224 136.90254282129345 0 35.17777181147277 136.90252046987118 0 35.177759648633725 136.90236194735652 0 35.177293891104945 136.9024117630293 0 35.17727800868219 136.90241347007787 0 35.17724096349684 136.9024174436286 0 35.1772406282387 136.90241747984663 0 35.17721343808163 136.90242041691423 0 35.17715230759186 136.9024270429966 0 35.1771140051153 136.90243111941498 0 35.176907910815665 136.90245308460052 0 35.176732602676175 136.90247176834262 0 35.176758742637645 136.90263625957866 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.496</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_89de07f7-ed57-41c8-beeb-38e7e6dd50b8">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17541022647928 136.90257386825516 0 35.17540108448513 136.90243270971374 0 35.17539632714996 136.902359386344 0 35.175387646762346 136.9022245666456 0 35.17537881317567 136.90208736066987 0 35.17536604821754 136.90188910528622 0 35.17535088471815 136.90165359333423 0 35.17517062669346 136.90166768227155 0 35.17519032769369 136.90197975852269 0 35.17519360986295 136.9020317480119 0 35.175204903556 136.90221065428113 0 35.17520837516033 136.90226564039688 0 35.17521012872264 136.9022934276317 0 35.17521758445903 136.90241152914723 0 35.17522777209764 136.90257292127228 0 35.17541022647928 136.90257386825516 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.08</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_7e890119-1f32-4036-8fbc-18ceafae73d7">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17814384636327 136.90909940476826 0 35.17839716559694 136.90907178800785 0 35.17834436067843 136.90835330008503 0 35.17810177254641 136.90851837158587 0 35.17810391786401 136.90854792526244 0 35.17812974523355 136.90890439837932 0 35.17813140853765 136.90892733971188 0 35.178140407800036 136.90905156542098 0 35.17814384636327 136.90909940476826 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_93d9a37a-f78c-4d50-aa3c-f1421bd91b3a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17543030088617 136.9028092999121 0 35.17524850142566 136.90281932912413 0 35.17525553373259 136.90292080576 0 35.17527061622141 136.9031384443903 0 35.17527307128894 136.90317386628354 0 35.17527710387956 136.90323208724016 0 35.17528186235095 136.90330078626374 0 35.17528540444875 136.9033519362445 0 35.17528916054629 136.90340616400735 0 35.17529522648916 136.9034937523294 0 35.17529905046027 136.90354896139547 0 35.1753161337552 136.90374243157495 0 35.17548916575741 136.90372156355716 0 35.17547227890002 136.9034587838481 0 35.175464924829775 136.90334509833545 0 35.17546031681715 136.903273862552 0 35.17546012560052 136.90327090985394 0 35.17545692329332 136.9032214087946 0 35.17545380959491 136.9031732831051 0 35.17545227317923 136.90314950015687 0 35.175447977294304 136.90308297881043 0 35.17544346217008 136.90301307449332 0 35.1754373722758 136.9029187857268 0 35.17543030088617 136.9028092999121 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.08</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c0196ea2-da80-4e61-8e45-4272d85627cf">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175330817878915 136.90134032214334 0 35.175314812420424 136.9011229732446 0 35.17528946324515 136.90077876138562 0 35.175283571564115 136.900698764579 0 35.17527426795447 136.90057243502127 0 35.17526810666258 136.9004887721914 0 35.1752642924124 136.90043697987696 0 35.17508754845684 136.90045029151045 0 35.17511201644951 136.90080864929388 0 35.17511879034419 136.90090785270905 0 35.17511996853638 136.90092511197003 0 35.17512130225639 136.90094464553684 0 35.17512782180274 136.9010401356674 0 35.17512783205559 136.9010402893375 0 35.17513420900264 136.90113367969875 0 35.17514939163091 136.90135606238718 0 35.175330817878915 136.90134032214334 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.08</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_7492e892-1a96-4802-abe3-213f5f8d6d17">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175506854852884 136.90402199832752 0 35.17533695450211 136.90403209637 0 35.175367294969696 136.90454340256665 0 35.17537410645597 136.9046426449171 0 35.1753781348621 136.90470134141842 0 35.1753899462456 136.90487343333592 0 35.17539463260167 136.90494172876228 0 35.175570647868014 136.90492469631005 0 35.17555492948435 136.90469998159463 0 35.17555437344507 136.90469213238222 0 35.175548509138096 136.90460942754618 0 35.17554423850846 136.90454920783645 0 35.17553573988525 136.90442935017973 0 35.17552352919662 136.90425714951576 0 35.175506854852884 136.90402199832752 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.08</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_fb86ec68-3a46-4ced-ade3-d024948aaca9">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">1</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17830468486876 136.90536410544001 0 35.178302760216354 136.90533106406144 0 35.17827662909488 136.90488241434525 0 35.17799540347477 136.90490671329178 0 35.178006881758456 136.90508748649333 0 35.178014053173236 136.9052004132357 0 35.178021386022195 136.90531593057523 0 35.178027785517095 136.90541670364507 0 35.17803123050532 136.90546921717282 0 35.17803272465792 136.90549200523768 0 35.17830468486876 136.90536410544001 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2857f9b3-41e4-49a2-84be-db35cabfd33c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175824869114955 136.90862849698647 0 35.175646077083094 136.90865409382306 0 35.1757021885968 136.9094564857329 0 35.175702418050065 136.90945976706158 0 35.17588196176116 136.9094030443523 0 35.17588074802081 136.90938630531707 0 35.175879502844396 136.90936962127597 0 35.175872397402735 136.90927445640318 0 35.17586572475507 136.90918361477986 0 35.17586025050312 136.9091090917536 0 35.17585503799762 136.9090381349629 0 35.17585380436124 136.9090213894142 0 35.175850441275685 136.90897571783776 0 35.17584893657178 136.90895528862097 0 35.17584028696201 136.9088378327085 0 35.175824869114955 136.90862849698647 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.593</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_cd13558c-9a8d-4908-a077-007cdc4078bc">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17697707323507 136.90625941523083 0 35.17683621294638 136.9062758938547 0 35.17685662274718 136.9065310687276 0 35.17686740407572 136.90666586816573 0 35.176874865407505 136.90675915321668 0 35.17687779804702 136.90679581832515 0 35.176882950982396 136.9068602435068 0 35.17688767409429 136.9069192969126 0 35.17689637274712 136.90702806403993 0 35.17689805114688 136.907049050666 0 35.17690436084502 136.90712794040965 0 35.176910511284035 136.90720909675008 0 35.17704708572345 136.90721173693808 0 35.177040968461874 136.90707370762775 0 35.17702393538195 136.90685662088703 0 35.17701445996176 136.90673587242011 0 35.17701013554505 136.90668076024997 0 35.176999543109865 136.90654576234928 0 35.17697707323507 136.90625941523083 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.078</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_dbbbd5d1-8aa3-4da0-a2c0-3d761d1f829d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17640041091176 136.90852962400297 0 35.176403102094326 136.9085292998128 0 35.176515420993795 136.90851576942828 0 35.17657174228919 136.90850898420388 0 35.176700608510835 136.9084934597665 0 35.17684261889078 136.90847634018286 0 35.17696646262334 136.90846141121617 0 35.17691945438255 136.9082299016239 0 35.17638226906883 136.90829030926534 0 35.17640041091176 136.90852962400297 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.744</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_069d3368-d89c-4337-baba-52131ba95884">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17818359161069 136.90964782114457 0 35.17845138232103 136.90962711061644 0 35.17844751324118 136.90955289805834 0 35.178430694491084 136.90952802808286 0 35.178400210133866 136.90911321516833 0 35.178146824531154 136.9091408390359 0 35.17814821076907 136.90916012537508 0 35.17815626584466 136.90927113621754 0 35.17815874906556 136.90930537809834 0 35.17818359161069 136.90964782114457 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2453862e-1230-4592-8e92-0d322a01b9db">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175408669883716 136.9051804739608 0 35.17541701713744 136.90529486123006 0 35.17542223944134 136.90536641900448 0 35.17543469498757 136.90553710485776 0 35.17544565200214 136.90568724641224 0 35.17544955231983 136.90574069882362 0 35.17545538183855 136.90582058438167 0 35.175456495545625 136.9058358513288 0 35.175460501676916 136.9058907504313 0 35.17564132425142 136.9058874282703 0 35.17563135353707 136.90573639059335 0 35.17563008544493 136.905717252952 0 35.17562765082005 136.9056805143909 0 35.175625234825525 136.90564406012578 0 35.17562404406031 136.9056260925896 0 35.17561413489969 136.90547657865025 0 35.1756099447366 136.90541334378577 0 35.17558728821588 136.905158273609 0 35.175408669883716 136.9051804739608 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.08</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_8465d75c-a0e7-40f5-9b59-d10c959c4246">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17491604615336 136.91016269093504 0 35.17496038879057 136.9101587090743 0 35.17508134311966 136.91014778838644 0 35.17527728418685 136.91013009749733 0 35.1754049412672 136.91011857158904 0 35.17544626729634 136.910114840691 0 35.175611793118414 136.9100998955031 0 35.17571628569595 136.91009046130029 0 35.1757044002066 136.90992669344985 0 35.17491408240607 136.91000163819228 0 35.17491604615336 136.91016269093504 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.964</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2681fa75-bedb-4075-a676-e487721a6266">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17710217492154 136.9084825010939 0 35.17700455853974 136.9084872013702 0 35.177017045134896 136.9086664853428 0 35.17701937632005 136.9086999454972 0 35.1770235737987 136.90876022384037 0 35.17703361912297 136.90890446050216 0 35.177036329636884 136.90894337497755 0 35.17704120203679 136.9090133347649 0 35.1770458345199 136.9090798599632 0 35.17705068171795 136.90914945094943 0 35.177057278807666 136.90924417413336 0 35.17706286698602 136.90932441361235 0 35.1770674676864 136.90939048551053 0 35.17707550204305 136.90950584927802 0 35.17709391532039 136.90977026432347 0 35.17719798612719 136.90976430463007 0 35.17719025077875 136.9096797119441 0 35.17718223758404 136.9095920789386 0 35.17718187028801 136.90958806394056 0 35.177159586024 136.90927877721046 0 35.17715521210776 136.90921806891518 0 35.17715041834283 136.90915154412835 0 35.177144914864854 136.90907515687235 0 35.17714180969226 136.90903206604085 0 35.177136982364374 136.90896506708526 0 35.17713103293804 136.9088825066213 0 35.177129001470746 136.90885431104184 0 35.17712446292336 136.90879131856377 0 35.177113587412656 136.90864039481997 0 35.17710923361896 136.90857997308473 0 35.17710347344031 136.90849962436565 0 35.17710217492154 136.9084825010939 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">10.148</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_271d6138-1500-48cd-9771-ef65fe8e8c03">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17657091649262 136.9003052536017 0 35.17643410289644 136.9003168984503 0 35.17644114985379 136.9004318782588 0 35.176444698077155 136.9004897765086 0 35.17644659325193 136.90052069926463 0 35.17644852488949 136.9005522202586 0 35.17645211137678 136.9006107387078 0 35.17645906736667 136.900724238895 0 35.176463897211825 136.90080304030704 0 35.176473073449415 136.9009527782783 0 35.176473697980796 136.9009629746403 0 35.176477632980514 136.90102718021328 0 35.17648508595447 136.9011488033188 0 35.17649001182657 136.90122918105467 0 35.17663141250182 136.90121280183453 0 35.17662002993641 136.90104254873327 0 35.1766155683675 136.90097581629254 0 35.17661248428164 136.90092598157716 0 35.17657849586421 136.90041843350303 0 35.17657091649262 136.9003052536017 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.054</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1c420479-1577-4eab-913b-ce0be343edd6">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176643094876695 136.90152544646318 0 35.176511664548684 136.90152554384363 0 35.176520705771196 136.90167166154802 0 35.176530850444635 136.90183562647735 0 35.176534185549045 136.90188953467504 0 35.17653565783741 136.90191232232547 0 35.176537637731634 136.9019429912603 0 35.17655409899916 136.9022091679652 0 35.17656115652409 136.90232320388245 0 35.17656487492017 136.90238266406544 0 35.17656949835364 136.90245659605816 0 35.17671073208669 136.90244625795472 0 35.17669270605898 136.9021997272446 0 35.17668880470901 136.9021469307435 0 35.17667676531042 136.90198323619313 0 35.17667110552995 136.90190628057314 0 35.176669026286724 136.90187800314354 0 35.176659972582044 136.90175491589446 0 35.176658152525015 136.9017301673886 0 35.17664899551389 136.90160566531188 0 35.176643094876695 136.90152544646318 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.749</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_397631a1-9ca5-4141-bdca-fb5d71cbb703">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176726917650726 136.90267577721954 0 35.17659109659057 136.9026879638634 0 35.17659545833166 136.90275275341727 0 35.17659892661439 136.90280425795888 0 35.17660367025382 136.90287472683625 0 35.17661680164128 136.9030697827174 0 35.176620565121446 136.90312568782343 0 35.17662094702929 136.9031313484723 0 35.17662351532847 136.90316950875354 0 35.176628114795896 136.90323761545343 0 35.17663303186289 136.90331043443146 0 35.176635934184944 136.90335340685098 0 35.17664170527231 136.903438864339 0 35.17664380564487 136.9034699809078 0 35.17665397285685 136.9036205386563 0 35.1767895665169 136.9035866157778 0 35.176779228592345 136.9034363361039 0 35.1767702045341 136.90330542584792 0 35.17676360230673 136.90320964622674 0 35.17676080429577 136.90316906574162 0 35.176745145944096 136.9029411266574 0 35.17673962631514 136.90286077683137 0 35.1767370279871 136.9028229459741 0 35.176726917650726 136.90267577721954 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.721</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_298e5e8d-b0ba-4d39-8026-4f412345fe64">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175846542376384 136.90835055205872 0 35.175850654786956 136.9085882326602 0 35.175931225354326 136.90857952424838 0 35.17603857152521 136.90856785690323 0 35.17617233741394 136.90855331845975 0 35.176246899332796 136.9085452141495 0 35.176296346522584 136.90853984063722 0 35.17636715299069 136.9085321445147 0 35.1763491028056 136.90829403885576 0 35.175846542376384 136.90835055205872 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.744</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6671cae4-9ee0-4ef2-b48d-e8b1daa18316">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17730647788521 136.91143424915342 0 35.17721207833082 136.91142554135368 0 35.17721873698039 136.91151994962172 0 35.17722365149042 136.91158963731036 0 35.17723910373321 136.91180875288205 0 35.17725709489782 136.91206386661094 0 35.17726654136499 136.91219781854318 0 35.17727451505361 136.91231089172481 0 35.177280955607976 136.9124022189814 0 35.17728511888995 136.9124612549846 0 35.177294478523386 136.91259398640273 0 35.17729919265529 136.91266083674458 0 35.17730350540139 136.91272199896449 0 35.177396420673944 136.9127107308741 0 35.17739160208195 136.9126426291541 0 35.177385458694545 136.91255579458615 0 35.17737973990027 136.91247458002246 0 35.177368525142704 136.9123153166152 0 35.17736309889462 136.91223826884965 0 35.17734796360939 136.91202333382077 0 35.177341358028805 136.91192954112427 0 35.17733669438428 136.91186331424788 0 35.17733056442037 136.91177627005567 0 35.1773150426923 136.91155586331794 0 35.17730956948559 136.91147814936917 0 35.17730647788521 136.91143424915342 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.76</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2b482b91-76ee-4110-802f-0a98051563b0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17720430671951 136.90996611357772 0 35.177114634795984 136.90997638644885 0 35.17711722827667 136.91001383456089 0 35.177119055498295 136.91004021047468 0 35.17712167591499 136.9100780427744 0 35.17712743003999 136.91016113532018 0 35.17713621917898 136.91028804798432 0 35.17714022408472 136.91034587656864 0 35.177145925006755 136.91042819529355 0 35.17715012790543 136.91048888552078 0 35.17716514927993 136.91070578974308 0 35.177168995910314 136.91076133191908 0 35.17717403638554 136.9108341152293 0 35.17717853570893 136.91089909959393 0 35.17719034676504 136.91106965256864 0 35.17719737025268 136.91117107748173 0 35.17720010002735 136.91121049379743 0 35.17720482785195 136.91127877341603 0 35.17729957774465 136.91127620659412 0 35.17729058669062 136.91120351125926 0 35.17728830554733 136.91117079734323 0 35.177283085106126 136.91109593502898 0 35.17727311166568 136.91095291500713 0 35.17727042700486 136.9109144119858 0 35.177265969611156 136.91085049678125 0 35.1772640016327 136.9108222679685 0 35.177257669166806 136.910731464224 0 35.177250823418674 136.9106332720652 0 35.17724065321725 136.9104874102845 0 35.177235633091996 136.91041539650845 0 35.17723075149686 136.91034539477658 0 35.17722414527937 136.91025063729325 0 35.17721988923853 136.91018959805507 0 35.17721202226433 136.91007677075913 0 35.17720788512577 136.91001743292657 0 35.17720430671951 136.90996611357772 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.381</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_00b7e1df-6a40-4062-96e2-87c1d64a8c4d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17673781229933 136.90478777944693 0 35.176874815658934 136.9047803134739 0 35.1768110348573 136.90388374942435 0 35.17668343284159 136.90392119342886 0 35.176686087711694 136.90396363969998 0 35.17669007181769 136.9040271131304 0 35.176694308947766 136.90409463042892 0 35.17669744332203 136.90414456177194 0 35.176708223523775 136.90431631934845 0 35.176717469531546 136.90446364805456 0 35.17672300973204 136.9045519126915 0 35.17672663316917 136.90460965298715 0 35.17673781229933 136.90478777944693 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.36</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2706c545-e947-4abc-9efe-04335fbe153b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175371267628265 136.90514227752428 0 35.17536010917543 136.90498432756945 0 35.17528384283356 136.90499158524676 0 35.17528274149444 136.9049916897812 0 35.175070687855325 136.90501186984528 0 35.17502752745838 136.9050159769744 0 35.17498084223604 136.90502041926723 0 35.17494940541664 136.90502341070754 0 35.174932170630036 136.9050250468733 0 35.17487910446713 136.90503008488747 0 35.174806938810775 136.9050369362986 0 35.174662173987755 136.90505067999547 0 35.17467452293955 136.9052172980196 0 35.174730124573394 136.90521128479352 0 35.174780274639176 136.90520585990953 0 35.17484277161309 136.90519910108827 0 35.174909880197475 136.905191842228 0 35.17494975982983 136.90518754259514 0 35.17497571556043 136.9051848245743 0 35.17501068353922 136.9051810896019 0 35.17505205030637 136.90517667540814 0 35.17510476262308 136.90517099525212 0 35.17516044180492 136.90516499598505 0 35.17524591940616 136.90515578439363 0 35.1753012543147 136.9051498224379 0 35.175371267628265 136.90514227752428 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.328</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9a3edc76-5362-43c5-a15c-db023499d0ce">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17535387812536 136.90137384250173 0 35.17537333178413 136.90161289872995 0 35.175418434508785 136.9016074813868 0 35.175473644272785 136.90160084990495 0 35.175644520389405 136.90158032574993 0 35.17565328102436 136.90157927298065 0 35.17567554354735 136.9015765987141 0 35.1757280632026 136.90157028991885 0 35.17578761678139 136.90156313705796 0 35.175850447253886 136.90155563869084 0 35.17583613936202 136.90132748179337 0 35.17579181563669 136.90133172643743 0 35.17578190543542 136.90133267537703 0 35.17576245274729 136.90133453912395 0 35.17571115330942 136.90133945308244 0 35.17566263609461 136.90134412304658 0 35.17552020098368 136.90135783293698 0 35.17546008913312 136.90136361977005 0 35.175402010509345 136.90136921005458 0 35.17535387812536 136.90137384250173 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">19.357</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_df5b3f48-5c32-4ae4-a86a-fad839e054c2">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17647979092711 136.90150149353133 0 35.17646827329735 136.90126405514943 0 35.17644926488485 136.90126626661763 0 35.17640533068499 136.9012713774034 0 35.176395498434665 136.9012725204327 0 35.17637979657866 136.90127434786484 0 35.1763460614197 136.901278271604 0 35.176306723412814 136.9012828481336 0 35.176287432017794 136.9012850923515 0 35.17623666841216 136.90129099713226 0 35.17617274166857 136.90129843342916 0 35.176161055622096 136.90129979327207 0 35.17606211849853 136.90131130233195 0 35.175983780430435 136.9013204146989 0 35.17600690774839 136.90154925041767 0 35.17612333056482 136.90153749275052 0 35.17647979092711 136.90150149353133 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">19.357</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b350202f-f748-4324-9d99-d9e79f5c973b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17772806002155 136.90135493033034 0 35.17775850490268 136.901138322097 0 35.17733719883324 136.90118436284513 0 35.17721488416031 136.9011977301306 0 35.17721994931103 136.90141125719006 0 35.177459359766544 136.90138471693487 0 35.17772806002155 136.90135493033034 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">19.357</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_404bb7ca-b980-4a4b-8124-74c9fac38a9c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18288971246246 136.9002812352386 0 35.18310547218719 136.90026043801194 0 35.18317118841346 136.9001454965723 0 35.18322444212956 136.90004627095774 0 35.18315530203684 136.89988278646172 0 35.18302444585743 136.89989792712558 0 35.182953970930264 136.89990606292332 0 35.18286130759508 136.8999167776141 0 35.18288971246246 136.9002812352386 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">27.516</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3a4ee157-417c-4f5c-a920-c46a86476dce">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1761522356396 136.90391430498937 0 35.17621301697545 136.90390791508173 0 35.1762683890759 136.90390209371478 0 35.17634379120163 136.9038941657937 0 35.17635798841279 136.9038926730775 0 35.17664467242426 136.90386254632713 0 35.17663464177254 136.90364354708737 0 35.176285928234954 136.90367975910848 0 35.176153469246 136.903693514155 0 35.1761522356396 136.90391430498937 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">18.679</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4ab00dd7-e43b-4d0e-84bd-8a7399d8ec9d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17552125664301 136.90375454286698 0 35.17553370500088 136.903974483227 0 35.175593539242385 136.90396823808985 0 35.17565620517951 136.90396169728453 0 35.17570576437765 136.90395652378785 0 35.17576456219137 136.90395038735542 0 35.17583834672451 136.9039426854114 0 35.17602208706139 136.90392350691616 0 35.17601314182673 136.90370615268353 0 35.17595550750611 136.90371215711153 0 35.17589276878928 136.90371879937422 0 35.175834835422975 136.90372491234018 0 35.17578977803705 136.9037296652711 0 35.17574522174042 136.90373436608024 0 35.17573746478724 136.90373518483096 0 35.175690438196746 136.90374014610225 0 35.175625030861056 136.90374704723124 0 35.175576795710114 136.90375213644086 0 35.17552125664301 136.90375454286698 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">18.679</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9ef2d61e-c05c-4f7f-82c5-77b94ed8c264">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17831328231339 136.9076748416272 0 35.178016228869794 136.90767538375425 0 35.178026827059206 136.9077837149613 0 35.1780246080801 136.90788429157632 0 35.17801779365892 136.90794360091178 0 35.17832744946907 136.9081166408986 0 35.17831645053831 136.90794715608993 0 35.17831355877047 136.907899922635 0 35.17831328231339 136.9076748416272 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_8044c395-598c-45c9-ae51-dd6d8ee8c019">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18207547777645 136.90736078350963 0 35.18254363447316 136.90733057004962 0 35.18253986588274 136.90730210366482 0 35.18251582179569 136.9071031159954 0 35.18206063008239 136.9071508870052 0 35.18207547777645 136.90736078350963 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">52.576</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_a4a28523-3c7d-441f-91a6-073b40633d52">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176474785579 136.90985036222523 0 35.17647208919083 136.90985061068503 0 35.1764746876478 136.91001331135175 0 35.17653921806482 136.91000717986444 0 35.17662591944131 136.909998892665 0 35.17668936836267 136.90999287434389 0 35.176775529105605 136.9099846986029 0 35.1767913868166 136.9099831885425 0 35.17683898969442 136.90997865716633 0 35.17688770112428 136.90997402019462 0 35.176974619767705 136.90996574541415 0 35.177092773457815 136.9099544969967 0 35.17707918365779 136.90979479403026 0 35.17690550911777 136.9098107110536 0 35.17683890540758 136.90981684924702 0 35.17681132652057 136.90981935138623 0 35.176474785579 136.90985036222523 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.591</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b2752c2c-71e5-45d7-a35b-4487bc433758">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17778901658762 136.90972668594048 0 35.17778631959535 136.9097269277726 0 35.177646067535484 136.9097395037793 0 35.177416328624574 136.90976010546407 0 35.17721166130367 136.90977845758616 0 35.177220677293555 136.90994926408428 0 35.17738895020838 136.90993411195163 0 35.177479071107996 136.9099259960847 0 35.177576950158176 136.90991718278306 0 35.17770191513931 136.90990593255134 0 35.17779936178487 136.90989716046363 0 35.17778901658762 136.90972668594048 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.591</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_7ecc6a5c-af80-496e-ace3-5f70bf0f338a">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175820524706985 136.9114283538854 0 35.17577297294615 136.91143278977796 0 35.17571058992851 136.91143860815248 0 35.17566126627605 136.91144320986245 0 35.17561256539667 136.91144775253005 0 35.17550978307073 136.91145733993025 0 35.17549516721822 136.91145870307273 0 35.17545817199744 136.9114621540702 0 35.175320453841664 136.91147500044005 0 35.175205763961806 136.91148569761071 0 35.17518030496168 136.91148807283938 0 35.17515169152543 136.911490742275 0 35.175055182006915 136.9114997434562 0 35.175007713469086 136.91149961401476 0 35.17501198123628 136.91162432762115 0 35.17509082096549 136.91161676071877 0 35.175132296157976 136.911612779811 0 35.17527792302816 136.91159880233522 0 35.175428855623544 136.9115843152837 0 35.17560691440519 136.91156722488176 0 35.175654864259336 136.9115626220522 0 35.17577588755347 136.91155100596777 0 35.17584078203653 136.9115447769015 0 35.175820524706985 136.9114283538854 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.763</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b2f3bda5-355e-44e4-a08f-2c3870d245ae">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180876019841364 136.91207281500874 0 35.18088747903858 136.91216977743588 0 35.18120044427815 136.91213342547795 0 35.18128613802745 136.91212347206977 0 35.18135433091217 136.91211555064237 0 35.181516457426945 136.912096718968 0 35.18164216344858 136.9120820028885 0 35.18177340398236 136.91206669306803 0 35.18191874864425 136.91204973836508 0 35.18191458932579 136.9119579607431 0 35.18178911515107 136.9119723216971 0 35.18170279656434 136.9119822004198 0 35.181588252459775 136.91199531065288 0 35.18144712306333 136.91201146279397 0 35.181261470299326 136.9120326836039 0 35.180876019841364 136.91207281500874 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.966</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d8e80537-4feb-4a65-977f-4fac2ae18190">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17667930408223 136.90147109248923 0 35.176805682815576 136.90145704278493 0 35.17684040609783 136.90145318176127 0 35.176936268459826 136.90144252483842 0 35.17700748863465 136.9014346070634 0 35.177107639888625 136.9014234728969 0 35.17709122064716 136.90120439024557 0 35.17680616211286 136.90123550933174 0 35.17678871979428 136.90123743905374 0 35.176679909434796 136.90124947992018 0 35.17665998333817 136.90125168449947 0 35.17667930408223 136.90147109248923 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">19.357</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_69b48185-ae5a-4c88-8a0a-a8db4579bd1c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176811807399865 136.90574228014916 0 35.17694323207838 136.90573955459462 0 35.176939105805054 136.90568247993457 0 35.176936263606684 136.9056431806729 0 35.17693198779954 136.9055832486504 0 35.176918516406126 136.9053975259879 0 35.176909981137456 136.90527909691284 0 35.176903809834954 136.90519346792018 0 35.176895552249974 136.90507890592136 0 35.176894174098884 136.90505977822812 0 35.17689212501144 136.90503134903096 0 35.176756937790174 136.9050449570284 0 35.17676207198622 136.90511070942728 0 35.176769170578446 136.90520160304013 0 35.17677557138702 136.90528330724766 0 35.17677844271817 136.9053189250526 0 35.17678425021025 136.9053926483141 0 35.17678460053764 136.9053970904124 0 35.17679543948224 136.90553461439276 0 35.17680060448742 136.90560014607698 0 35.17680712717069 136.90568289516386 0 35.176811807399865 136.90574228014916 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">11.714</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1a6f2ef9-df7e-4562-ad07-0136b7d91e5f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17561906966905 136.90824807006888 0 35.17581149909583 136.90823450599763 0 35.175777930978484 136.9077540653525 0 35.17558682795384 136.90775554957207 0 35.17561906966905 136.90824807006888 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.593</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f53c95b5-d556-4d7e-ade0-f342dd181b7b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.179100770722144 136.90964314374585 0 35.178504091709904 136.90970763749402 0 35.17847847456824 136.90970003261972 0 35.17845534627889 136.90967584121924 0 35.178469755974064 136.9098622057458 0 35.178471751824404 136.9098880189213 0 35.1785012314676 136.90984664413463 0 35.178929434462624 136.9098083847747 0 35.17897597442348 136.90980338550008 0 35.17911029584697 136.9097846713286 0 35.17911108096516 136.90978464776333 0 35.179100770722144 136.90964314374585 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_bcd13bb0-949e-49dd-8e5e-ab7c2bf5d00b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17917137267673 136.91254293532168 0 35.1791693973625 136.91251317091576 0 35.179169738230875 136.91248058089732 0 35.17916383417765 136.9124300908985 0 35.17916232146364 136.91240900424648 0 35.1791607697792 136.912387390707 0 35.179153270353915 136.91227519287617 0 35.179151649111155 136.9122509456089 0 35.179142874058684 136.91212246718828 0 35.17912982328956 136.9119313857349 0 35.179118056710045 136.91175911895704 0 35.17910700792958 136.91159736052694 0 35.17910142608412 136.9115164183768 0 35.17908282032199 136.91124270629905 0 35.17901143291806 136.91124600383407 0 35.179019576699325 136.91136408099368 0 35.17902755673933 136.9114797981292 0 35.17904294646724 136.9117029492327 0 35.17905094106646 136.9118188848791 0 35.17905855340553 136.9119292782663 0 35.179076462938895 136.9121889906233 0 35.17909204846974 136.91241500151085 0 35.17909873309232 136.9125560972802 0 35.17917137267673 136.91254293532168 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.758</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_987b811f-e149-4d0f-9d6f-034f4ba34b79">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17595032435715 136.90251074933215 0 35.17604227340622 136.90251154978608 0 35.17603300757779 136.9023603558072 0 35.17601142715962 136.902008265196 0 35.176007220265994 136.90193944088446 0 35.17600432792562 136.90189219142076 0 35.17598487754909 136.9015744637038 0 35.17588175307238 136.90157479847625 0 35.1759070312748 136.90191891670082 0 35.17590911706957 136.90194730912526 0 35.17590928435256 136.90194960757003 0 35.17591117433254 136.9019754359537 0 35.175917932384955 136.9020678236749 0 35.17592752350425 136.90219897212395 0 35.17593114359582 136.90224847207406 0 35.17593295083266 136.9022731775953 0 35.17595032435715 136.90251074933215 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.521</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_308bb6f0-aebc-4f1d-9436-0fe50b472f27">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17603076400755 136.90368490657758 0 35.176125989257336 136.90365846999396 0 35.17610914931403 136.9034206586291 0 35.17609148674689 136.90317122550545 0 35.17607620430324 136.90295570755856 0 35.176059308844344 136.9027174597055 0 35.175965132038336 136.90272852346854 0 35.175982310861656 136.90297851869335 0 35.1759955737614 136.90317153499305 0 35.17600723890793 136.90334170384628 0 35.176011407788216 136.90340252909976 0 35.17601914959941 136.90351546426712 0 35.1760276519115 136.90363950989158 0 35.17603076400755 136.90368490657758 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.491</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4a55015b-2c82-484d-9bba-b10573a52d92">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">2</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175205088402684 136.9084090476791 0 35.17522058416575 136.90864885088052 0 35.175223277841674 136.9086485639076 0 35.17530257266214 136.9086401161617 0 35.17552324943636 136.90861495355983 0 35.175591800543664 136.90860727568574 0 35.1755951745593 136.90837165814483 0 35.175205088402684 136.9084090476791 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">18.923</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_044db6e4-b7f0-4338-9fdd-112cda3b5ee2">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177147175692824 136.9002078557691 0 35.17730447779569 136.900192348288 0 35.17768277361727 136.90014868696866 0 35.17767393835764 136.89998435774712 0 35.177489198004785 136.90000348729924 0 35.177134186655195 136.90004024745437 0 35.177147175692824 136.9002078557691 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.709</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_783ab3c9-37c6-4eaa-9378-2a38c75f3a39">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1819308600888 136.911936389694 0 35.182026933457266 136.91192560951572 0 35.18202129551853 136.91185106716304 0 35.182009963660306 136.91170123225365 0 35.1820019744048 136.91159559469963 0 35.181984467415624 136.91136409754702 0 35.181974313391414 136.91122934086556 0 35.18197169720411 136.91119462671003 0 35.18196932954064 136.9111632057019 0 35.1819643864592 136.91109761172018 0 35.18195478582246 136.91097020760336 0 35.181867161460076 136.91096828609085 0 35.18187512406025 136.9111263967209 0 35.181897321480974 136.9114266449148 0 35.18191021475255 136.911622602764 0 35.18191594189345 136.9117096497887 0 35.18192016036715 136.91177376047355 0 35.1819240882859 136.9118334648055 0 35.1819308600888 136.911936389694 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">10.317</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_537ae5d5-7266-4924-a1ff-632fea11eb7e">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175898374559864 136.9003578406006 0 35.175804761287836 136.9003791156108 0 35.175830617701116 136.90077770752322 0 35.175836204589295 136.90086384197934 0 35.17584282069147 136.90096633497754 0 35.17584616380408 136.90101837514456 0 35.17586354951432 136.90128918609025 0 35.175959572113754 136.90129776697202 0 35.17593532764007 136.9009259960264 0 35.17592515135964 136.90076995710214 0 35.17592513271153 136.9007696750044 0 35.17591616473076 136.90063154210526 0 35.175898374559864 136.9003578406006 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.265</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ffc101bb-9bfa-4446-87c2-bd3380899fca">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18321901595465 136.90903510125437 0 35.18317990486514 136.90925251700907 0 35.18320222997486 136.9095538231441 0 35.18321217467168 136.90968803439853 0 35.183224457834385 136.90985383192668 0 35.18323789420273 136.91003517453558 0 35.1832421787031 136.91009301313636 0 35.18324646593368 136.91015087698852 0 35.18325215155879 136.91022760763465 0 35.18325969680733 136.9103294643828 0 35.18326174662451 136.91035712074893 0 35.18326500652776 136.91040113449228 0 35.18326904955375 136.91045569967835 0 35.18327130999961 136.91048620687462 0 35.183275246291984 136.91053933952472 0 35.18328339534709 136.9106493470282 0 35.18328513889367 136.91067287701895 0 35.18334142742807 136.9106765797213 0 35.18331787025596 136.91036084790608 0 35.18324768928414 136.90942029596977 0 35.18323237697374 136.90921392186422 0 35.18321901595465 136.90903510125437 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">6.258</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4aa2cb35-144e-4724-803a-579d899ae040">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17962379949313 136.91108125449267 0 35.17963730139479 136.91115862598966 0 35.179798176552616 136.9111431904979 0 35.17985955242498 136.91113728909875 0 35.179895602757725 136.91113377263991 0 35.17997022812257 136.91112662421202 0 35.18001247471117 136.91112255364948 0 35.180025568226114 136.91112129284838 0 35.1800568978454 136.91111827424763 0 35.18018848549343 136.91110559828422 0 35.180260818873634 136.91109949014972 0 35.180328644933795 136.9110937617311 0 35.180337743250796 136.9110912200383 0 35.180387029582654 136.91108647192323 0 35.18045652758338 136.9110797775407 0 35.180530109190975 136.91107268827426 0 35.180698265466184 136.91105648961485 0 35.18068556121205 136.9109739630182 0 35.180613970684675 136.91098137663738 0 35.1805685793973 136.9109860774977 0 35.18053838749139 136.91098913652473 0 35.18019924877196 136.91102445459816 0 35.180140572267916 136.91103056285473 0 35.180125158261 136.91103216691022 0 35.18000035915546 136.91104515769996 0 35.17993716650499 136.9110517357126 0 35.17992743762701 136.91105278177164 0 35.17991490400303 136.91105323274053 0 35.17976794764711 136.9110689026406 0 35.17962379949313 136.91108125449267 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.609</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3b3b26c4-a64e-4077-9789-fad22181f891">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18082945915368 136.91094430665626 0 35.18079403473749 136.91046253130932 0 35.180790756544326 136.91041795679763 0 35.18077915003028 136.91025802070246 0 35.18065546013626 136.9102937413964 0 35.18069319726078 136.91079079985138 0 35.18070380615813 136.91094821367898 0 35.18082945915368 136.91094430665626 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.148</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_643188f7-63b3-4af6-8158-f72a31ded9ee">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176117785833476 136.90486508349517 0 35.176202981447496 136.9048693117317 0 35.17616578328955 136.90430557461366 0 35.176161967538604 136.90425400113054 0 35.1761536210081 136.9041412334199 0 35.176144801652825 136.90402206212934 0 35.1761385852225 136.90393806345907 0 35.17604989849883 136.903945155743 0 35.176051709770476 136.9039727125579 0 35.17606044586903 136.90410585139068 0 35.176072096730266 136.90428293181066 0 35.176072166663964 136.90428400532707 0 35.176117785833476 136.90486508349517 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">9.222</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5df81286-6515-4dfc-af91-accc9833990b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.182829756647266 136.91077092771772 0 35.18276360483067 136.91077761318033 0 35.1827484862969 136.9107791175935 0 35.182614196767666 136.91079248262653 0 35.18259615186222 136.91079427838733 0 35.182501159843 136.9108037991517 0 35.18231270777741 136.9108226162152 0 35.182252053328924 136.91082862557695 0 35.18212260996074 136.91084157229918 0 35.18203899710963 136.91084993516353 0 35.18199377407592 136.91085447864646 0 35.18195784475738 136.91085808876417 0 35.18196449190938 136.9109562329315 0 35.18222942562872 136.91092567757153 0 35.18261439423993 136.91088127918567 0 35.18265636153022 136.91087643844628 0 35.18271187708828 136.91087011579447 0 35.182849464115456 136.9108585929292 0 35.18285216193151 136.91085836698764 0 35.182829756647266 136.91077092771772 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.609</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f29e95ad-1466-45de-9742-b621880d3914">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17655027727 136.90248860717404 0 35.17642931385299 136.9024995657942 0 35.176253670619005 136.90251547711586 0 35.17606188153117 136.9025330050917 0 35.17607252122232 136.90269963110353 0 35.17611806655443 136.90269501983389 0 35.17617262704205 136.90268949560962 0 35.17622317698737 136.9026843773898 0 35.17626590953102 136.90268005076797 0 35.17626655211736 136.90267998501258 0 35.17642307137489 136.902664136968 0 35.17656016673689 136.90265468874887 0 35.17655027727 136.90248860717404 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.496</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d04a30ce-5699-44a4-af50-0bfd69a7324d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17577583932652 136.90018071128165 0 35.175688086333906 136.90019459281547 0 35.175671668636994 136.90019719019858 0 35.1756240572061 136.9002017634648 0 35.175587144558136 136.90020530932432 0 35.175566604086846 136.9002072833796 0 35.17545929901619 136.90021759134467 0 35.17540233437239 136.90022306353143 0 35.17534551933502 136.90022852094964 0 35.17528007389193 136.90023480797322 0 35.175295221271504 136.90040020971014 0 35.17534765027646 136.9003941079854 0 35.175378042806194 136.9003905714059 0 35.17544663958172 136.9003825878698 0 35.17546882025196 136.90038000687144 0 35.17549438948314 136.90037703056146 0 35.175534195187204 136.90037239832208 0 35.17554428607747 136.90037122471077 0 35.17562334593934 136.9003620234962 0 35.17577565823928 136.9003442975887 0 35.17577583932652 136.90018071128165 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.709</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_41793f7f-8a68-4c9d-8e5f-40664902352b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17592318209424 136.90254805569748 0 35.17585269914471 136.90255470194077 0 35.175789195542464 136.90256068992076 0 35.17575356697812 136.9025640505149 0 35.17567377762635 136.90257157439777 0 35.17565141018208 136.90257368331956 0 35.17561110662193 136.90257740924727 0 35.17556209235909 136.90258194064558 0 35.17551842607191 136.90258592446403 0 35.17546912723362 136.90259058522471 0 35.17546039692964 136.90276232291257 0 35.17560838846007 136.90274643029252 0 35.17581334874312 136.90272441938072 0 35.1758918238532 136.90271774855225 0 35.175945443540606 136.90271319135053 0 35.17592318209424 136.90254805569748 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.496</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_569a3439-802f-4b77-9ab7-18a60acc8801">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175926625873 136.9003332654594 0 35.175991461062374 136.9003261702064 0 35.17604544457496 136.9003202631256 0 35.176078395243565 136.90031665666064 0 35.17618239145588 136.90030527591162 0 35.17638163836407 136.90028347167578 0 35.176391475837924 136.9001171100832 0 35.17615187958309 136.90014185484142 0 35.176097857500494 136.9001474350015 0 35.17607548693691 136.9001497444259 0 35.17605666094949 136.90015168875843 0 35.17602789519505 136.9001546602226 0 35.17591066468862 136.9001667672204 0 35.175926625873 136.9003332654594 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.709</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5584629b-a04f-492d-b860-15eee0e657ba">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17609551938646 136.90490643573952 0 35.17560371712107 136.9049600521154 0 35.17561369757417 136.9051151518002 0 35.17610634566485 136.90506537700392 0 35.17609551938646 136.90490643573952 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">15.39</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_55913aac-ab2f-4946-95b6-88da6ed77c91">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17658641377282 136.90009693111526 0 35.176599951076064 136.90026794002236 0 35.176813453813786 136.90024550497986 0 35.17686652481285 136.90023989829234 0 35.17691961924369 136.90023428932503 0 35.17704380979741 136.90022136796287 0 35.177039646649895 136.9000499981548 0 35.17703695203453 136.90005027719474 0 35.17687994628106 136.90006653583657 0 35.17681935330694 136.90007280946975 0 35.17679208543329 136.90007563337343 0 35.17673138431184 136.90008191942272 0 35.176717368248575 136.90008337049684 0 35.176697599580606 136.90008541784766 0 35.17663712827344 136.90009168007572 0 35.17663466608737 136.90009193404367 0 35.17658641377282 136.90009693111526 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.709</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_32373eb1-30f6-4128-822a-7f245442be51">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17623843338933 136.9050520313884 0 35.176719011016964 136.9050034753667 0 35.17670549897499 136.90484092356257 0 35.17622782959751 136.90489635012312 0 35.17623843338933 136.9050520313884 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">15.39</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6a9355e4-1d94-45f1-8687-b44b098d8130">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176961505500046 136.90812371073002 0 35.17710774702417 136.90809426290247 0 35.17707891955054 136.90759678207286 0 35.176929571231774 136.90760658811064 0 35.17695025246546 136.9079470931657 0 35.176961505500046 136.90812371073002 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.576</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d0a4557f-42db-4fba-a9b0-48bb9be30bcf">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17773263886831 136.91265797328737 0 35.177797976103825 136.9126496454424 0 35.177781740242196 136.91243998811362 0 35.17777388579823 136.91233857044023 0 35.17777026990092 136.91229082227457 0 35.177766191504325 136.91223747617332 0 35.17776257833511 136.9121910455096 0 35.17775463321048 136.91208775621766 0 35.17775460817938 136.9120874269204 0 35.17775184997755 136.9120515050674 0 35.17773397209012 136.9118142536564 0 35.177728390120166 136.91174603222387 0 35.17772092158438 136.9116487866633 0 35.177713072940385 136.91154658521268 0 35.1777107808096 136.91151674220507 0 35.177701778116976 136.91139952707982 0 35.17764723856206 136.91139848987243 0 35.177652566699955 136.9114770653566 0 35.17765585504734 136.9115322100043 0 35.17765785754775 136.9115550799325 0 35.17767697200502 136.91183697617942 0 35.17768815976559 136.91200196474261 0 35.17768881189187 136.91201157936183 0 35.17770235115893 136.91221126470225 0 35.17771078022793 136.91233557754515 0 35.17771710499437 136.91242886872794 0 35.177720121728605 136.91247334803862 0 35.17773263886831 136.91265797328737 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">6.393</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_a4a7f90b-0732-4704-becb-e50f4e0fe5d5">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17596557494012 136.91006673205737 0 35.176094508309816 136.91005301492794 0 35.1761605044 136.9100459939921 0 35.17619279767343 136.9100425581958 0 35.176216315560815 136.91004005573987 0 35.17629055800647 136.9100321579953 0 35.17641006708591 136.91001944311245 0 35.17640063367535 136.90985748400573 0 35.176363126022046 136.90986072467445 0 35.17632211779647 136.9098642571248 0 35.176231711156206 136.9098719621239 0 35.176196389035226 136.90987497274705 0 35.1761220975281 136.90988140948 0 35.175943940850416 136.9098968461611 0 35.17596557494012 136.91006673205737 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.591</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_182f2ced-dafc-4880-93ff-817ebdbc8b30">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.177199066618186 136.91141087002936 0 35.17718801725148 136.9113007841935 0 35.177066335065135 136.9113115498486 0 35.17697742417763 136.9113194166235 0 35.17689152715396 136.91132701594853 0 35.17685030368308 136.9113306625424 0 35.17678723418077 136.9113362427823 0 35.17674177827661 136.91134024514665 0 35.17668911034921 136.91134488049073 0 35.17661186909731 136.91135167647985 0 35.17654865171847 136.91135723958203 0 35.17654449077883 136.91147879027415 0 35.17658126166634 136.9114749743349 0 35.17662000989289 136.91147095459021 0 35.176649648309436 136.91146787896272 0 35.17668400926105 136.9114643131817 0 35.17673280639338 136.9114592508509 0 35.176813276051774 136.91145090011025 0 35.176830537640136 136.91144910927392 0 35.176886143691135 136.91144333945158 0 35.17689946502602 136.91144195727165 0 35.176973665608685 136.9114342584855 0 35.177071251750014 136.91142413267116 0 35.177091380203834 136.91142204411182 0 35.177145397350806 136.91141643841516 0 35.17717063677783 136.91141382005353 0 35.177199066618186 136.91141087002936 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">10.493</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_92b42033-c120-461e-815f-fad3cd1efa54">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18184018176251 136.91086991132158 0 35.18181791993971 136.91087214814388 0 35.18158206173157 136.9108956150725 0 35.181509240646676 136.9109029799993 0 35.1811051998345 136.91094340347004 0 35.180857814828265 136.9109681533569 0 35.18086276422845 136.91104310194777 0 35.18099564376984 136.9110300836995 0 35.18104767425292 136.91102498654624 0 35.18110442552012 136.9110194266356 0 35.18125668751928 136.91100450943364 0 35.18133247063122 136.9109970848394 0 35.18145559137479 136.91098502349598 0 35.181508347363 136.9109798548393 0 35.181665918651156 136.91096441688802 0 35.18178547310992 136.91095270478826 0 35.18184539138275 136.91094683400965 0 35.18184018176251 136.91086991132158 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.609</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_a8e80396-567f-41db-aa42-61bf36cfb95b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17705763970572 136.9002385599906 0 35.17707520546197 136.90057862585093 0 35.177076423778566 136.90060222910327 0 35.17709258294603 136.90091507706097 0 35.17710650177307 136.90118457821166 0 35.177188606849505 136.90117706506578 0 35.177176390251866 136.90096934625993 0 35.177173318002254 136.9009171012528 0 35.17716716598542 136.9008125025819 0 35.17715466031635 136.90059986619568 0 35.17714643849677 136.900460075353 0 35.17713289089733 136.90022975077122 0 35.17705763970572 136.9002385599906 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b0aa84a6-79ca-4618-8b72-ba75214fb08c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17570565996691 136.9095105747324 0 35.175734776200656 136.90988290190816 0 35.1759158332694 136.9098625704948 0 35.1759134931574 136.90983070053508 0 35.17590631870543 136.9097330040578 0 35.17589439031865 136.90957048871053 0 35.17588785501009 136.90948308959614 0 35.17570540358589 136.90950729629682 0 35.17570565996691 136.9095105747324 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">20.593</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ce712028-ed48-4d35-bba5-b05911b400de">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1821608202167 136.9083083388147 0 35.18231427061907 136.90828858578428 0 35.1822816103167 136.90785323090293 0 35.18212310149476 136.90787363608018 0 35.1821608202167 136.9083083388147 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">17.52</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_2b9b5c5c-5313-4eaa-afac-a257ef639408">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17999423854407 136.90969350548212 0 35.17998361570014 136.9095477171364 0 35.17952547727616 136.90959723753255 0 35.17953614091705 136.90974358606815 0 35.17961005138005 136.90973559872702 0 35.17967321909302 136.90972877166723 0 35.17973612524122 136.90972187624917 0 35.17983584656725 136.90971083330436 0 35.17993940562768 136.90969950266873 0 35.17999423854407 136.90969350548212 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9e6cea7b-85b9-4571-a800-637bc2ea5b67">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17828936747672 136.9111990755379 0 35.1782264521045 136.9112050650283 0 35.17814273197484 136.91121303547317 0 35.17810494561885 136.9112166330043 0 35.17808901669065 136.91121814746563 0 35.178050440824855 136.91122181882668 0 35.17800697740448 136.91122595342594 0 35.17793581726473 136.9112327240344 0 35.17789976763542 136.91123615362176 0 35.17788568269225 136.91123749322728 0 35.17785006026084 136.91124088194888 0 35.17779859542388 136.91124577825946 0 35.177748605953425 136.91125053380688 0 35.177709170291564 136.91125428539954 0 35.177716496450785 136.91136851980434 0 35.17776631179949 136.91136412169882 0 35.17780632936987 136.9113605875423 0 35.177877137245034 136.9113543352782 0 35.17810837140145 136.91133391772883 0 35.17823502977161 136.91132283446925 0 35.178284030440956 136.91131854645027 0 35.17828936747672 136.9111990755379 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">10.493</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3e12d4a1-3549-4654-9f8c-a319b9b8869b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180652388556695 136.91020670504346 0 35.18077442520088 136.91019345624795 0 35.18076499334234 136.91006457200677 0 35.180737653869365 136.90969101962605 0 35.18061737305542 136.90970256165556 0 35.180625170668854 136.90982311632857 0 35.180626945706074 136.90983931548058 0 35.180652388556695 136.91020670504346 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.148</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_976558e5-9e45-483f-91dd-e3c50c0a583c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180784235730556 136.91108619472806 0 35.18072484581353 136.9110934075693 0 35.18072894529974 136.9111539471005 0 35.18073343918723 136.91123139395245 0 35.1807483555515 136.91144058512316 0 35.18075147049018 136.91148657762798 0 35.18076004675228 136.91161322553933 0 35.18077055060134 136.91176834849523 0 35.18077266901154 136.91179962820172 0 35.1807803462576 136.91191301345208 0 35.180790065455334 136.91205655217718 0 35.18079098209255 136.91206836981502 0 35.1808559337818 136.9120436104381 0 35.180833738711556 136.91174717690816 0 35.1808301714819 136.91169953552682 0 35.180824853977626 136.91162851199314 0 35.18081850874083 136.91154377158625 0 35.180808125897805 136.91140513953056 0 35.1808077409674 136.91140000009142 0 35.1807988689675 136.91128155041307 0 35.18079206161983 136.91119067062502 0 35.18078975104568 136.91115981863464 0 35.180784235730556 136.91108619472806 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.32</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_a547901f-fb2e-4905-8ea3-469928713319">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17968706909612 136.91219009809544 0 35.1796834180728 136.91213638709397 0 35.179677855063694 136.9120543715851 0 35.17966863226987 136.91191840907538 0 35.17966550185166 136.91187226459743 0 35.17966318263443 136.9118380785858 0 35.179660091252 136.91179250711866 0 35.1796547668905 136.9117130600993 0 35.179643621856286 136.91154843089038 0 35.17963467751175 136.91141611389455 0 35.179619337020014 136.91118920501415 0 35.17956049605234 136.91120025875134 0 35.179582208109174 136.91152908599858 0 35.17958655656137 136.91159494565392 0 35.179594902315216 136.91172134435558 0 35.17960289890494 136.91184294726241 0 35.1796051487862 136.9118771696974 0 35.17961809000167 136.9120739860523 0 35.17962597756309 136.91219406322855 0 35.179626107321525 136.912196038664 0 35.17968706909612 136.91219009809544 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.13</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d1c2a3d5-679a-47eb-9580-f1add3925652">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17783055739894 136.9097230278715 0 35.17782786158027 136.90972326995183 0 35.177838202384784 136.9098936639616 0 35.17799276825102 136.9098797493169 0 35.17810518571103 136.90986962866515 0 35.17816272359491 136.90986441345441 0 35.17815231963925 136.90969414213512 0 35.17810482224241 136.90969824413537 0 35.17802558886488 136.90970544223111 0 35.177985695937195 136.90970906684606 0 35.177953844134535 136.9097119568965 0 35.17783055739894 136.9097230278715 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.591</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_dd03fb1a-e4b0-4931-b0e2-e10404ba7880">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17647836313041 136.91136865792862 0 35.1763495170622 136.91138023955935 0 35.17633500655837 136.91138154421262 0 35.17627004428192 136.91138725106137 0 35.17613643349998 136.91139898805636 0 35.176041353591415 136.91140793997948 0 35.17604429908867 136.91153096633676 0 35.176106845271576 136.9115242933349 0 35.1761531690309 136.91151931785456 0 35.176212002046576 136.91151301764472 0 35.1763100805011 136.91150251390724 0 35.176331169540795 136.91150025550567 0 35.17636316179273 136.9114968289027 0 35.17640972678738 136.91149339957695 0 35.17647885683641 136.91148830667916 0 35.17647836313041 136.91136865792862 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">10.493</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d3f97f7f-f68b-499d-9447-bcc1cc4c8f90">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.182062760390515 136.91212589197028 0 35.18213439418057 136.91211512778185 0 35.18216308707764 136.9121108154999 0 35.18227578870708 136.91209388022958 0 35.18244081521448 136.91206908160126 0 35.18243586867169 136.91199260510936 0 35.18243465648196 136.9119738619699 0 35.18243010029753 136.9119034297524 0 35.18242637282468 136.91184557781253 0 35.182443352702506 136.911818294892 0 35.182482014205796 136.91181334308848 0 35.182571232720086 136.911801755358 0 35.18261626113084 136.91179595358656 0 35.1826351205221 136.9117935230655 0 35.1828786317022 136.9117621465784 0 35.18291875014199 136.91175697908045 0 35.18292143865692 136.91175663278327 0 35.182917818129184 136.91170679547403 0 35.182915132149226 136.91170716427405 0 35.1826161678744 136.91174821357524 0 35.182385939950976 136.91177982521768 0 35.182389494638166 136.9118275180563 0 35.18240217333203 136.91199761380025 0 35.1823847576989 136.9120320348985 0 35.182057652049146 136.91207545784349 0 35.182062760390515 136.91212589197028 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.321</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4257318e-95d1-4199-ae98-66b6b9f10e53">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17951180327898 136.91055295514022 0 35.17957624789077 136.91054638757058 0 35.17957491152367 136.91052693468407 0 35.17956813125243 136.91042824108627 0 35.17956359335909 136.9103621899648 0 35.17954209072589 136.9100498853785 0 35.179522484706894 136.90976514869078 0 35.17945788025922 136.9097788566309 0 35.179476790139404 136.91005031239723 0 35.179484092101184 136.91015512962534 0 35.17948714619689 136.91019897837816 0 35.17949865210747 136.91036416040905 0 35.17950559400791 136.91046380971693 0 35.17951180327898 136.91055295514022 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.13</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1fa6ffff-c631-4b2e-903f-210345717703">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18022858825084 136.91224341764516 0 35.18022208938606 136.9121570246123 0 35.17970785337522 136.9122144076718 0 35.17971488948303 136.91230255065017 0 35.179817675727065 136.91228839192942 0 35.179964889562555 136.91227377414714 0 35.18005672440702 136.91226316729592 0 35.18022858825084 136.91224341764516 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">8.46</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_07f423de-6d41-4717-b7b8-a828960ec44c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17642487346983 136.9100301559943 0 35.17643434021024 136.91019262969417 0 35.1764599209176 136.91063171712028 0 35.17646171496678 136.910662507597 0 35.17648261544602 136.9110212700009 0 35.17648543920064 136.9110697433521 0 35.17649375016762 136.9112242710139 0 35.176499914958704 136.9113182408189 0 35.176500851818254 136.91133432368184 0 35.176532371675975 136.91133159959423 0 35.17652684777136 136.91123290347758 0 35.17652527218911 136.91120475931945 0 35.176523506397146 136.91117319689357 0 35.17652099875809 136.91112841147435 0 35.17651527235882 136.91102610612126 0 35.17646888837242 136.91019745954034 0 35.17645976866764 136.9100345477162 0 35.17642487346983 136.9100301559943 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">4</uro:widthType>
					<uro:width uom="m">3.644</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_91f485cf-d848-4d1a-a126-e5704db56e68">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17948677348604 136.91056730688462 0 35.17927049783662 136.9105923012808 0 35.17923677404586 136.91059619822542 0 35.179221836901 136.91058202348873 0 35.17921672276564 136.91055206364476 0 35.17921490693768 136.91052377659523 0 35.179206453113224 136.91039205175622 0 35.1792047779697 136.91036594038368 0 35.17919953630926 136.91028427032097 0 35.17919263246434 136.91017669417784 0 35.17918824549305 136.9101083339389 0 35.1791860333769 136.91007387665172 0 35.179178486110985 136.90995627950298 0 35.179176101469885 136.9099191262341 0 35.17916915684478 136.90981092036273 0 35.17913190354274 136.90981446721057 0 35.17914523941684 136.91000962076726 0 35.17914894941667 136.91006391852736 0 35.179157383343295 136.91018735497858 0 35.179159403879936 136.9102169204535 0 35.17916299937509 136.91026954863077 0 35.17916713621866 136.9103300824527 0 35.179169905593994 136.91037061726504 0 35.17917510854731 136.91044722703498 0 35.179186420572435 136.9106138133402 0 35.17918874588053 136.91064773229866 0 35.179260659908486 136.91064026480896 0 35.17943623705249 136.91062203192809 0 35.17949705816329 136.9106198023219 0 35.17948677348604 136.91056730688462 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_47a260fb-f6d4-4edd-b015-b1b81c700ca4">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17640041091176 136.90852962400297 0 35.17636728363107 136.90853371407835 0 35.17636742572704 136.90853542127422 0 35.17638062371216 136.90869398825114 0 35.17638509481594 136.9087477206816 0 35.17640434246583 136.90897898180614 0 35.17640991111243 136.90905165066968 0 35.17641231620769 136.90908303751928 0 35.17641453112977 136.90912122645832 0 35.17641536009596 136.90913547128665 0 35.17641858389544 136.90919028254132 0 35.17642577900319 136.9093165863921 0 35.17642752782248 136.90936921199867 0 35.17642917801345 136.9094416242679 0 35.17642991371104 136.90947394412004 0 35.176431480838126 136.90954505015452 0 35.176438292705136 136.9098542302549 0 35.17647208919083 136.90985061068503 0 35.176472008626 136.9098473190748 0 35.176465871225304 136.90959657611742 0 35.17646515882301 136.909569270287 0 35.17646469372641 136.90955145612395 0 35.17646381041645 136.9095175337878 0 35.176462825763906 136.90947834185053 0 35.176462408953135 136.90946119835348 0 35.17646036279455 136.90937975817073 0 35.176457533968346 136.90932879157975 0 35.176450688864385 136.90919665892173 0 35.176445875274055 136.9091229347443 0 35.176443327782984 136.90908392780617 0 35.176441885979415 136.90906551508283 0 35.17643545165955 136.90898338502487 0 35.176433717266306 136.90896092088028 0 35.1764321015281 136.90893999561766 0 35.17640066415164 136.9085329032121 0 35.17640041091176 136.90852962400297 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">4</uro:widthType>
					<uro:width uom="m">3.64</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1c90db6d-77f5-4007-99e9-e8132d90434c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1791673508657 136.90978295882516 0 35.179183848983776 136.9097824636345 0 35.179243457953056 136.9097761320359 0 35.179267448036065 136.90977356204212 0 35.17928809452507 136.9097713517112 0 35.17931576076229 136.90976838806546 0 35.17936659515662 136.90976294483875 0 35.179418040587706 136.90975743490392 0 35.179431509606474 136.90975599265005 0 35.17942076706462 136.90960855562705 0 35.1791567230274 136.90963709593152 0 35.1791673508657 136.90978295882516 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_db6d0c2d-11bf-4e23-8ed7-feb9355d58b9">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176497645284286 136.9115101504451 0 35.17651413010058 136.91173434914438 0 35.17651547105781 136.91175258109357 0 35.1765283999257 136.91192843108888 0 35.17653145917172 136.91196860473 0 35.176534894213546 136.91201602335053 0 35.17653869384335 136.91206750307325 0 35.17655820489066 136.91233191575347 0 35.17656248964409 136.9123899704262 0 35.17657748429614 136.9125931794021 0 35.176587529718 136.91272931983283 0 35.17658972953772 136.9127591320109 0 35.17662034465111 136.91275581050286 0 35.17661712246573 136.91271175468952 0 35.17660683315444 136.91257108831968 0 35.17660336033333 136.91252360497467 0 35.176600177071144 136.9124800896487 0 35.176597236933766 136.91243989142944 0 35.17659393112088 136.91239469450576 0 35.17658492035647 136.9122715138115 0 35.17657515547433 136.91213785382678 0 35.17655585080229 136.91187361615974 0 35.17653879458157 136.91164016772817 0 35.176529044785674 136.9115067252339 0 35.176497645284286 136.9115101504451 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">4</uro:widthType>
					<uro:width uom="m">3.428</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_066f121f-99f1-47fc-a490-26ac8f75d941">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180327781892885 136.90965534491298 0 35.18031731219829 136.9095116473622 0 35.18004772432572 136.90954078755902 0 35.18005803703956 136.90968232520015 0 35.180093449951414 136.90967878264752 0 35.18015026941275 136.90967309978348 0 35.18020666618515 136.90966745886595 0 35.18032508678461 136.90965561447723 0 35.180327781892885 136.90965534491298 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_65750382-72b4-4f5d-b18f-73d74bf2c9c4">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17778901658762 136.90972668594048 0 35.17782786158027 136.90972326995183 0 35.17782764994474 136.9097199863429 0 35.17780482644409 136.90936587891264 0 35.17780356149123 136.90934625212037 0 35.17779430406304 136.9092026329804 0 35.17782678039438 136.90917167906784 0 35.17814340085438 136.90914117808407 0 35.17814609661368 136.90914091839252 0 35.1781436646327 136.9090994245804 0 35.17814096944731 136.9090996940237 0 35.17775243094586 136.90913853683338 0 35.177767106142234 136.90937466034416 0 35.1777888121732 136.90972340162614 0 35.17778901658762 136.90972668594048 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_96a092d8-f4b6-4caf-b7a9-e62d90f59166">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18077166813922 136.91209569686248 0 35.180308798801306 136.91214734872514 0 35.18031445191834 136.91222250858186 0 35.18035401812006 136.91221909141944 0 35.18037147117465 136.912217471347 0 35.18039809012664 136.91221500143934 0 35.18066459592433 136.91219067459056 0 35.18067820509745 136.9121894244203 0 35.18074796323285 136.91218294863376 0 35.18076202335526 136.91218180685107 0 35.18077166813922 136.91209569686248 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">8.46</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_cdd349d8-d2a4-4958-9655-35ff56834644">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17731338948683 136.91129193819134 0 35.17731976387719 136.9114079675331 0 35.177395759516514 136.9114004057911 0 35.17748404647432 136.9113916220577 0 35.17751763445207 136.91138828040118 0 35.177631394442066 136.91138164796658 0 35.17762374761058 136.91126241190176 0 35.177539214543046 136.9112704538928 0 35.17749373319051 136.91127478139546 0 35.17731338948683 136.91129193819134 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">10.493</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_63e82855-3075-43ee-bf8b-3470bad24f34">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18318639160619 136.91155146941463 0 35.18290870698067 136.9115814046485 0 35.182917579723096 136.91170351442258 0 35.182917818129184 136.91170679547403 0 35.18319488112032 136.9116795501549 0 35.18318660897373 136.9115547487985 0 35.18318639160619 136.91155146941463 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">31.565</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_34f2abda-c05c-4de1-a5fc-9d3251d3a807">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175220702568005 136.90865213970594 0 35.17522058416575 136.90864885088052 0 35.1751787649095 136.90865249623704 0 35.17517888743605 136.90865578489763 0 35.17519419384243 136.90906663378817 0 35.175196266495185 136.9091222778508 0 35.17519836587961 136.9091786354562 0 35.17520364484352 136.90932036322886 0 35.175205364581764 136.90936651392178 0 35.17520577278799 136.9093774782942 0 35.17520994852231 136.90948957445408 0 35.17525076276303 136.90948731926434 0 35.17524368041434 136.90929053161975 0 35.175240579326015 136.90920436629946 0 35.17523854063273 136.90914771753367 0 35.17523406080752 136.90902325250968 0 35.175230867573966 136.908934541509 0 35.175221236653506 136.90866697487564 0 35.175220702568005 136.90865213970594 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.471</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_18cb45a3-2f55-467d-82b9-d1f944d3dbac">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176908605150096 136.90481522830984 0 35.17671241458213 136.90484012110235 0 35.17670549897499 136.90484092356257 0 35.176719011016964 136.9050034753667 0 35.176721330784254 136.9050032409834 0 35.17692078269219 136.90498580389064 0 35.176908605150096 136.90481522830984 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">15.39</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_9385bd3c-6443-458f-9655-d9cccbecd401">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.179533212185625 136.9111716878434 0 35.179533322562 136.91109581973623 0 35.179339142192745 136.91111402530586 0 35.17930389730025 136.91111732952078 0 35.17917714240511 136.91112921395273 0 35.179103536834695 136.91113606376794 0 35.17910250253905 136.9112145375721 0 35.17912763851689 136.9112120281008 0 35.17914850615509 136.91120994480625 0 35.17925390421783 136.91119942179466 0 35.17933959004779 136.91119086645577 0 35.17938732865112 136.91118613648084 0 35.179441392269 136.91118078174378 0 35.179533212185625 136.9111716878434 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">6.719</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_0f9d6378-3da0-46f2-9067-24b282e98585">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18004920193922 136.90971032585173 0 35.18001456491575 136.909714192725 0 35.18001920680802 136.90977258346322 0 35.18002625755929 136.9098612678038 0 35.18002956204204 136.90990283890432 0 35.18006058617904 136.9102931037965 0 35.1800631866696 136.91032581669697 0 35.18007849479901 136.91032444999883 0 35.180106947100676 136.91032191004638 0 35.18036923387032 136.91029849309757 0 35.18036664492806 136.9102554766302 0 35.18036394840079 136.9102557267607 0 35.18011185592023 136.9102791108434 0 35.18009007688506 136.91025348722647 0 35.180075522740296 136.91006007874293 0 35.180068681987926 136.9099691813043 0 35.180061387573545 136.9098722520803 0 35.180057538125574 136.90982110088194 0 35.18004920193922 136.90971032585173 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">4</uro:widthType>
					<uro:width uom="m">3.844</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6ba03ec4-824f-4b57-83b0-3e3b1cacc1ed">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.178592921704734 136.91127353704624 0 35.178700934198076 136.91125670938436 0 35.17873163521403 136.9112531175384 0 35.17876436848619 136.91124928876692 0 35.178945073332926 136.91122814931433 0 35.17898893849055 136.91122301758236 0 35.17897358605497 136.91114825238722 0 35.178881139644105 136.91115692660193 0 35.17878362631478 136.91116607558695 0 35.17872103161834 136.91117194885533 0 35.178621115512236 136.91118132380933 0 35.178585731824434 136.91118464376945 0 35.178592921704734 136.91127353704624 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">6.719</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_bbb647fa-bfa7-40fb-b087-a498e39502fb">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18055311454133 136.90948872797549 0 35.180493971071186 136.90949435024177 0 35.18037623203518 136.9095055414255 0 35.18035619247607 136.90950744471246 0 35.18034604987273 136.90950854104784 0 35.1803565316968 136.90965239973607 0 35.180359222911335 136.90965213131642 0 35.18039823717618 136.90964824006153 0 35.180439002649045 136.90964417447194 0 35.18046829426972 136.9096412528341 0 35.180562287739356 136.90963187904327 0 35.18055311454133 136.90948872797549 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_dc43cafb-18a7-413d-9b1a-f08e95cdeaf0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17954676674932 136.9110591064003 0 35.179612421082574 136.91107295453017 0 35.17960446012828 136.91095706856217 0 35.17958975251799 136.9107429708576 0 35.17958192598434 136.91062904150343 0 35.17951522370346 136.91063583897937 0 35.179521652098934 136.91072209286008 0 35.179531901820056 136.91085964048975 0 35.17953800906526 136.91094158818703 0 35.179540612263644 136.91097652092898 0 35.17954676674932 136.9110591064003 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.13</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_bf5bcd39-1086-4926-8fdb-be0234eb50fc">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.182518986109 136.90876352143076 0 35.182426131180804 136.90883491619957 0 35.18247776376474 136.90896157693845 0 35.18247982882574 136.90896664278353 0 35.182502793474036 136.90902297790362 0 35.182593948314526 136.90890476689438 0 35.182578840299314 136.90887901200747 0 35.182518986109 136.90876352143076 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">11.24</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_6a62e01c-2d9d-41c7-8d60-800a6c7c98a3">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18248817577823 136.9087034996938 0 35.18248308240136 136.90869350893468 0 35.182462402674005 136.9086529452713 0 35.18242821589812 136.90858588765627 0 35.18242088337338 136.9085714174956 0 35.18238361951462 136.90849845672727 0 35.182308888397905 136.9085550822747 0 35.18232792171076 136.90859413898693 0 35.18237370686702 136.9086880911603 0 35.18241002169218 136.9087626101819 0 35.18248817577823 136.9087034996938 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">11.24</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1ed2d696-dd4e-49f6-87c9-58cfc249fe50">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175268263120685 136.90951364304067 0 35.1752722423912 136.9095609163436 0 35.1753358993229 136.9095529681618 0 35.175350778482034 136.90955123057114 0 35.17542530786113 136.9095417736669 0 35.17549091579527 136.90953366230138 0 35.17557553941622 136.90952329526766 0 35.175596002145326 136.9095207199611 0 35.1757027129573 136.90950762644005 0 35.17570540358589 136.90950729629682 0 35.175702418050065 136.90945976706158 0 35.17569975766607 136.9094601293706 0 35.175358246939915 136.90950663839953 0 35.175268263120685 136.90951364304067 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.033</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d70ef89a-9abc-4bd4-afb5-bc9e7c6f2c54">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1822806083025 136.90856692005306 0 35.18219533545175 136.9085801949379 0 35.1821993792592 136.90861873423674 0 35.18220078930701 136.90863217265297 0 35.18221855992173 136.90868020790592 0 35.18223040097391 136.90877953747537 0 35.18223216599231 136.90879618761926 0 35.182313881816846 136.90878333629723 0 35.182308517832155 136.90874844790338 0 35.18229593080054 136.90866657969013 0 35.1822806083025 136.90856692005306 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.06</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">7</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_8d21bfbe-38aa-4d4b-9d42-4ad9d473a0e0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180327781892885 136.90965534491298 0 35.18032797416646 136.90965863014685 0 35.18033541899816 136.90978583556097 0 35.18033882267288 136.90984398997603 0 35.18034170253591 136.90989319333949 0 35.18035639713315 136.91010596986513 0 35.18036641996578 136.91025219458916 0 35.18036664492806 136.9102554766302 0 35.18039359374492 136.91025299626355 0 35.180393368065175 136.91024971430332 0 35.180383381407026 136.91010448408346 0 35.180374116937294 136.90995329324977 0 35.18036448724898 136.90978852631696 0 35.180356723689975 136.90965568487903 0 35.1803565316968 136.90965239973607 0 35.180327781892885 136.90965534491298 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">4</uro:widthType>
					<uro:width uom="m">3.077</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b2f1f1e7-9abc-4676-ad6a-349bc25f39bd">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.174883863464586 136.90960935121313 0 35.174959204382006 136.90960000165208 0 35.175102651090356 136.9095820915758 0 35.17516867702112 136.90957384831236 0 35.175198933380585 136.90957007032094 0 35.175195225823586 136.90952602986715 0 35.175097143367786 136.90953924541105 0 35.17499110703389 136.9095535322452 0 35.17497411606025 136.90955582212277 0 35.174963892095654 136.9095571992155 0 35.17493809110165 136.9095606674069 0 35.17488629895147 136.90956762414353 0 35.174883863464586 136.90960935121313 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.033</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_5ab71038-0080-4300-baf1-43f7951e087d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.183143007139584 136.91081309684364 0 35.18325764445169 136.91080065966133 0 35.18328711472481 136.91079738311967 0 35.18327293852041 136.91070091406797 0 35.18320463068037 136.91071324896103 0 35.183137711935046 136.91071959872656 0 35.183143007139584 136.91081309684364 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.798</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_882d3e79-289c-4ea6-b9a2-57c3843d8ea7">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17814384636327 136.90909940476826 0 35.178146824531154 136.9091408390359 0 35.178400210133866 136.90911321516833 0 35.17839716559694 136.90907178800785 0 35.17814384636327 136.90909940476826 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">35.463</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_09c30f2a-ac4c-4abe-bc5d-f6ef0a73122d">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.180396187374356 136.91029608668123 0 35.18040973080077 136.91029487751973 0 35.18063675704816 136.910274607848 0 35.1806354020622 136.91023069384883 0 35.18054915705957 136.91023865041643 0 35.18052310232579 136.91024105991164 0 35.180400081082446 136.9102524038562 0 35.18039629048369 136.91025275000416 0 35.18039359374492 136.91025299626355 0 35.180396187374356 136.91029608668123 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">4</uro:widthType>
					<uro:width uom="m">3.844</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_7d4b17ee-1ca0-4d78-92e7-11fe878d7647">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17963509132575 136.91233281187726 0 35.179635459246086 136.91233841317725 0 35.17964542124853 136.9124900761617 0 35.17970917529163 136.91248355290904 0 35.17969835351731 136.9123266471351 0 35.17963509132575 136.91233281187726 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">7.13</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_84246edc-e35b-4459-ad7e-95044e4db00c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.179100770722144 136.90964314374585 0 35.17911108096516 136.90978464776333 0 35.1791673508657 136.90978295882516 0 35.1791567230274 136.90963709593152 0 35.179100770722144 136.90964314374585 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">14.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_1f38dbe2-067c-4a23-8ee1-95e4ab40bd4b">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176908605150096 136.90481522830984 0 35.176874815658934 136.9047803134739 0 35.17673781229933 136.90478777944693 0 35.17670519690903 136.90483728969636 0 35.176908605150096 136.90481522830984 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">12.36</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_0450c85c-4ad8-41a0-b1a9-fc288f4cccd9">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.176756937790174 136.9050449570284 0 35.17689212501144 136.90503134903096 0 35.17692078269219 136.90498580389064 0 35.17671935710761 136.90500763892203 0 35.17673633616871 136.9050244988207 0 35.176756937790174 136.9050449570284 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">11.714</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_eabb7baf-f2fa-467e-8047-373ce9f787f9">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.175268263120685 136.90951364304067 0 35.17526425083466 136.90951395537004 0 35.175195225823586 136.90952602986715 0 35.175198933380585 136.90957007032094 0 35.175199732566234 136.90956997052976 0 35.17524637175741 136.90956414653803 0 35.1752722423912 136.9095609163436 0 35.175268263120685 136.90951364304067 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.033</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_b998fa57-16b1-40d5-8dce-195309a8ab94">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18077166813922 136.91209569686248 0 35.18076202335526 136.91218180685107 0 35.180801091365716 136.9121987034365 0 35.1807885597831 136.91206929319085 0 35.18077166813922 136.91209569686248 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">8.46</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_d0d17801-91d9-4c0d-a280-304c181af00c">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17526804886345 136.90951109769432 0 35.17525076276303 136.90948731926434 0 35.17520994852231 136.90948957445408 0 35.17521040909015 136.90950193841138 0 35.175195225823586 136.90952602986715 0 35.17526804886345 136.90951109769432 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.471</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_4611564b-051b-412c-95d4-4b6d208e2ae3">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17911138642059 136.90978884005372 0 35.17913190354274 136.90981446721057 0 35.17916915684478 136.90981092036273 0 35.17916765728347 136.90978755553797 0 35.179167446540696 136.90978427193778 0 35.17911138642059 136.90978884005372 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">3</uro:widthType>
					<uro:width uom="m">4.102</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ab775bbf-35d9-4edc-be0f-76e04aca25b0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17865232066924 136.90831195356444 0 35.17866622177794 136.90831171334128 0 35.1787177135991 136.90831361232864 0 35.17885527411754 136.90829975155557 0 35.1789269112537 136.90828678884856 0 35.17898970891044 136.90827132884334 0 35.17903402287433 136.9082539510294 0 35.179077247848205 136.90823317304367 0 35.17912919895904 136.90820402310032 0 35.179192387807184 136.9081606741568 0 35.179254470422414 136.90810585519966 0 35.179323384715445 136.90804201142356 0 35.179384302791895 136.90799065448658 0 35.1794344959199 136.90796145495136 0 35.17950236190899 136.9079343952594 0 35.179572285092334 136.907920888586 0 35.18019683380147 136.90784984827724 0 35.180348329789965 136.90783267916387 0 35.18052226640362 136.9078130233386 0 35.18086761581503 136.90777382922846 0 35.181195539022326 136.90773657195416 0 35.18197982106321 136.90764746324828 0 35.18196859604128 136.9075008950983 0 35.18087820160109 136.90762337520363 0 35.180851254961844 136.9076264251897 0 35.18078708764391 136.90763365571036 0 35.18076014076914 136.90763659589453 0 35.17994110568511 136.9077286770118 0 35.1798384558844 136.90774020159972 0 35.17978014648437 136.9077467545929 0 35.17971291496325 136.90775432401867 0 35.17959575529556 136.907767431669 0 35.179579625194194 136.9077701178767 0 35.17951366248732 136.90778086726996 0 35.17943571488163 136.90779363093682 0 35.179378522161336 136.9078165396141 0 35.17931649522118 136.90785516410455 0 35.17924620529887 136.90790797811908 0 35.17917980935635 136.9079691240234 0 35.179114229833374 136.90803268270082 0 35.179061483409775 136.90806930122542 0 35.17899286721706 136.90810388388192 0 35.17893629536169 136.90812206913608 0 35.17884239601172 136.908136639583 0 35.17872355814812 136.90814737812445 0 35.17867115470166 136.90815211362465 0 35.17865739890545 136.90816912019022 0 35.178647870100974 136.90817066448048 0 35.17865232066924 136.90831195356444 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.698</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_f3c08aa9-4f2b-4927-89f8-e946e363325f">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17883676854045 136.9059909526887 0 35.17892753935538 136.90597157491794 0 35.17909792416335 136.90593523821119 0 35.17917559597465 136.90592082249296 0 35.17910166777126 136.9053299343638 0 35.17899248341812 136.9053626728839 0 35.17873564768238 136.90543958141745 0 35.17883676854045 136.9059909526887 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">51.346</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_8e625274-a80c-4312-b62a-2271d53fe132">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17883676854045 136.9059909526887 0 35.17873564768238 136.90543958141745 0 35.17866772285391 136.90546000063625 0 35.17863038119821 136.90547117294736 0 35.17844353350184 136.90552258599462 0 35.17844260509597 136.90607512059418 0 35.17864329785954 136.90603229763508 0 35.1786902081924 136.9060222884838 0 35.17873435855465 136.90601281513815 0 35.17883676854045 136.9059909526887 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">51.346</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_42b85f06-cb58-4798-ae44-2413cfb9c996">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1830095601281 136.90839719973852 0 35.18300773602598 136.90832427164267 0 35.1829941797233 136.90822351924095 0 35.18296720364206 136.90812829931076 0 35.182957569875946 136.90810125344728 0 35.18293156665558 136.90802981292015 0 35.18289425532354 136.90794933890348 0 35.18268996375251 136.90762592597932 0 35.18258610959095 136.90772325264018 0 35.182607794240475 136.9077580316395 0 35.18279329062522 136.90805554527412 0 35.1828039235035 136.9080725995396 0 35.182823945650014 136.90811660267792 0 35.18283435477149 136.9081394802854 0 35.18285475685365 136.90819552276966 0 35.182863725778155 136.90823714099275 0 35.182868140584084 136.90825762642226 0 35.18287801172227 136.90832116859337 0 35.182881202358054 136.90838012037182 0 35.18288097664245 136.90839679141519 0 35.1830095601281 136.90839719973852 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.28</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_ac2b21c8-bdc7-44e6-8607-c83bfb2b24f1">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17853419598735 136.90112502676146 0 35.17850632697596 136.90087471338882 0 35.178497811854335 136.9008857475026 0 35.17848194209014 136.90090019627766 0 35.178467735654145 136.90091102306215 0 35.17844583860289 136.9009249556548 0 35.17841585084897 136.9009387773294 0 35.17836158844254 136.90095521419647 0 35.17834168452136 136.90095930396112 0 35.17832681428902 136.9009617622961 0 35.17828268664146 136.90096908082748 0 35.17823117612748 136.90097761352325 0 35.17819654352079 136.90098334977668 0 35.1781360146299 136.90099337532783 0 35.178085970226476 136.90100166387526 0 35.178085250131424 136.9012488633096 0 35.17815433745832 136.90123559541587 0 35.17822319230828 136.90122237217201 0 35.17830303743961 136.9012070380977 0 35.17833051996963 136.90120178850174 0 35.17835285732814 136.9011933716466 0 35.17853419598735 136.90112502676146 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">17.787</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_969c7090-00dd-4687-b281-d7c5422c7b99">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_function.xml">3</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">1</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.1830095601281 136.90839719973852 0 35.18288097664245 136.90839679141519 0 35.18288018991828 136.90845489645503 0 35.182878918810204 136.90855044176857 0 35.18287801432233 136.90861839352075 0 35.18287766862077 136.90864441689266 0 35.18287707846182 136.90868898602815 0 35.182875972001504 136.90875949123406 0 35.18287559725971 136.908765962852 0 35.182875210271256 136.90878277095288 0 35.18300382705403 136.90873185721642 0 35.1830048157204 136.90868519728124 0 35.18300568072367 136.9086443922088 0 35.18300604439425 136.90862722621 0 35.18300669393596 136.9085965760124 0 35.183010298223 136.90842670583743 0 35.1830095601281 136.90839719973852 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.28</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_af69f624-5b6e-4449-936c-65c66e0b8473">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17865232066924 136.90831195356444 0 35.178647870100974 136.90817066448048 0 35.17857891299123 136.90818184003643 0 35.178367785597416 136.90819948233045 0 35.178342774085294 136.90820157180468 0 35.17834981967907 136.90833505725072 0 35.17837056846495 136.90833306145225 0 35.17844775048771 136.9083256379181 0 35.178518085646274 136.90831887392915 0 35.1785763916969 136.90831326568073 0 35.17865232066924 136.90831195356444 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">2</uro:widthType>
					<uro:width uom="m">13.698</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_62efa72f-0747-462a-9079-fda0ff1202f0">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.17853419598735 136.90112502676146 0 35.17860703475608 136.90109757440356 0 35.17871327377034 136.90107878363656 0 35.178519758769504 136.90085725014313 0 35.17851160888291 136.90086786895603 0 35.17850632697596 136.90087471338882 0 35.17853419598735 136.90112502676146 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">1</uro:widthType>
					<uro:width uom="m">17.787</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_3643a945-5934-49af-ba9f-be2c56b74356">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18282140864365 136.90031948061517 0 35.18284540206876 136.90066885900646 0 35.18291443619966 136.90066138736506 0 35.182891590551534 136.9003101120801 0 35.18282140864365 136.90031948061517 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
	<core:cityObjectMember>
		<tran:Road gml:id="tran_c9d298c0-6dc6-459e-978d-c7e889886a88">
			<core:creationDate>2021-03-26</core:creationDate>
			<tran:function codeSpace="../../codelists/Road_usage.xml">9</tran:function>
			<tran:usage codeSpace="../../codelists/Road_usage.xml">9</tran:usage>
			<tran:lod1MultiSurface>
				<gml:MultiSurface>
					<gml:surfaceMember>
						<gml:Polygon>
							<gml:exterior>
								<gml:LinearRing>
									<gml:posList>35.18282140864365 136.90031948061517 0 35.182891590551534 136.9003101120801 0 35.18289040411248 136.90029186979507 0 35.182819979101254 136.9002986649144 0 35.182820204530444 136.90030194740652 0 35.18282140864365 136.90031948061517 0</gml:posList>
								</gml:LinearRing>
							</gml:exterior>
						</gml:Polygon>
					</gml:surfaceMember>
				</gml:MultiSurface>
			</tran:lod1MultiSurface>
			<uro:tranDataQualityAttribute>
				<uro:DataQualityAttribute>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>
					<uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">201</uro:geometrySrcDescLod1>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">100</uro:thematicSrcDesc>
					<uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">201</uro:thematicSrcDesc>
				</uro:DataQualityAttribute>
			</uro:tranDataQualityAttribute>
			<uro:roadStructureAttribute>
				<uro:RoadStructureAttribute>
					<uro:widthType codeSpace="../../codelists/RoadStructureAttribute_widthType.xml">9</uro:widthType>
					<uro:width uom="m">-9999</uro:width>
					<uro:sectionType codeSpace="../../codelists/RoadStructureAttribute_sectionType.xml">1</uro:sectionType>
				</uro:RoadStructureAttribute>
			</uro:roadStructureAttribute>
		</tran:Road>
	</core:cityObjectMember>
</core:CityModel>
