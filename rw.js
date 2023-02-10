// core
var rwID_STRUCT        = 0x01;
var rwID_STRING        = 0x02;
var rwID_EXTENSION     = 0x03;
var rwID_CAMERA        = 0x05;
var rwID_TEXTURE       = 0x06;
var rwID_MATERIAL      = 0x07;
var rwID_MATLIST       = 0x08;
var rwID_FRAMELIST     = 0x0E;
var rwID_GEOMETRY      = 0x0F;
var rwID_CLUMP         = 0x10;
var rwID_LIGHT         = 0x12;
var rwID_ATOMIC        = 0x14;
var rwID_GEOMETRYLIST  = 0x1A;
// tk
var rwID_HANIMPLUGIN   = 0x11E;
var rwID_MATERIALEFFECTSPLUGIN = 0x120;
// world
var rwID_BINMESHPLUGIN = 0x50E;
// R*
var rwID_NODENAME      = 0x0253F2FE;
var rwID_ENVMAT        = 0x0253F2FC;
var rwID_SPECMAT       = 0x0253F2F6;


var frameTKList = {};
var textureTKList = {};
var materialTKList = {};
var geometryTKList = {};
var atomicTKList = {};
var clumpTKList = {};

/* RwFrame */

function
rwSetHierarchyRoot(frame, root)
{
	frame.root = root;
	for(frame = frame.child; frame != null; frame = frame.next)
		rwSetHierarchyRoot(frame, root);
}

function
RwFrameRemoveChild(c)
{
	let f = c.parent.child;
	// remove as child
	if(f == c)
		c.parent.child = c.next;
	else{
		while(f.next != c)
			f = f.next;
		f.next = c.next;
	}
	// now make this the root of a new hierarchy
	c.parent = null;
	c.next = null;
	rwSetHierarchyRoot(c, c);
}

function
RwFrameAddChild(p, child)
{
	if(child.parent != null)
		RwFrameRemoveChild(child);
	// append as child of p
	if(p.child == null)
		p.child = child;
	else{
		let c;
		for(c = p.child; c.next != null; c = c.next);
		c.next = child;
	}
	child.next = null;

	child.parent = p;
	rwSetHierarchyRoot(child, p.root);
}

function
rwFrameSynchLTM(f)
{
	if(f.parent == null)
		mat4.copy(f.ltm, f.matrix);
	else
		mat4.multiply(f.ltm, f.matrix, f.parent.ltm);
	for(let c = f.child; c != null; c = c.next)
		rwFrameSynchLTM(c);
}

function
RwFrameLookAt(frm, pos, target, up)
{
	let at = vec3.create();
	vec3.subtract(at, target, pos);
	vec3.normalize(at, at);
	let left = vec3.create();
	vec3.cross(left, up, at);
	vec3.normalize(left, left);
	vec3.cross(up, at, left);
	m = frm.matrix;
	m[0] = left[0];
	m[1] = left[1];
	m[2] = left[2];
	m[4] = up[0];
	m[5] = up[1];
	m[6] = up[2];
	m[8] = at[0];
	m[9] = at[1];
	m[10] = at[2];
	m[12] = pos[0];
	m[13] = pos[1];
	m[14] = pos[2];
}

function
RwFrameCreate()
{
	let f = {
		parent: null,
		root: null,
		child: null,
		next: null,
		matrix: mat4.create(),
		ltm: mat4.create(),
		objects: [],
		name: ""
	};
	f.root = f;
	mat4.copy(f.ltm, f.matrix);
	return f;
}

/* RwCamera */

function
RwCameraCreate()
{
	cam = {
		type: rwID_CAMERA,
		frame: null,
		viewWindow: [ 1.0, 1.0 ],
		viewOffset: [ 0.0, 0.0 ],
		nearPlane: [ 0.5 ],
		farPlane: [ 10.0 ],
		fogPlane: [ 5.0 ],
		projmat: mat4.create()
	};
	return cam;
}

function
RwCameraSetFrame(c, f)
{
	c.frame = f;
	f.objects.push(c);
}

function
RwCameraBeginUpdate(cam)
{
	mat4.invert(state.viewMatrix, camera.frame.ltm);
	state.viewMatrix[0] = -state.viewMatrix[0];
	state.viewMatrix[4] = -state.viewMatrix[4];
	state.viewMatrix[8] = -state.viewMatrix[8];
	state.viewMatrix[12] = -state.viewMatrix[12];

	p = cam.projmat;
	let xscl = 1.0/cam.viewWindow[0];
	let yscl = 1.0/cam.viewWindow[1];
	let zscl = 1.0/(cam.farPlane-cam.nearPlane);

	p[0] = xscl;
	p[1] = 0;
	p[2] = 0;
	p[3] = 0;

	p[4] = 0;
	p[5] = yscl;
	p[6] = 0;
	p[7] = 0;

	p[8] = cam.viewOffset[0]*xscl;
	p[9] = cam.viewOffset[1]*yscl;
	p[12] = -p[8];
	p[13] = -p[9];

	p[10] = (cam.farPlane+cam.nearPlane)*zscl;
	p[11] = 1.0;
	p[14] = -2.0*cam.nearPlane*cam.farPlane*zscl;
	p[15] = 0.0;

	mat4.copy(state.projectionMatrix, p);
}

/* RwTexture */

function
RwTextureRead(name, mask)
{
	return {
		name: name,
		mask: mask,
		tex: loadTexture(TexturesDirPath + "/" + name + ".png")
	};
}

/* RpMaterial */

function
RpMaterialCreate()
{
	let mat = {
		color: [ 255, 255, 255, 255 ],
		surfaceProperties: [ 1.0, 1.0, 1.0 ]
	};
	return mat;
}

/* RpGeometry */

function
RpGeometryCreate(flags, numMorphTargets)
{
	let geo = {
		numVertices: 0,		// used for instancing
		triangles: [],
		morphTargets: [],
		materials: [],
		meshtype: 0,
		meshes: [],
		totalMeshIndices: 0	// used for instancing
	};

	let numTexCoords = (flags >> 16) & 0xFF;
	if(numTexCoords == 0){
		if(flags & 0x04) numTexCoords = 1;
		if(flags & 0x80) numTexCoords = 2;
	}
	geo.texCoords = [];
	if(numTexCoords > 0)
		while(numTexCoords--)
			geo.texCoords.push([]);

	if(flags & 0x08)
		geo.prelit = [];

	while(numMorphTargets--){
		let mt = { vertices: [] };
		if(flags & 0x10)
			mt.normals = [];
		geo.morphTargets.push(mt);
	}

	return geo;
}

/* RpAtomic */

function
RpAtomicCreate()
{
	return {
		type: rwID_ATOMIC,
		frame: null,
		geometry: null,
		visible: true,
		pipeline: defaultPipe
	};
}

function
RpAtomicClone(a)
{
	let a2 = RpAtomicCreate();
	a2.type = a.type;
	a2.visible = a.visible;
	a2.frame = RwFrameClone(a.frame);
	a2.geometry = a.geometry;
	a2.pipeline = a.pipeline;
	a2.frame.objects = [];
	a2.frame.objects[0] = a2;
	return a2;
}

function
RpAtomicSetFrame(a, f)
{
	a.frame = f;
	f.objects.push(a);
}

function
RpAtomicRender(atomic)
{
	if(atomic.geometry.instData === undefined)
		instanceGeo(atomic.geometry);
	atomic.pipeline.renderCB(atomic);
}

/* RpClump */

function
RpClumpCreate()
{
	return {
		type: rwID_CLUMP,
		frame: null,
		atomics: []
	};
}

function RpClumpSetFrame(c, f) { c.frame = f; }

function
RpClumpRender(clump)
{
	for(let i = 0; i < clump.atomics.length; i++)
		RpAtomicRender(clump.atomics[i]);
}


/* Instancing */

function
instanceGeo(geo)
{
	let header = {
		prim: gl.TRIANGLES,
		totalNumVertices: geo.numVertices,
		totalNumIndices: geo.totalMeshIndices,
		vbo: gl.createBuffer(),
		ibo: gl.createBuffer(),
		inst: [],
		attribs: []
	};
	if(geo.meshtype == 1)
		header.prim = gl.TRIANGLE_STRIP;

	// instance indices
	let buffer = new ArrayBuffer(header.totalNumIndices*2);
	offset = 0;
	for(let i = 0; i < geo.meshes.length; i++){
		m = geo.meshes[i];
		inst = {
			material: m.material,
			numIndices: m.indices.length,
			offset: offset
		};
		let indices = new Uint16Array(buffer, inst.offset, inst.numIndices);
		indices.set(m.indices);
		offset += inst.numIndices*2;
		header.inst.push(inst);
	}
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, header.ibo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
	geo.instData = header;

	instanceVertices(geo);
}

function
instanceVertices(geo)
{
	let i;
	let stride = 0;
	let attribs = [];

	attribs.push({
		index: ATTRIB_POS,
		size: 3,
		type: gl.FLOAT,
		normalized: false,
		offset: stride
	});
	stride += 12;

	if(geo.morphTargets[0].normals){
		attribs.push({
			index: ATTRIB_NORMAL,
			size: 3,
			type: gl.FLOAT,
			normalized: false,
			offset: stride
		});
		stride += 12;
	}

	if(geo.prelit){
		attribs.push({
			index: ATTRIB_COLOR,
			size: 4,
			type: gl.UNSIGNED_BYTE,
			normalized: true,
			offset: stride
		});
		stride += 4;
	}

	for(i = 0; i < geo.texCoords.length; i++){
		attribs.push({
			index: ATTRIB_TEXCOORDS0 + i,
			size: 2,
			type: gl.FLOAT,
			normalized: false,
			offset: stride
		});
		stride += 8;
	}

	for(i = 0; i < attribs.length; i++)
		attribs[i].stride = stride;

	header = geo.instData;
	header.attribs = attribs;
	let buffer = new ArrayBuffer(header.totalNumVertices*stride);

	// instance verts
	for(i = 0; attribs[i].index != ATTRIB_POS; i++);
	let a = attribs[i];
	instV3d(buffer, a.offset, a.stride, geo.morphTargets[0].vertices, header.totalNumVertices);

	if(geo.morphTargets[0].normals){
		for(i = 0; attribs[i].index != ATTRIB_NORMAL; i++);
		let a = attribs[i];
		instV3d(buffer, a.offset, a.stride, geo.morphTargets[0].normals, header.totalNumVertices);
	}

	if(geo.prelit){
		for(i = 0; attribs[i].index != ATTRIB_COLOR; i++);
		let a = attribs[i];
		instRGBA(buffer, a.offset, a.stride, geo.prelit, header.totalNumVertices);
	}

	for(i = 0; i < geo.texCoords.length; i++){
		for(j = 0; attribs[j].index != ATTRIB_TEXCOORDS0 + i; j++);
		let a = attribs[j];
		instV2d(buffer, a.offset, a.stride, geo.texCoords[i], header.totalNumVertices);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, header.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
}

function
instV3d(buffer, offset, stride, src, n)
{
	let view = new DataView(buffer);
	let o = offset;
	for(let i = 0; i < n; i++){
		view.setFloat32(o+0, src[i][0], true);
		view.setFloat32(o+4, src[i][1], true);
		view.setFloat32(o+8, src[i][2], true);
		o += stride;
	}
}

function
instV2d(buffer, offset, stride, src, n)
{
	let view = new DataView(buffer);
	let o = offset;
	for(let i = 0; i < n; i++){
		view.setFloat32(o+0, src[i][0], true);
		view.setFloat32(o+4, src[i][1], true);
		o += stride;
	}
}

function
instRGBA(buffer, offset, stride, src, n)
{
	let view = new DataView(buffer);
	let o = offset;
	for(let i = 0; i < n; i++){
		view.setUint8(o+0, src[i][0]);
		view.setUint8(o+1, src[i][1]);
		view.setUint8(o+2, src[i][2]);
		view.setUint8(o+3, src[i][3]);
		o += stride;
	}
}

/* The Init functions are for when we
 * read a json structure produced by convdff */

function
rwFrameInit(f)
{
	f.parent = null;
	f.root = f;
	f.child = null;
	f.next = null;
	f.objects = [];
	m = f.matrix;
	f.matrix = mat4.fromValues(
		m[0], m[1], m[2], 0,
		m[3], m[4], m[5], 0,
		m[6], m[7], m[8], 0,
		m[9], m[10], m[11], 1);
	f.ltm = mat4.create();
	mat4.copy(f.ltm, f.matrix);
}

function
RwFrameClone(f) {
	let f2 = RwFrameCreate();
	mat4.copy(f2.matrix, f.matrix);
	mat4.copy(f2.ltm, f.ltm);
	f2.child = f.child;
	f2.name = f.name;
	f2.parent = f.parent;
	f2.root = f.root;
	return f2;
}

function
rpMaterialInit(m)
{
	if(m.texture)
		m.texture = RwTextureRead(m.texture.name, m.texture.mask);
	if(m.matfx && m.matfx.envTex)
		m.matfx.envTex = RwTextureRead(m.matfx.envTex.name, m.matfx.envTex.mask);
	if(m.specMat)
		m.specMat.texture = RwTextureRead(m.specMat.texture, "");
}

function
rpGeometryInit(g)
{
	for(let i = 0; i < g.materials.length; i++){
		m = g.materials[i];
		rpMaterialInit(m);
	}
	for(let i = 0; i < g.meshes.length; i++){
		g.meshes[i].material = g.materials[g.meshes[i].matId];
		delete g.meshes[i].matId;
	}
	g.numVertices = g.morphTargets[0].vertices.length;
	g.totalMeshIndices = 0;
	for(let i = 0; i < g.meshes.length; i++)
		g.totalMeshIndices += g.meshes[i].indices.length;
}

function
rpAtomicInit(atomic)
{
	atomic.type = rwID_ATOMIC;
	atomic.frame = null;
	atomic.visible = true;
	atomic.pipeline = defaultPipe;
	atomic.objects = [];
	if(atomic.matfx)
		atomic.pipeline = matFXPipe;
}

function
rpClumpInit(clump)
{
	for(let i = 0; i < clump.atomics.length; i++){
		let a = clump.atomics[i];
		let f = clump.frames[a.frame];
		rpAtomicInit(a);
		RpAtomicSetFrame(a, f);

		rpGeometryInit(a.geometry);
		instanceGeo(a.geometry)
	}
	clump.frame = null;
	for(let i = 0; i < clump.frames.length; i++){
		let f = clump.frames[i];
		p = f.parent;
		rwFrameInit(f);
		if(p >= 0)
			RwFrameAddChild(clump.frames[p], f);
		else
			RpClumpSetFrame(clump, f);
	}
	delete clump.frames;

	rwFrameSynchLTM(clump.frame);
}
