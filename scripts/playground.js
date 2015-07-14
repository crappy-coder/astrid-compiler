"use strict"

var utils = require("../src/utils");
var text = require("../src/text");

var tb = new text.TextBuffer("FOO BAR!", text.TextBuffer.ENCODING.UTF16);

console.log(tb);
console.log(tb.toString());

tb.forEach(function(ch, chIndex, index, source) {
	console.log(ch, chIndex, index);
});