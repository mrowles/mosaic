var Mosaic = (function () {

  'use strict';

  var $canvasMosaic = document.getElementById('canvas-mosaic');
  var $fileUploader = document.getElementById('image-uploader');
  var canvasMosaicCtx = $canvasMosaic.getContext('2d');

  /**
   * Mosaic
   */
  function Mosaic() {
    this.items = [];
    this.max = 0;
  }

  /**
   * Convert an RGB component to hex
   * @param c - RGB component
   * @returns {string}
   */
  function convertRgbComponentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  /**
   * Convert an RGB value to Hex
   * @param r - red hex valie
   * @param g - green hex value
   * @param b - blue hex value
   * @returns {string}
   */
  function convertRgbToHex(r, g, b) {
    var hex = '#FFFFFF';

    if (!r || !g || !b) {
      return hex;
    }

    hex = '#' + convertRgbComponentToHex(r) + convertRgbComponentToHex(g) + convertRgbComponentToHex(b);

    return hex;
  }

  /**
   * Compute average RGB of given Canvas data
   * @param imgData - image data pulled from canvas
   * @returns {{r: number, g: number, b: number}}
   */
  function getAverageRgbOfCanvas(imgData) {
    var BLOCKSIZE = 1;
    var DATA_LEN = imgData.data.length;
    var rgb = {
      r: 0,
      g: 0,
      b: 0
    };
    var i = -4;
    var count = 0;

    // Loop through the pixels in the block and gather the correct rgb values
    while (( i += BLOCKSIZE * 4 ) < DATA_LEN) {
      ++count;
      rgb.r += imgData.data[i];
      rgb.g += imgData.data[i + 1];
      rgb.b += imgData.data[i + 2];
    }

    // Correctly assign the floored r,g,b values to the object
    rgb.r = Math.floor(rgb.r / count);
    rgb.g = Math.floor(rgb.g / count);
    rgb.b = Math.floor(rgb.b / count);

    return rgb;
  }


  function defer() {
    var resolve;
    var reject;
    var promise = new Promise(function (a, b) {
      resolve = a;
      reject = b;
    });

    return {
      resolve: resolve,
      reject: reject,
      promise: promise
    };
  }

  /**
   * Builds service information related to each tile
   * @param canvasContext - context of canvas sourcing tile information for
   * @param height - height of image
   * @param width - width of image
   * @returns {Array} of tile rows
   */
  function buildTileServices(canvasContext, height, width) {
    var imgData;
    var rgb = '';
    var hex = '';
    var service = '';
    var mosaicRow = [];
    var tiles = [];

    for (var col = 0; (col + TILE_WIDTH) < height; col += TILE_WIDTH) {
      mosaicRow = [];

      for (var row = 0; (row + TILE_HEIGHT) < width; row += TILE_HEIGHT) {

        imgData = canvasContext.getImageData(row, col, TILE_WIDTH, TILE_HEIGHT);

        rgb = getAverageRgbOfCanvas(imgData);
        hex = convertRgbToHex(rgb.r, rgb.g, rgb.b);
        service = '/color/' + hex.split('#')[1];

        mosaicRow.push(service);
      }

      tiles.push(mosaicRow);
    }

    return tiles;
  }

  /**
   * Queue up array of items for processing
   * @param array - array of items for deferring
   * @returns {Promise}
   */
  Mosaic.prototype.queueItems = function (array) {
    if (!Array.isArray(array)) {
      array = [array];
    }

    if (array.length > this.max) {
      this.max = array.length;
    }
    var deferred = defer();

    this.items.push({
      collection: array,
      deferred: deferred
    });

    return deferred.promise;
  };

  /**
   * Preload collection of tiles for processing
   */
  Mosaic.prototype.preloadTiles = function () {
    for (var i = 0; i < this.max; i++) {
      this.items.forEach(function (item) {
        if (typeof item.collection[i] !== 'undefined') {
          item.collection[i] = this.preloadImage(item.collection[i]);
        }
      }, this);
    }
  };

  /**
   * Draw resolved rows of tiles on canvas
   */
  Mosaic.prototype.drawTiles = function () {
    var x = 0;
    var y = 0;

    this.items.forEach(function (item) {

      Promise.all(item.collection).then(
        // success
        function (row) {
          x = 0;

          row.forEach(function (img) {
            var path = img.path ? img.path[0] : img.target;
            canvasMosaicCtx.drawImage(path, x, y, TILE_WIDTH, TILE_HEIGHT);
            x = x + TILE_HEIGHT;
          });

          y = y + TILE_WIDTH;
        },
        // error
        function (err) {
          console.error('Error resolving all item promises: ', err);
        }
      );

    });
  };

  /**
   *  Load a file from the fileuploaded
   */
  Mosaic.prototype.loadFile = function () {
    return new Promise(function (resolve) {
      var fileUpload = new FileReader();

      if ($fileUploader.files.length < 1) {
        alert('Please supply a file');
        console.error('No file supplied');
        return;
      }

      var image = $fileUploader.files[0];

      if (image.type.indexOf('image') === -1) {
        alert('Please supply an image file (png, gif, jpg, bmp');
        console.error('Not an image supplied');
        return;
      }

      fileUpload.onload = resolve;
      fileUpload.onerror = resolve;
      fileUpload.readAsDataURL(image);
    });
  };

  /**
   * Preload an image
   * @param path - path of image to preload
   * @returns {Promise}
   */
  Mosaic.prototype.preloadImage = function (path) {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = path;
    });
  };

  /**
   * Creates the mosaic information
   * @param image - image to create mosaic data about
   * @returns {*} - array of tile information
   */
  Mosaic.prototype.createMosaicData = function (image) {
    var width = image.width;
    var height = image.height;

    $canvasMosaic.width = image.width;
    $canvasMosaic.height = image.height;

    var $canvasEl = document.createElement('canvas');
    $canvasEl.width = width;
    $canvasEl.height = height;

    var inMemoryCanvasCtx = $canvasEl.getContext('2d');
    inMemoryCanvasCtx.drawImage(image, 0, 0);

    var tiles = buildTileServices(inMemoryCanvasCtx, height, width);

    return tiles;
  };

  /**
   * Builds mosaic based on image processing
   * @param tiles - tiles to queue, preload and draw
   */
  Mosaic.prototype.buildMosaic = function (tiles) {
    var self = this;
    tiles.forEach(function (row) {
      self.queueItems(row).then(
        // success
        function () {

        },
        // error
        function (err) {
          console.error('Error queueing up tile:', err);
        });
    });

    self.preloadTiles();
    self.drawTiles();
  };

  return Mosaic;

}());

var mosaic = new Mosaic();

/**
 * The mosaic function which processes the uploaded image into a mosaic
 * Note: known Safari bug, will fix
 */
function processImageToMosaic() {

  'use strict';

  mosaic.loadFile(this).then(
    // success
    function (file) {
      var imgFile = file.target.result;

      mosaic.preloadImage(imgFile).then(
        //success
        function (img) {
          var imgPath = img.path ? img.path[0] : img.target;
          var tiles = mosaic.createMosaicData(imgPath);
          mosaic.buildMosaic(tiles);
        },
        //error
        function (err) {
          console.error('Error preloading image: ', err);
        }
      );
    },
    // error
    function (err) {
      console.error('Error loading load: ', err);
    }
  );
}
