
TKOFILE = 'https://bostongfx.github.io/TRAKO/DATA/example.tko';


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

    // we can now use the XTK TKO reader
    xtkTrakoReader.read(TKOFILE, function(fibers) {

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

    });

  }
  
}

