CATEGORY = "Hidden"

script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = function() {
  run().catch(function(e) { Boostlet.hint('Trako failed: ' + e.message, 5000); });
};
script.onerror = function() { alert('Trako could not load Boostlet'); };
// skip loading boostlet again when the page already has it
if (window.Boostlet) script.onload(); else document.head.appendChild(script);

//
// THIS ONLY WORKS WITH NIIVUE RIGHT NOW (0.6 and 1.0)
//
async function run() {

  Boostlet.hint('Trako loading', 2000);

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
    Boostlet.hint('Trako loaded, drop a .tko file on the box', 3000);
    container.addEventListener("dragover", function(e) {

      container.style.color = 'red'; 
      e.preventDefault();

    }, false);

  }
  
}

async function onDrop(e) {

  e.stopPropagation();
  e.preventDefault();

  const f = e.dataTransfer.files[0];
  if (!/\.tko$/i.test(f?.name)) {
    Boostlet.hint('Please drop a .tko file', 3000);
    return;
  }

  try {
    const fibers = new xtkTrakoReader().parse(JSON.parse(await f.text()));
    // load the fibers as an in-memory .tck, which NiiVue 0.6 and 1.0 both read like any tract file
    const tck = fibersToTck(fibers.points.da);
    const nv = Boostlet.framework.instance;
    if (Boostlet.framework.v1) await nv.addMesh({ url: new File([tck], 'trako.tck') });
    else await nv.loadFromArrayBuffer(tck.buffer, 'trako.tck');
    container.remove();
  } catch (err) {
    Boostlet.hint(`Could not load ${f.name}: ${err.message ?? err}`, 5000);
  }

}

// TRAKO decodes fibers as GL line segments (consecutive point pairs). Join touching segments into
// streamlines and write MRtrix .tck: float32 xyz per point, NaN after each streamline, Inf at the end.
function fibersToTck(points) {
  const OFFSET = 256; // header is padded to this many bytes
  // worst case per segment: separator + 2 points = 9 floats; plus leading NaN and trailing NaN + Inf
  const tck = new Uint8Array(OFFSET + (points.length * 1.5 + 9) * 4);
  const xyz = new Float32Array(tck.buffer, OFFSET);
  // Leading NaN: NiiVue's TCK readers (0.6 and 1.0rc, fix: niivue/mono#623) overwrite the first offset
  // with the end of streamline 0 and so drop it; an empty streamline in front absorbs that.
  xyz.fill(NaN, 0, 3);
  let n = 3, count = 0;
  for (let i = 0; i < points.length; i += 6) {
    const continues = i > 0 && points[i] === points[i - 3] && points[i + 1] === points[i - 2] && points[i + 2] === points[i - 1];
    if (!continues) {
      if (i > 0) { xyz[n++] = NaN; xyz[n++] = NaN; xyz[n++] = NaN; }
      xyz[n++] = points[i]; xyz[n++] = points[i + 1]; xyz[n++] = points[i + 2];
      count++;
    }
    xyz[n++] = points[i + 3]; xyz[n++] = points[i + 4]; xyz[n++] = points[i + 5];
  }
  xyz.set([NaN, NaN, NaN, Infinity, Infinity, Infinity], n);
  n += 6;
  tck.set(new TextEncoder().encode(`mrtrix tracks\ndatatype: Float32LE\ncount: ${count}\nfile: . ${OFFSET}\nEND\n`));
  return tck.slice(0, OFFSET + n * 4);
}
