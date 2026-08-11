const { JSDOM } = require('jsdom');
const dom = new JSDOM();
const img = new dom.window.Image();
// simulate
console.log('width:', img.width, 'naturalWidth:', img.naturalWidth);
