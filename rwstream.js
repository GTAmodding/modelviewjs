function
AttachPlugins()
{
	frameTKList[rwID_NODENAME] = { streamRead: NodeNameStreamRead };
	geometryTKList[rwID_BINMESHPLUGIN] = { streamRead: rpMeshRead };
	materialTKList[rwID_MATERIALEFFECTSPLUGIN] = { streamRead: rpMatfxMaterialStreamRead };
	materialTKList[rwID_ENVMAT] = { streamRead: envMatStreamRead };
	materialTKList[rwID_SPECMAT] = { streamRead: specMatStreamRead };
	atomicTKList[rwID_MATERIALEFFECTSPLUGIN] = { streamRead: rpMatfxAtomicStreamRead };
}

function
RwStreamCreate(buffer)
{
	return {
		buffer: buffer,
		view: new DataView(buffer),
		offset: 0,
		eof: false
	};
}

function
RwStreamSkip(stream, len)
{
	stream.offset += len;
}

function
RwStreamReadUInt8(stream)
{
	if(stream.offset >= stream.buffer.byteLength){
		stream.eof = true;
		return null;
	}
	let v = stream.view.getUint8(stream.offset, true);
	stream.offset += 1;
	return v;
}

function
RwStreamReadUInt16(stream)
{
	if(stream.offset >= stream.buffer.byteLength){
		stream.eof = true;
		return null;
	}
	let v = stream.view.getUint16(stream.offset, true);
	stream.offset += 2;
	return v;
}

function
RwStreamReadUInt32(stream)
{
	if(stream.offset >= stream.buffer.byteLength){
		stream.eof = true;
		return null;
	}
	let v = stream.view.getUint32(stream.offset, true);
	stream.offset += 4;
	return v;
}

function
RwStreamReadInt32(stream)
{
	if(stream.offset >= stream.buffer.byteLength){
		stream.eof = true;
		return null;
	}
	let v = stream.view.getInt32(stream.offset, true);
	stream.offset += 4;
	return v;
}

function
RwStreamReadReal(stream)
{
	if(stream.offset >= stream.buffer.byteLength){
		stream.eof = true;
		return null;
	}
	let v = stream.view.getFloat32(stream.offset, true);
	stream.offset += 4;
	return v;
}

function
RwStreamReadString(stream, length)
{
	if(stream.offset >= stream.buffer.byteLength){
		stream.eof = true;
		return null;
	}
	let a = new Uint8Array(stream.buffer, stream.offset, length);
	let s = "";
	for(let i = 0; i < length && a[i] != 0; i++)
		s += String.fromCharCode(a[i]);
	stream.offset += length;
	return s;
}

function
rwStreamReadChunkHeader(stream)
{
	let t = RwStreamReadUInt32(stream);
	let l = RwStreamReadUInt32(stream);
	let id = RwStreamReadUInt32(stream);
	if(stream.eof)
		return null;
	let version = 0;
	let build = 0;
	if((id & 0xFFFF0000) == 0){
		version = id<<8;
		build = 0;
	}else{
		version = ((id>>14) & 0x3FF00) + 0x30000 |
			((id>>16) & 3);
		build = id & 0xFFFF;
	}
	return {
		type: t,
		length: l,
		version: version,
		build: build,
	};
}

function
RwStreamFindChunk(stream, type)
{
	let header;
	while(header = rwStreamReadChunkHeader(stream)){
		if(header.type == type)
			return header;
		RwStreamSkip(stream, header.length);
	}
	return null;
}

function
rwPluginRegistryReadDataChunks(tklist, stream, object)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_EXTENSION)) == null)
		return null;
	let end = stream.offset + header.length;
	while(stream.offset < end){
		header = rwStreamReadChunkHeader(stream);
		if(header.type in tklist && tklist[header.type].streamRead){		
			if(!tklist[header.type].streamRead(stream, object, header.length))
				return null;
		}else
			RwStreamSkip(stream, header.length);
	}
	return 1;
}

function
rwStringStreamFindAndRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRING)) == null)
		return null;
	return RwStreamReadString(stream, header.length);
}

function
rwFrameListStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let numFrames = RwStreamReadInt32(stream);
	let frames = [];
	for(let i = 0; i < numFrames; i++){
		let xx = RwStreamReadReal(stream);
		let xy = RwStreamReadReal(stream);
		let xz = RwStreamReadReal(stream);
		let yx = RwStreamReadReal(stream);
		let yy = RwStreamReadReal(stream);
		let yz = RwStreamReadReal(stream);
		let zx = RwStreamReadReal(stream);
		let zy = RwStreamReadReal(stream);
		let zz = RwStreamReadReal(stream);
		let wx = RwStreamReadReal(stream);
		let wy = RwStreamReadReal(stream);
		let wz = RwStreamReadReal(stream);

		frame = RwFrameCreate();
		mat4.set(frame.matrix,
			xx, xy, xz, 0,
			yx, yy, yz, 0,
			zx, zy, zz, 0,
			wx, wy, wz, 1);
		frames.push(frame);
		let parent = RwStreamReadInt32(stream);
		RwStreamReadInt32(stream);	// unused
		if(parent >= 0)
			RwFrameAddChild(frames[parent], frame);
	}
	for(let i = 0; i < numFrames; i++)
		if(!rwPluginRegistryReadDataChunks(frameTKList, stream, frames[i]))
			return null;
	return frames;
}

function
RwTextureStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let flags = RwStreamReadUInt32(stream);	// we ignore this
	let name = rwStringStreamFindAndRead(stream);
	if(name == null) return null;
	let mask = rwStringStreamFindAndRead(stream);
	if(mask == null) return null;
	let tex = RwTextureRead(name, mask);
	if(!rwPluginRegistryReadDataChunks(textureTKList, stream, tex))
		return null;
	return tex;
}

function
RpMaterialStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let mat = RpMaterialCreate();
	RwStreamReadInt32(stream);	// flags, unused
	mat.color[0] = RwStreamReadUInt8(stream);
	mat.color[1] = RwStreamReadUInt8(stream);
	mat.color[2] = RwStreamReadUInt8(stream);
	mat.color[3] = RwStreamReadUInt8(stream);
	RwStreamReadInt32(stream);	// unused
	let textured = RwStreamReadInt32(stream);
	mat.surfaceProperties[0] = RwStreamReadReal(stream);
	mat.surfaceProperties[1] = RwStreamReadReal(stream);
	mat.surfaceProperties[2] = RwStreamReadReal(stream);
	if(textured){
		if((header = RwStreamFindChunk(stream, rwID_TEXTURE)) == null)
			return null;
		mat.texture = RwTextureStreamRead(stream);
		if(mat.texture == null)
			return null;
	}
	if(!rwPluginRegistryReadDataChunks(materialTKList, stream, mat))
		return null;
	return mat;
}

function
rpMaterialListStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let numMaterials = RwStreamReadInt32(stream);
	let indices = [];
	while(numMaterials--)
		indices.push(RwStreamReadInt32(stream));
	let materials = []
	for(let i = 0; i < indices.length; i++){
		if(indices[i] >= 0)
			materials.push(materials[indices[i]]);
		else{
			if((header = RwStreamFindChunk(stream, rwID_MATERIAL)) == null)
				return null;
			let m = RpMaterialStreamRead(stream);
			if(m == null)
				return null;
			materials.push(m);
		}
	}
	return materials;
}

function
RpGeometryStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let flags = RwStreamReadUInt32(stream);
	let numTriangles = RwStreamReadInt32(stream);
	let numVertices = RwStreamReadInt32(stream);
	let numMorphTargets = RwStreamReadInt32(stream);
	if(header.version < 0x34000)
		RwStreamSkip(stream, 12);
	if(flags & 0x01000000) return null;	// native geometry not supported

	let geo = RpGeometryCreate(flags, numMorphTargets);
	geo.numVertices = numVertices;

	if(geo.prelit)
		for(let i = 0; i < numVertices; i++){
			let r = RwStreamReadUInt8(stream);
			let g = RwStreamReadUInt8(stream);
			let b = RwStreamReadUInt8(stream);
			let a = RwStreamReadUInt8(stream);
			geo.prelit.push([r, g, b, a]);
		}

	for(let i = 0; i < geo.texCoords.length; i++){
		let texCoords = geo.texCoords[i];
		for(let j = 0; j < numVertices; j++){
			let u = RwStreamReadReal(stream);
			let v = RwStreamReadReal(stream);
			texCoords.push([u, v]);
		}
	}

	for(let i = 0; i < numTriangles; i++){
		let w1 = RwStreamReadUInt32(stream);
		let w2 = RwStreamReadUInt32(stream);
		let v1 = w1>>16 & 0xFFFF;
		let v2 = w1 & 0xFFFF;
		let v3 = w2>>16 & 0xFFFF;
		let matid = w2 & 0xFFFF;
		geo.triangles.push([v1, v2, v3, matid]);
	}

	for(let i = 0; i < numMorphTargets; i++){
		let mt = geo.morphTargets[i];

		RwStreamSkip(stream, 4*4 + 4 + 4);	// ignore bounding sphere and flags
		for(let j = 0; j < numVertices; j++){
			let x = RwStreamReadReal(stream);
			let y = RwStreamReadReal(stream);
			let z = RwStreamReadReal(stream);
			mt.vertices.push([x, y, z]);
		}
		if(mt.normals)
			for(let j = 0; j < numVertices; j++){
				let x = RwStreamReadReal(stream);
				let y = RwStreamReadReal(stream);
				let z = RwStreamReadReal(stream);
				mt.normals.push([x, y, z]);
			}
	}

	if((header = RwStreamFindChunk(stream, rwID_MATLIST)) == null)
		return null;
	geo.materials = rpMaterialListStreamRead(stream);
	if(geo.materials == null)
		return null;

	if(!rwPluginRegistryReadDataChunks(geometryTKList, stream, geo))
		return null;

	return geo;
}

function
rpMeshRead(stream, geo, length)
{
	geo.meshtype = RwStreamReadInt32(stream);
	let numMeshes = RwStreamReadInt32(stream);
	geo.totalMeshIndices = RwStreamReadInt32(stream);
	while(numMeshes--){
		let numIndices = RwStreamReadInt32(stream);
		let matid = RwStreamReadInt32(stream);
		let m = {
			indices: [],
			material: geo.materials[matid]
		};
		while(numIndices--)
			m.indices.push(RwStreamReadInt32(stream));
		geo.meshes.push(m);
	}
	return geo;
}

function
rpGeometryListStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let numGeoms = RwStreamReadInt32(stream);
	let geoms = []
	while(numGeoms--){
		if((header = RwStreamFindChunk(stream, rwID_GEOMETRY)) == null)
			return null;
		let g = RpGeometryStreamRead(stream);
		if(g == null)
			return null;
		geoms.push(g);
	}
	return geoms;
}

function
rpClumpAtomicStreamRead(stream, frames, geos)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;
	let atomic = RpAtomicCreate();
	let frame = RwStreamReadInt32(stream);
	let geometry = RwStreamReadInt32(stream);
	let flags = RwStreamReadInt32(stream);	// ignored
	RwStreamReadInt32(stream);	// unused
	RpAtomicSetFrame(atomic, frames[frame]);
	atomic.geometry = geos[geometry];

	if(!rwPluginRegistryReadDataChunks(atomicTKList, stream, atomic))
		return null;

	return atomic;
}

function
RpClumpStreamRead(stream)
{
	let header;
	if((header = RwStreamFindChunk(stream, rwID_STRUCT)) == null)
		return null;

	let numAtomics = RwStreamReadInt32(stream);
	let numLights = 0;
	let numCameras = 0;
	if(header.version > 0x33000){
		numLights = RwStreamReadInt32(stream);
		numCameras = RwStreamReadInt32(stream);
	}

	if((header = RwStreamFindChunk(stream, rwID_FRAMELIST)) == null)
		return null;
	frames = rwFrameListStreamRead(stream);
	if(frames == null)
		return null;

	clump = RpClumpCreate();
	RpClumpSetFrame(clump, frames[0]);

	if((header = RwStreamFindChunk(stream, rwID_GEOMETRYLIST)) == null)
		return null;
	geos = rpGeometryListStreamRead(stream);
	if(geos == null)
		return null;

	while(numAtomics--){
		if((header = RwStreamFindChunk(stream, rwID_ATOMIC)) == null)
			return null;
		let a = rpClumpAtomicStreamRead(stream, frames, geos);
		if(a == null)
			return null;
		clump.atomics.push(a);
	}

	if(!rwPluginRegistryReadDataChunks(clumpTKList, stream, clump))
		return null;

	rwFrameSynchLTM(clump.frame);

	// TODO? lights, cameras

	return clump;
}


/*
 * Plugins
 */

/* MatFX */

var rpMATFXEFFECTBUMPMAP         = 1;
var rpMATFXEFFECTENVMAP          = 2;
var rpMATFXEFFECTBUMPENVMAP      = 3;
var rpMATFXEFFECTDUAL            = 4;
var rpMATFXEFFECTUVTRANSFORM     = 5;
var rpMATFXEFFECTDUALUVTRANSFORM = 6;

function
RpMatFXMaterialSetEffects(mat, effects)
{
	mat.matfx = {
		type: effects,
		bump: false,
		env: false,
		dual: false,
		uvxform: false
	};
	// TODO: init the relevant fields here
	switch(effects){
	case rpMATFXEFFECTBUMPMAP:
		mat.matfx.bump = true;
		break;
	case rpMATFXEFFECTENVMAP:
		mat.matfx.env = true;
		break;
	case rpMATFXEFFECTBUMPENVMAP:
		mat.matfx.bump = true;
		mat.matfx.env = true;
		break;
	case rpMATFXEFFECTDUAL:
		mat.matfx.dual = true;
		break;
	case rpMATFXEFFECTUVTRANSFORM:
		mat.matfx.uvxform = true;
		break;
	case rpMATFXEFFECTDUALUVTRANSFORM:
		mat.matfx.dual = true;
		mat.matfx.uvxform = true;
		break;
	}
}

function
rpMatfxMaterialStreamRead(stream, mat, length)
{
	let header;

	let effects = RwStreamReadInt32(stream);
	RpMatFXMaterialSetEffects(mat, effects);
	let mfx = mat.matfx;

	for(let i = 0; i < 2; i++){
		let type = RwStreamReadInt32(stream);
		switch(type){
		case rpMATFXEFFECTBUMPMAP:
			mfx.bumpCoefficient = RwStreamReadReal(stream);
			if(RwStreamReadInt32(stream)){
				if((header = RwStreamFindChunk(stream, rwID_TEXTURE)) == null)
					return null;
				mfx.bumpedTex = RwTextureStreamRead(stream);
				if(mfx.bumpedTex == null)
					return null;
			}
			if(RwStreamReadInt32(stream)){
				if((header = RwStreamFindChunk(stream, rwID_TEXTURE)) == null)
					return null;
				mfx.bumpTex = RwTextureStreamRead(stream);
				if(mfx.bumpTex == null)
					return null;
			}
			break;
		case rpMATFXEFFECTENVMAP:
			mfx.envCoefficient = RwStreamReadReal(stream);
			mfx.envFBalpha = RwStreamReadInt32(stream);
			if(RwStreamReadInt32(stream)){
				if((header = RwStreamFindChunk(stream, rwID_TEXTURE)) == null)
					return null;
				mfx.envTex = RwTextureStreamRead(stream);
				if(mfx.envTex == null)
					return null;
			}
			break;
		case rpMATFXEFFECTDUAL:
			mfs.srcBlend = RwStreamReadInt32(stream);
			mfs.dstBlend = RwStreamReadInt32(stream);
			if(RwStreamReadInt32(stream)){
				if((header = RwStreamFindChunk(stream, rwID_TEXTURE)) == null)
					return null;
				mfx.dualTex = RwTextureStreamRead(stream);
				if(mfx.dualTex == null)
					return null;
			}
			break;
		}
	}

	return mat;
}

function
rpMatfxAtomicStreamRead(stream, atomic, length)
{
	atomic.matfx = RwStreamReadInt32(stream);
	if(atomic.matfx)
		atomic.pipeline = matFXPipe;
	return atomic;
}


/* GTA Node Name */

function
NodeNameStreamRead(stream, frame, length)
{
	frame.name = RwStreamReadString(stream, length);
	return frame;
}

/* GTA Env Map */

function
envMatStreamRead(stream, mat, length)
{
	let sclX = RwStreamReadReal(stream);
	let sclY = RwStreamReadReal(stream);
	let transSclX = RwStreamReadReal(stream);
	let transSclY = RwStreamReadReal(stream);
	let shininess = RwStreamReadReal(stream);
	RwStreamReadInt32(stream);	// ignore

	mat.envMap = {
		scale: [ sclX, sclY ],
		transScale: [ transSclX, transSclY ],
		shininess: shininess
	};
	return mat;
}

/* GTA Spec Map */

function
specMatStreamRead(stream, mat, length)
{
	let specularity = RwStreamReadReal(stream);
	let texname = RwStreamReadString(stream, 24);

	mat.specMap = {
		specularity: specularity,
		texture: RwTextureRead(texname, "")
	};
	return mat;
}
