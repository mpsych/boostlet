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

        const meshObj = Boostlet.framework.instance.meshes[0];
        const verts = meshObj.pts;

        if (meshObj.offsetPt0 && meshObj.offsetPt0.length > 1) {
          const pts = new Float32Array(meshObj.pts);
          const offsetPt0 = meshObj.offsetPt0;

          const fiberGroup = new THREE.Group();

          for (let i = 0; i < offsetPt0.length - 1; i++) {
            const start = offsetPt0[i];
            const end = offsetPt0[i + 1];

            if (end - start < 2) continue;

            const segmentPoints = [];
            const segmentColors = [];

            for (let j = start; j < end; j++) {
              const x = pts[j * 3];
              const y = pts[j * 3 + 1];
              const z = pts[j * 3 + 2];

              segmentPoints.push(x, y, z);

              if (j < end - 1) {
                const x2 = pts[(j + 1) * 3];
                const y2 = pts[(j + 1) * 3 + 1];
                const z2 = pts[(j + 1) * 3 + 2];

                const dx = x2 - x;
                const dy = y2 - y;
                const dz = z2 - z;

                const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
                const ux = Math.abs(dx / length);
                const uy = Math.abs(dy / length);
                const uz = Math.abs(dz / length);

                // Set color based on segment direction
                segmentColors.push(ux, uy, uz); // for point j
              } else {
                // Repeat last color
                const lastColor = segmentColors.slice(-3);
                segmentColors.push(...lastColor);
              }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(segmentPoints, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(segmentColors, 3));

            const material = new THREE.LineBasicMaterial({
              vertexColors: true,
              linewidth: 1
            });

            const line = new THREE.Line(geometry, material);
            fiberGroup.add(line);
          }

          fiberGroup.scale.set(0.05, 0.05, 0.05);
          entity.setObject3D('mesh', fiberGroup);

        } else {
          console.warn('Neither offsetPt0 nor tris were available. Nothing to render.');
        }

        currentScale = 0.05;
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

        window.__POWERBOOSTTIMER__ = setInterval(function() {

          var vid = document.getElementById('arjs-video');
          if (vid) {
            if (vid.style.zIndex == -2) {
              console.log('Raise the vid!');
              vid.style.zIndex = 1337;
              clearInterval(window.__POWERBOOSTTIMER__);
            } else {
              console.log('still waiting... no zStyle');
            }
          } else {
            console.log('still waiting... no vid');
          }

        }, 1000);

      }, 100);




    });

  });

};
