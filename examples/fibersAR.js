script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

CATEGORY = "Visualization";

function run() {
  
  // detect visualization framework
  Boostlet.init();

  if (Boostlet.framework.name != 'niivue') {
    alert('Only niivue is supported right now :(');
    return;
  }

  Boostlet.load_script("https://aframe.io/releases/1.3.0/aframe.min.js", function() {

    Boostlet.load_script("https://raw.githack.com/AR-js-org/AR.js/dev/aframe/build/aframe-ar.js", function() {

      const scene = document.createElement('a-scene');
      scene.setAttribute('embedded', '');
      scene.setAttribute('arjs', '');
      scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;');


      // 2. Create a marker
      const marker = document.createElement('a-marker');
      marker.setAttribute('preset', 'hiro');
      scene.appendChild(marker);

      // 3. Create an entity to hold the mesh
      const entity = document.createElement('a-entity');
      entity.setAttribute('position', '0 0 0');
      entity.setAttribute('rotation', '0 0 0');
      marker.appendChild(entity);

      // 4. Create the camera
      const camera = document.createElement('a-entity');
      camera.setAttribute('camera', '');
      scene.appendChild(camera);


      scene.style.zIndex = 31337;

      document.body.appendChild(scene);
      

      setTimeout(() => {

        const meshObj = nv.meshes[0];
        const verts = meshObj.pts;

        if (meshObj.offsetPt0 && meshObj.offsetPt0.length > 1) {
          const pts = new Float32Array(meshObj.pts);
          const offsetPt0 = meshObj.offsetPt0;

          const fiberGroup = new THREE.Group();

          for (let i = 0; i < offsetPt0.length - 1; i++) {
            const start = offsetPt0[i];
            const end = offsetPt0[i + 1];

            if (end - start < 2) continue; // skip too-short fibers

            const streamline = [];

            for (let j = start; j < end; j++) {
              const x = pts[j * 3];
              const y = pts[j * 3 + 1];
              const z = pts[j * 3 + 2];
              streamline.push(new THREE.Vector3(x, y, z));
            }

            const geometry = new THREE.BufferGeometry().setFromPoints(streamline);
            const material = new THREE.LineBasicMaterial({ color: 0xff00ff }); // magenta
            const line = new THREE.Line(geometry, material);
            fiberGroup.add(line);
          }


          fiberGroup.scale.set(0.1, 0.1, 0.1);
          entity.setObject3D('mesh', fiberGroup);

        } else {
          console.warn('Neither offsetPt0 nor tris were available. Nothing to render.');
        }

        currentScale = 0.1;
        window.addEventListener('keydown', (e) => {
          if (e.key === '+' || e.key === '=') {
            currentScale *= 1.1;
          } else if (e.key === '-') {
            currentScale /= 1.1;
          } else {
            return; // ignore other keys
          }

          const obj = entity.getObject3D('mesh');
          if (obj) {
            obj.scale.set(currentScale, currentScale, currentScale);
          }
        });

        setTimeout(() => {
          document.getElementsByTagName('video')[0].style.zIndex = 1337;
        }, 1000);

      }, 100);




    });

  });

};
