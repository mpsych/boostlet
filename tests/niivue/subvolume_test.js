script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js"; 
script.onload = run;
document.head.appendChild(script);
eval(script);

CATEGORY = "NiiVue"

function run() {

  Boostlet.init();

  let image = Boostlet.get_image(true);

  // verify we got real slice data back
  if (!image.data || image.width === null || image.height === null) {
    console.error("SUBVOLUME TEST FAILED: null data");
    window.TESTFAILED = true;
    return;
  }

  let nonzero = Array.from(image.data).filter(x => x > 0).length;

  if (nonzero === 0) {
    console.error("SUBVOLUME TEST FAILED: all zeros");
    window.TESTFAILED = true;
    return;
  }

  console.log("SUBVOLUME TEST PASSED", image.width, image.height, nonzero, "nonzero pixels");
  window.TESTCOMPLETED = true;

}