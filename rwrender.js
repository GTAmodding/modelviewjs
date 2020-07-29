var RenderPass = -1;

var defaultPipe = {
	renderCB: defaultRenderCB
};
var matFXPipe = {
	renderCB: matfxRenderCB
};
var carPipe = {
	renderCB: carRenderCB
};

function
RenderThisPass(mat)
{
	switch(RenderPass){
	case 0:		// opaque
		return mat.color[3] == 255;
	case 1:		// transparent
		return mat.color[3] != 255;
	}
	return true;
}


function
uploadState(proginfo)
{
	gl.uniformMatrix4fv(proginfo.u.u_proj, false, state.projectionMatrix);
	gl.uniformMatrix4fv(proginfo.u.u_view, false, state.viewMatrix);
	gl.uniformMatrix4fv(proginfo.u.u_world, false, state.worldMatrix);
	if(proginfo.u.u_env)
		gl.uniformMatrix4fv(proginfo.u.u_env, false, state.envMatrix);

	gl.uniform3fv(proginfo.u.u_ambLight, state.ambLight);
	gl.uniform3fv(proginfo.u.u_lightDir, state.lightDir);
	gl.uniform3fv(proginfo.u.u_lightCol, state.lightCol);

	gl.uniform1i(proginfo.u.u_tex0, 0);
	gl.uniform1i(proginfo.u.u_tex1, 1);
	gl.uniform1i(proginfo.u.u_tex2, 2);

	gl.uniform1f(proginfo.u.u_alphaRef, state.alphaRef);
}

function
setAttributes(attribs, proginfo)
{
	for(let i = 0; i < attribs.length; i++){
		a = attribs[i];
		if(proginfo.a[a.index] < 0)
			continue;
		gl.vertexAttribPointer(proginfo.a[a.index],
			a.size, a.type,
			a.normalized,
			a.stride, a.offset);
		gl.enableVertexAttribArray(proginfo.a[a.index]);
	}
}

function
resetAttributes(attribs, proginfo)
{
	for(let i = 0; i < attribs.length; i++){
		a = attribs[i];
		if(proginfo.a[a.index] >= 0)
			gl.disableVertexAttribArray(proginfo.a[a.index]);
	}
}

function
defaultRenderCB(atomic)
{
	if(!atomic.visible)
		return;

	mat4.copy(state.worldMatrix, atomic.frame.ltm);

	let header = atomic.geometry.instData;
	gl.bindBuffer(gl.ARRAY_BUFFER, header.vbo);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, header.ibo);

	let prg = defaultProgram;
	gl.useProgram(prg.program);

	setAttributes(header.attribs, prg);
	uploadState(prg);

	for(let i = 0; i < header.inst.length; i++){
		inst = header.inst[i];
		m = inst.material;

		if(!RenderThisPass(m))
			continue;

		gl.activeTexture(gl.TEXTURE0);
		if(m.texture)
			gl.bindTexture(gl.TEXTURE_2D, m.texture.tex);
		else
			gl.bindTexture(gl.TEXTURE_2D, whitetex);

		vec4.scale(state.matColor, m.color, 1.0/255.0);
		state.surfaceProps[0] = m.surfaceProperties[0];
		state.surfaceProps[1] = m.surfaceProperties[1];
		state.surfaceProps[2] = m.surfaceProperties[2];

		gl.uniform4fv(prg.u.u_matColor, state.matColor);
		gl.uniform4fv(prg.u.u_surfaceProps, state.surfaceProps);

		if(m.color[3] != 255 || m.texture){
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		}else
			gl.disable(gl.BLEND);

		gl.drawElements(header.prim, inst.numIndices, gl.UNSIGNED_SHORT, inst.offset);
	}

	resetAttributes(header.attribs, programInfo);
}

var envMatScale = mat4.fromValues(
	-0.5,  0.0, 0.0, 0.0,
	 0.0, -0.5, 0.0, 0.0,
	 0.0,  0.0, 1.0, 0.0,
	 0.5,  0.5, 0.0, 1.0
);

function
matfxRenderCB(atomic)
{
	if(!atomic.visible)
		return;

	mat4.copy(state.worldMatrix, atomic.frame.ltm);

	let tmp = mat4.create();
	mat4.invert(tmp, envFrame.ltm);
	mat4.multiply(tmp, tmp, state.viewMatrix);
	tmp[12] = tmp[13] = tmp[14] = 0.0;

	mat4.multiply(state.envMatrix, envMatScale, tmp);

	let header = atomic.geometry.instData;
	gl.bindBuffer(gl.ARRAY_BUFFER, header.vbo);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, header.ibo);

	let prg = envMapProgram;
	gl.useProgram(prg.program);

	setAttributes(header.attribs, prg);
	uploadState(prg);

	for(let i = 0; i < header.inst.length; i++){
		inst = header.inst[i];
		m = inst.material;

		if(!RenderThisPass(m))
			continue;

		gl.activeTexture(gl.TEXTURE0);
		if(m.texture)
			gl.bindTexture(gl.TEXTURE_2D, m.texture.tex);
		else
			gl.bindTexture(gl.TEXTURE_2D, whitetex);

		gl.activeTexture(gl.TEXTURE1);
		envcoef = 0.0;
		if(m.matfx && m.matfx.envTex){
			envcoef = m.matfx.envCoefficient;
			gl.bindTexture(gl.TEXTURE_2D, m.matfx.envTex.tex);
		}else
			gl.bindTexture(gl.TEXTURE_2D, null);

		vec4.scale(state.matColor, m.color, 1.0/255.0);
		state.surfaceProps[0] = m.surfaceProperties[0];
		state.surfaceProps[1] = envcoef;
		state.surfaceProps[2] = m.surfaceProperties[2];

		gl.uniform4fv(prg.u.u_matColor, state.matColor);
		gl.uniform4fv(prg.u.u_surfaceProps, state.surfaceProps);

		if(m.color[3] != 255 || m.texture){
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		}else
			gl.disable(gl.BLEND);

		gl.drawElements(header.prim, inst.numIndices, gl.UNSIGNED_SHORT, inst.offset);
	}

	resetAttributes(header.attribs, programInfo);
}

function
carRenderCB(atomic)
{
	if(!atomic.visible)
		return;

	mat4.copy(state.worldMatrix, atomic.frame.ltm);

	let header = atomic.geometry.instData;
	gl.bindBuffer(gl.ARRAY_BUFFER, header.vbo);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, header.ibo);

	let prg = carPS2Program;
	gl.useProgram(prg.program);

	setAttributes(header.attribs, prg);
	uploadState(prg);

	for(let i = 0; i < header.inst.length; i++){
		inst = header.inst[i];
		m = inst.material;

		if(!RenderThisPass(m))
			continue;

		gl.activeTexture(gl.TEXTURE0);
		if(m.texture)
			gl.bindTexture(gl.TEXTURE_2D, m.texture.tex);
		else
			gl.bindTexture(gl.TEXTURE_2D, whitetex);

		let shininess = 0.0;
		let specularity = 0.0;

		if(m.fxFlags & 3){
			shininess = m.envMap.shininess;
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, m.envMap.texture.tex);
		}

		if(m.fxFlags & 4){
			specularity = m.specMap.specularity;
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, m.specMap.texture.tex);
		}

		vec4.scale(state.matColor, m.color, 1.0/255.0);
		state.surfaceProps[0] = m.surfaceProperties[0];
		state.surfaceProps[1] = specularity;
		state.surfaceProps[2] = m.surfaceProperties[2];
		state.surfaceProps[3] = shininess;

		gl.uniform4fv(prg.u.u_matColor, state.matColor);
		gl.uniform4fv(prg.u.u_surfaceProps, state.surfaceProps);

		if(m.color[3] != 255 || m.texture){
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		}else
			gl.disable(gl.BLEND);

		gl.drawElements(header.prim, inst.numIndices, gl.UNSIGNED_SHORT, inst.offset);
	}

	resetAttributes(header.attribs, programInfo);
}
