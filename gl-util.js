var gl;

const ATTRIB_POS = 0;
const ATTRIB_NORMAL = 1;
const ATTRIB_COLOR = 2;
const ATTRIB_TEXCOORDS0 = 3;
const ATTRIB_TEXCOORDS1 = 4;

function
loadTexture(url)
{
	if(gl === undefined)
		return null;

	const texid = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texid);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
		1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array([255, 255, 255, 255]));

	const image = new Image();
	image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texid);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
				gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	};
	image.src = url;

	return texid;
}

function
loadShaders(vs, fs)
{
	const shaderProgram = initShaderProgram(vs, fs);

	programInfo = {
		program: shaderProgram,
		a: [
			gl.getAttribLocation(shaderProgram, 'in_pos'),
			gl.getAttribLocation(shaderProgram, 'in_normal'),
			gl.getAttribLocation(shaderProgram, 'in_color'),
			gl.getAttribLocation(shaderProgram, 'in_tex0'),
			gl.getAttribLocation(shaderProgram, 'in_tex1'),
		],
		u: {
			u_proj: gl.getUniformLocation(shaderProgram, 'u_proj'),
			u_view: gl.getUniformLocation(shaderProgram, 'u_view'),
			u_world: gl.getUniformLocation(shaderProgram, 'u_world'),
			u_env: gl.getUniformLocation(shaderProgram, 'u_env'),
			u_matColor: gl.getUniformLocation(shaderProgram, 'u_matColor'),
			u_surfaceProps: gl.getUniformLocation(shaderProgram, 'u_surfaceProps'),
			u_ambLight: gl.getUniformLocation(shaderProgram, 'u_ambLight'),
			u_lightDir: gl.getUniformLocation(shaderProgram, 'u_lightDir'),
			u_lightCol: gl.getUniformLocation(shaderProgram, 'u_lightCol'),
			u_alphaRef: gl.getUniformLocation(shaderProgram, 'u_alphaRef'),
			u_tex0: gl.getUniformLocation(shaderProgram, 'tex0'),
			u_tex1: gl.getUniformLocation(shaderProgram, 'tex1'),
			u_tex2: gl.getUniformLocation(shaderProgram, 'tex2'),
		},
	};
console.log(programInfo.u.u_alphaRef);
	return programInfo;
}

function
initShaderProgram(vsSource, fsSource)
{
	const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)){
		alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
		return null;
	}

	return shaderProgram;
}

function
loadShader(type, source)
{
	const shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
		alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}
