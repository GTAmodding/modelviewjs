showInterface = true;
autoRotateCamera = false;

function
hex2rgb(hex) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
  
function
updateVehicleCustomColors() {
  let colors = [];
  for(let i = 0; i < 4; i++) {
    let cStr = document.getElementById("custom-color" + i).value;
    let c = hex2rgb(cStr);
    c[3] = 255;
    colors[i] = c;
  }
  setVehicleColors(modelinfo, colors[0], colors[1], colors[2], colors[3]);
}

for(let i = 0; i < 4; i++) {
  document.getElementById("custom-color" + i).addEventListener("input", updateVehicleCustomColors, false);
}

document.addEventListener("keypress",
function(e) {
  if(e.key === "i") {
    showInterface = !showInterface;
    document.querySelectorAll(".ui").forEach((v) => {
      v.style.visibility = showInterface ? "unset" : "hidden";
    });
  }

  else if(e.key === "r") {
    autoRotateCamera = !autoRotateCamera;
  }
},
false);

document.getElementById("objects").addEventListener("keypress",
function(e) {
  e.preventDefault();
  return false;
},
false);

var lastModelChangeViaKey = 0;
document.getElementById("objects").addEventListener("keydown",
function(e) {
  if(e.keyCode !== 38 && e.keyCode !== 40) {
    return true;
  }

  if(Date.now() - lastModelChangeViaKey < 750) {
    e.preventDefault();
    return false;
  }

  lastModelChangeViaKey = Date.now();
},
false);


document.getElementById("objects").addEventListener("keyup",
function(e) {
  if(e.keyCode !== 38 && e.keyCode !== 40) {
    return true;
  }
  
  lastModelChangeViaKey -= 400;

  let model = document.getElementById("objects").value;
  if(model !== CurrentModel.model) {
    SelectModel(model);
  }
},
false);
