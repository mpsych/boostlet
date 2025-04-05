/*
 * THIS IS EXCELLENT WORK FROM BRAINCHOP.ORG!!!
 */
CATEGORY = 'Hidden';
import("https://haehn.github.io/brainchop/brainchop-mainthread.js").then(({ runInference }) => {
  import("https://haehn.github.io/brainchop/brainchop-parameters.js").then(({ inferenceModelsList, brainChopOpts }) => {
    import("https://haehn.github.io/brainchop/brainchop-diagnostics.js").then(({ isChrome, localSystemDetails }) => {
      // const worker = new Worker("https://haehn.github.io/brainchop/brainchop-webworker.js", {
        // type: "module"
      // });


      async function ensureConformed() {
        const nii = Boostlet.framework.instance.volumes[0];
        let isConformed =
          nii.dims[1] === 256 && nii.dims[2] === 256 && nii.dims[3] === 256;
        if (
          nii.permRAS[0] !== -1 ||
          nii.permRAS[1] !== 3 ||
          nii.permRAS[2] !== -2
        ) {
          isConformed = false;
        }
        if (isConformed) {
          return;
        }
        const nii2 = await Boostlet.framework.instance.conform(nii, false);
        await Boostlet.framework.instance.removeVolume(Boostlet.framework.instance.volumes[0]);
        await Boostlet.framework.instance.addVolume(nii2);
      }
      async function closeAllOverlays() {
        while (Boostlet.framework.instance.volumes.length > 1) {
          await Boostlet.framework.instance.removeVolume(Boostlet.framework.instance.volumes[1]);
        }
      }
      async function callbackUI() {
        // do nothing
      }
      async function callbackImg(img, opts, modelEntry) {
          closeAllOverlays();
          const overlayVolume = await Boostlet.framework.instance.volumes[0].clone();
          overlayVolume.zeroImage();
          overlayVolume.hdr.scl_inter = 0;
          overlayVolume.hdr.scl_slope = 1;
          overlayVolume.img = new Uint8Array(img);
          const roiVolumes = await getUniqueValuesAndCounts(overlayVolume.img);
          console.log(roiVolumes);
          if (modelEntry.colormapPath) {
            const cmap = await fetchJSON('https://haehn.github.io/brainchop/public/'+modelEntry.colormapPath);
            const newLabels = await createLabeledCounts(roiVolumes, cmap["labels"]);
            console.log(newLabels);
            overlayVolume.setColormapLabel({
              R: cmap["R"],
              G: cmap["G"],
              B: cmap["B"],
              labels: newLabels,
            });
            // n.b. most models create indexed labels, but those without colormap mask scalar input
            overlayVolume.hdr.intent_code = 1002; // NIFTI_INTENT_LABEL
          } else {
            let colormap = opts.atlasSelectedColorTable.toLowerCase();
            const cmaps = Boostlet.framework.instance.colormaps();
            if (!cmaps.includes(colormap)) {
              colormap = "actc";
            }
            overlayVolume.colormap = colormap;
          }
          overlayVolume.opacity = 0.7;
          await Boostlet.framework.instance.addVolume(overlayVolume);
        }
        async function fetchJSON(fnm) {
          const response = await fetch(fnm);
          const js = await response.json();
          return js;
        }
        async function getUniqueValuesAndCounts(uint8Array) {
          // Use a Map to count occurrences
          const countsMap = new Map();

          for (let i = 0; i < uint8Array.length; i++) {
            const value = uint8Array[i];
            if (countsMap.has(value)) {
              countsMap.set(value, countsMap.get(value) + 1);
            } else {
              countsMap.set(value, 1);
            }
          }

          // Convert the Map to an array of objects
          const result = Array.from(countsMap, ([value, count]) => ({
            value,
            count,
          }));

          return result;
        }
        async function createLabeledCounts(uniqueValuesAndCounts, labelStrings) {
          if (uniqueValuesAndCounts.length !== labelStrings.length) {
            missingLabelStatus = "Failed to Predict Labels - "
            console.error(
              "Mismatch in lengths: uniqueValuesAndCounts has",
              uniqueValuesAndCounts.length,
              "items, but labelStrings has",
              labelStrings.length,
              "items.",
            );
          }

          return labelStrings.map((label, index) => {
            // Find the entry matching the current label index
            const entry = uniqueValuesAndCounts.find(item => item.value === index);

            // If an entry is found, append the count value with 'mm3', otherwise show 'Missing'
            const countText = entry ? `${entry.count} mm3` : "Missing";

            countText === "Missing"
            ? missingLabelStatus += `${label}, ` : null;

            return `${label}   ${countText}`;
          });
        }

      // ACTION STARTS
      closeAllOverlays();
      ensureConformed();
      const model = inferenceModelsList[1];
      const opts = brainChopOpts;
      // opts.rootURL should be the url without the query string
      const urlParams = new URL(window.location.href);
      // remove the query string
      opts.rootURL = 'https://haehn.github.io/brainchop/public';//urlParams.origin + urlParams.pathname;
      // if (workerCheck.checked) {
      //   if (typeof chopWorker !== "undefined") {
      //     console.log(
      //       "Unable to start new segmentation: previous call has not completed",
      //     );
      //     return;
      //   }
      //   chopWorker = await new MyWorker({ type: "module" });
      //   const hdr = {
      //     datatypeCode: nv1.volumes[0].hdr.datatypeCode,
      //     dims: nv1.volumes[0].hdr.dims,
      //   };
      //   const msg = {
      //     opts,
      //     modelEntry: model,
      //     niftiHeader: hdr,
      //     niftiImage: nv1.volumes[0].img,
      //   };
      //   chopWorker.postMessage(msg);
      //   chopWorker.onmessage = function (event) {
      //     const cmd = event.data.cmd;
      //     if (cmd === "ui") {
      //       if (event.data.modalMessage !== "") {
      //         chopWorker.terminate();
      //         chopWorker = undefined;
      //       }
      //       callbackUI(
      //         event.data.message,
      //         event.data.progressFrac,
      //         event.data.modalMessage,
      //         event.data.statData,
      //       );
      //     }
      //     if (cmd === "img") {
      //       chopWorker.terminate();
      //       chopWorker = undefined;
      //       callbackImg(event.data.img, event.data.opts, event.data.modelEntry);
      //     }
      //   };
      // } else {
        runInference(
          opts,
          model,
          Boostlet.framework.instance.volumes[0].hdr,
          Boostlet.framework.instance.volumes[0].img,
          callbackImg,
          callbackUI,
        );
      // }

      // You can use runInference and other modules now
      console.log("Inference environment ready");
    });
  });
});

