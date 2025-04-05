
import("https://haehn.github.io/brainchop/brainchop-mainthread.js").then(({ runInference }) => {
  import("https://haehn.github.io/brainchop/brainchop-parameters.js").then(({ inferenceModelsList, brainChopOpts }) => {
    import("https://haehn.github.io/brainchop/brainchop-diagnostics.js").then(({ isChrome, localSystemDetails }) => {
      const worker = new Worker("https://haehn.github.io/brainchop/brainchop-webworker.js", {
        type: "module"
      });

      // You can use runInference and other modules now
      console.log("Inference environment ready");
    });
  });
});

