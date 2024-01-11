/**
 * AnnotationHelper.js
 * 
 * Manages annotations for the Axolotl Project
 * 
 * By Nicholas Verrochi and Vidhya Sree N
 */

class AnnotationHelper {

    anno; // the annotorious plugin
    localStorageKey; // key to retrieve data from localStorage

    /**
     * 
     * @param {OpenSeadragon} viewer 
     */
    constructor(viewer) {
        this.anno = OpenSeadragon.Annotorious(viewer);
        this.localStorageKey = viewer.tileSources[0] + "_annotations";

        // check if annotations saved in localStorage
        let annotations = JSON.parse(localStorage.getItem(this.localStorageKey));
        if (annotations != null) {
            this.anno.setAnnotations(annotations);
        }

        // setup handlers for saving and loading
        this.anno.on("createAnnotation", this.saveAnnotations.bind(this));
        this.anno.on("updateAnnotation", this.saveAnnotations.bind(this));
        this.anno.on("deleteAnnotation", this.saveAnnotations.bind(this));

        // remove annotations on reset
        document.addEventListener("measurements-reset", () => {
            this.anno.clearAnnotations()
        });
    }

    /**
     * saveAnnotations:
     * 
     * Pulls annotations already made and saves them in localStorage
     */
    saveAnnotations() {
        let json = JSON.stringify(this.anno.getAnnotations());
        localStorage.setItem(this.localStorageKey, json);
    }
}