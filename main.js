var DataDirPath;
var ModelsDirPath;
var TexturesDirPath;

// init info
var isIIICar;
var isSACar;
var carColors;

// the scene
var running = false;
var myclump;
var modelinfo;
var camPitch;
var camYaw;
var camDist;

// gl things
var state = {};
var whitetex;
var camera;

var envFrame;
var defaultProgram;
var envMapProgram;
var carPS2Program;

var backgroundColor = [0, 0, 0, 0];

function deg2rad(d) { return d / 180.0 * Math.PI; }

var rotating, zooming;

function
mouseDown(e)
{
	if(e.button == 0)
		rotating = true;
	else if(e.button == 1)
		zooming = true;
	old_x = e.pageX;
	old_y = e.pageY;
	e.preventDefault();
}

function
mouseUp(e)
{
	rotating = false;
	zooming = false;
}

function
mouseMove(e)
{
	let dX, dY;
	if(rotating){
		dX = (e.pageX-old_x)*2*Math.PI/gl.canvas.width,
		dY = (e.pageY-old_y)*2*Math.PI/gl.canvas.height;

		camYaw -= dX;
		camPitch += dY;
		if(camPitch > Math.PI/2 - 0.01) camPitch = Math.PI/2 - 0.01
		if(camPitch < -Math.PI/2 + 0.01) camPitch = -Math.PI/2 + 0.01

		old_x = e.pageX;
		old_y = e.pageY;
		e.preventDefault();
	}
	if(zooming){
		dY = (e.pageY-old_y)/gl.canvas.height;

		camDist += dY;
		if(camDist < 0.1) camDist = 0.1;

		old_x = e.pageX;
		e.preventDefault();
	}
};

function
InitRW()
{
console.log("InitRW()");
	let canvas = document.querySelector('#glcanvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	// Get background color from stylesheet
	var bgColorStr = window.getComputedStyle(canvas, null).getPropertyValue("background-color");
	bgColorStr = bgColorStr.substring(4, bgColorStr.length-1);
	backgroundColor = bgColorStr.replace(" ", "").split(",");
	backgroundColor = [parseFloat(backgroundColor[0])/255, parseFloat(backgroundColor[1])/255, parseFloat(backgroundColor[2])/255, 1.0];

	gl = canvas.getContext('webgl');

	if(!gl){
		alert('Unable to initialize WebGL. Your browser or machine may not support it.');
		return;
	}

	canvas.addEventListener("mousedown", mouseDown, false);
	canvas.addEventListener("mouseup", mouseUp, false);
	canvas.addEventListener("mouseout", mouseUp, false);
	canvas.addEventListener("mousemove", mouseMove, false);

	whitetex = loadTexture("textures/white.png");

	defaultProgram = loadShaders(defaultVS, defaultFS);
	envMapProgram = loadShaders(envVS, envFS);
	carPS2Program = loadShaders(carPS2VS, carPS2FS);

	state.alphaRef = 0.1;
	state.projectionMatrix = mat4.create();
	state.viewMatrix = mat4.create();
	state.worldMatrix = mat4.create();
	state.envMatrix = mat4.create();
	state.matColor = vec4.create();
	state.surfaceProps = vec4.create();
	state.ambLight = vec3.fromValues(0.4, 0.4, 0.4);
	const alpha = 45;
	const beta = 45;
	state.lightDir = vec3.fromValues(
		-Math.cos(deg2rad(beta))*Math.cos(deg2rad(alpha)),
		-Math.sin(deg2rad(beta))*Math.cos(deg2rad(alpha)),
		-Math.sin(deg2rad(alpha))
	);
	state.lightCol = vec3.fromValues(1.0, 1.0, 1.0);


	AttachPlugins();

	camera = RwCameraCreate();
	camera.nearPlane = 0.1;
	camera.farPlane = 100.0;
	let frm = RwFrameCreate();
	RwCameraSetFrame(camera, frm);

	const fov = deg2rad(70);
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	camera.viewWindow[1] = Math.tan(fov / 2);
	camera.viewWindow[0] = camera.viewWindow[1]*aspect;

	envFrame = RwFrameCreate();
	mat4.rotateX(envFrame.matrix, envFrame.matrix, deg2rad(60));
	rwFrameSynchLTM(envFrame);
}

function
displayFrames(frame, parelem)
{
	let li = document.createElement('li');
	li.innerHTML = frame.name;
	for(let i = 0; i < frame.objects.length; i++){
		let o = frame.objects[i];
		if(o.type == rwID_ATOMIC){
			let checkbox = document.createElement('input');
			checkbox.type = "checkbox";
			checkbox.onclick = function() { o.visible = checkbox.checked; };
			checkbox.checked = o.visible;
			li.appendChild(checkbox);
		}
	}
	parelem.appendChild(li);
	if(frame.child){
		let ul = document.createElement('ul');
		parelem.appendChild(ul);
		for(let c = frame.child; c != null; c = c.next)
			displayFrames(c, ul);
	}
}

function
loadCarIII(filename)
{
	loadDFF(filename, function(clump){
		myclump = clump;
		modelinfo = processVehicle(myclump);
		setupIIICar(myclump);
		setVehicleColors(modelinfo, carColors[0], carColors[1]);
		main();
	});
}

function
loadCarVC(filename)
{
	loadDFF(filename, function(clump){
		myclump = clump;
		modelinfo = processVehicle(myclump);
		setVehicleColors(modelinfo, carColors[0], carColors[1]);
		main();
	});
}

function
loadCarSA(filename)
{
	loadDFF(filename, function(clump){
		myclump = clump;
		modelinfo = processVehicle(myclump);
		setupSACar(myclump);
		setVehicleColors(modelinfo,
			carColors[0], carColors[1], carColors[2], carColors[3]);
		setVehicleLightColors(modelinfo,
			[ 255, 255, 255, 255 ],
			[ 255, 255, 255, 255 ],
			[ 255, 255, 255, 255 ],
			[ 255, 255, 255, 255 ]);
		main();
	});
}

function
loadModel(filename)
{
	loadDFF(filename, function(clump){
		myclump = clump;
		main();
	});
}

function
removeChildren(x)
{
	while(x.firstChild)
		x.removeChild(x.firstChild);
}

function
main()
{
	let ul = document.getElementById('frames');
	removeChildren(ul);
	displayFrames(myclump.frame, ul);

	if(!running){
		running = true;

		let then = 0;
		function render(now){
			now *= 0.001;  // convert to seconds
			const deltaTime = now - then;
			then = now;
	
			drawScene(deltaTime);
	
			requestAnimationFrame(render);
		}
		requestAnimationFrame(render);
	}
}

function
setupIIICar(clump)
{
	for(let i = 0; i < clump.atomics.length; i++){
		let a = clump.atomics[i];
		a.pipeline = matFXPipe;
		for(let j = 0; j < a.geometry.materials.length; j++){
			m = a.geometry.materials[j];
			if(m.surfaceProperties[1] <= 0.0)
				continue;
			m.matfx = {
				type: 2,
				envCoefficient: m.surfaceProperties[1],
				envTex: RwTextureRead("reflection01", "")
			};
		}
	}
}

function
setupSACar(clump)
{
	for(let i = 0; i < clump.atomics.length; i++){
		let a = clump.atomics[i];
		a.pipeline = carPipe;
		for(let j = 0; j < a.geometry.materials.length; j++){
			m = a.geometry.materials[j];
			m.fxFlags = 0;
			if(!m.matfx || m.matfx.type != 2) continue;

			if(m.matfx.envTex && m.envMap && m.envMap.shininess != 0){
				m.envMap.texture = m.matfx.envTex;
				if(m.envMap.texture.name[0] == 'x')
					m.fxFlags |= 2;
				else
					m.fxFlags |= 1;
			}

			if(m.specMap && m.specMap.specularity != 0)
				m.fxFlags |= 4;
		}
	}
}

function
setVehicleColors(vehinfo, c1, c2, c3, c4)
{
	for(let i = 0; i < vehinfo.firstMaterials.length; i++)
		vehinfo.firstMaterials[i].color = c1;
	for(let i = 0; i < vehinfo.secondMaterials.length; i++)
		vehinfo.secondMaterials[i].color = c2;
	for(let i = 0; i < vehinfo.thirdMaterials.length; i++)
		vehinfo.thirdMaterials[i].color = c3;
	for(let i = 0; i < vehinfo.fourthMaterials.length; i++)
		vehinfo.fourthMaterials[i].color = c4;

	if(c1) document.getElementById("custom-color0").value = RGB2HTML(c1);
	if(c2) document.getElementById("custom-color1").value = RGB2HTML(c2);
	if(c3) document.getElementById("custom-color2").value = RGB2HTML(c3);
	if(c4) document.getElementById("custom-color3").value = RGB2HTML(c4);
}

function
setVehicleLightColors(vehinfo, c1, c2, c3, c4)
{
	for(let i = 0; i < vehinfo.firstLightMaterials.length; i++)
		vehinfo.firstLightMaterials[i].color = c1;
	for(let i = 0; i < vehinfo.secondLightMaterials.length; i++)
		vehinfo.secondLightMaterials[i].color = c2;
	for(let i = 0; i < vehinfo.thirdLightMaterials.length; i++)
		vehinfo.thirdLightMaterials[i].color = c3;
	for(let i = 0; i < vehinfo.fourthLightMaterials.length; i++)
		vehinfo.fourthLightMaterials[i].color = c4;
}

function
findEditableMaterials(geo, vehinfo)
{
	for(let i = 0; i < geo.materials.length; i++){
		m = geo.materials[i];
		if(m.color[0] == 0x3C && m.color[1] == 0xFF && m.color[2] == 0)
			vehinfo.firstMaterials.push(m);
		else if(m.color[0] == 0xFF && m.color[1] == 0 && m.color[2] == 0xAF)
			vehinfo.secondMaterials.push(m);
		else if(m.color[0] == 0 && m.color[1] == 0xFF && m.color[2] == 0xFF)
			vehinfo.thirdMaterials.push(m);
		else if(m.color[0] == 0xFF && m.color[1] == 0x00 && m.color[2] == 0xFF)
			vehinfo.fourthMaterials.push(m);
		else if(m.color[0] == 0xFF && m.color[1] == 0xAF && m.color[2] == 0)
			vehinfo.firstLightMaterials.push(m);
		else if(m.color[0] == 0 && m.color[1] == 0xFF && m.color[2] == 0xC8)
			vehinfo.secondLightMaterials.push(m);
		else if(m.color[0] == 0xB9 && m.color[1] == 0xFF && m.color[2] == 0)
			vehinfo.thirdLightMaterials.push(m);
		else if(m.color[0] == 0xFF && m.color[1] == 0x3C && m.color[2] == 0)
			vehinfo.fourthLightMaterials.push(m);
	}
}

function
processVehicle(clump)
{
	let vehicleInfo = {
		firstMaterials: [],
		secondMaterials: [],
		thirdMaterials: [],
		fourthMaterials: [],
		firstLightMaterials: [],	// front left
		secondLightMaterials: [],	// front right
		thirdLightMaterials: [],	// back left
		fourthLightMaterials: [],	// back right
		clump: clump
	};

	// Wheel atomic to clone
	let wheel = null;
	
	for(let i = 0; i < clump.atomics.length; i++){
		a = clump.atomics[i];
		f = a.frame;
		if(f.name.endsWith("_dam") ||
		   f.name.endsWith("_lo") ||
		   f.name.endsWith("_vlo"))
			a.visible = false;

		if(!wheel && f.name.startsWith("wheel")) {
			wheel = a;
		}
		
		findEditableMaterials(a.geometry, vehicleInfo);
	}
	
	// Clone wheels
	let frame = clump.frame.child;
	while(wheel && frame) {
		if(["wheel_rb_dummy", "wheel_rm_dummy", "wheel_lf_dummy", "wheel_lb_dummy", "wheel_lm_dummy"].includes(frame.name)) {
			let wheel2 = RpAtomicClone(wheel);
			mat4.copy(wheel2.frame.ltm, frame.ltm);
			if(["wheel_lf_dummy", "wheel_lb_dummy", "wheel_lm_dummy"].includes(frame.name)) {
				// Rotate cloned wheel
				mat4.rotate(wheel2.frame.ltm, wheel2.frame.ltm, Math.PI, [0, 0, 1]);
			}
			frame.child = wheel2.frame;
			clump.atomics.push(wheel2);
		}
		frame = frame.next;
	}

	return vehicleInfo;
}

function
drawScene(deltaTime)
{
	if(window.autoRotateCamera) {
		camYaw += deltaTime * 0.9;
	}

	gl.clearColor(backgroundColor[0], backgroundColor[1], backgroundColor[2], 1.0);
	gl.clearDepth(1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	let x = camDist * Math.cos(camYaw)* Math.cos(camPitch);
	let y = camDist * Math.sin(camYaw)* Math.cos(camPitch);
	let z = camDist * Math.sin(camPitch);
	RwFrameLookAt(camera.frame, 
		[ x, y, z ],
		[ 0.0, 0.0, 0.0 ],
		[ 0.0, 0.0, 1.0 ]);
	rwFrameSynchLTM(camera.frame);

	RwCameraBeginUpdate(camera);

	RenderPass = 0;
	RpClumpRender(myclump);
	RenderPass = 1;
	RpClumpRender(myclump);
	RenderPass = -1;
}


function
loadDFF(filename, cb)
{
	let req = new XMLHttpRequest();
	req.open("GET", ModelsDirPath + "/" + filename, true);
	req.responseType = "arraybuffer";

	req.onload = function(oEvent){
		let arrayBuffer = req.response;
		if(arrayBuffer){
			stream = RwStreamCreate(arrayBuffer);

			if(RwStreamFindChunk(stream, rwID_CLUMP)){
				let c = RpClumpStreamRead(stream);
				if(c != null)
					cb(c);
			}
			return null;
		}
	};

	req.send(null);
}

function
rgbToCSSString(r, g, b)
{
	return ["rgb(",r,",",g,",",b,")"].join("");
}

function
RGB2HTML(color)
{
    let decColor = 0x1000000 + color[2] + 0x100 * color[1] + 0x10000 * color[0];
    return '#' + decColor.toString(16).substr(1);
}
