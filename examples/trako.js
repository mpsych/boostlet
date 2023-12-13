script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

//
// THIS ONLY WORKS WITH NIIVUE RIGHT NOW
//
async function run() {
  
  // load example fiber (very small and fast)
  // we need it as a NVMesh template
  nvmesh = await niivue.addMeshFromUrl({'url':'https://niivue.github.io/niivue/images/colby.trk'})
  

  // detect visualization framework
  Boostlet.init();

  // using the XTK TRAKO FILE READER
  libs = ["https://bostongfx.github.io/TRAKO/WEB/js/xtk.js",
          "https://bostongfx.github.io/TRAKO/WEB/js/draco/draco_decoder.js",
          "https://bostongfx.github.io/TRAKO/WEB/js/xtkTrakoReader.js"]
  loaded = 0;


  for (var l in libs) {
    
    Boostlet.load_script(libs[l], lib_load_callback);

  }

}


function lib_load_callback() {

  loaded++;

  if (loaded == libs.length) {

    console.log('all libs loaded');

    container = window.document.createElement('div');
    container.id = 'dropzone';
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.left = '10px';
    container.style.width = '300px';
    container.style.height = '100px';
    container.style.zIndex = '10000';
    container.style.padding = '20px';
    container.style.color = 'white';
    container.style.background = 'black';
    container.innerHTML = 'Drop your TKO file here!<br><br><img src="https://bostongfx.github.io/TRAKO/WEB/gfx/tko.png">';
    window.document.body.appendChild(container);
    container.addEventListener("drop", onDrop, false);
    container.addEventListener("dragover", function(e) {

      container.style.color = 'red'; 
      e.preventDefault();

    }, false);

  }
  
}

function onDrop(e) {

    e.stopPropagation();
    e.preventDefault();

    console.log('file dropped!');



    var files = e.dataTransfer.files;

    for ( var i = 0; i < files.length; i++) {

      var f = files[i];
      var _fileName = f.name;
      var _fileExtension = _fileName.split('.').pop().toUpperCase();

      if (_fileExtension != 'TKO') {

        console.log('File format invalid!');
        return;

      }

      var reader = new FileReader();

      reader.onload = function(e) {

        console.log(e);

        var r = new xtkTrakoReader();
        fibers = r.parse(JSON.parse(e.target.result));

        // now we have an X.fibers object with all points
        nvmesh.pts = fibers.points.da;

        number_of_fibs = fibers.points.da.length / 3 / 2;

        offsets = [];
        for (var i = 0; i < number_of_fibs; i += 2) {

          offsets.push(i);

        }

        nvmesh.offsetPt0 = new Uint32Array(offsets);

        nvmesh.fiberLength = 0.001;
        nvmesh.fiberLengths = null;

        // this sets up our NVMesh for the TRAKO data
        nvmesh.updateFibers(niivue.gl);

        // and repaints everything!
        niivue.updateGLVolume()

        // hide the container
        window.document.body.removeChild(container);


      };

      reader.readAsText(f);

    }

}
