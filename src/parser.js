var jsc = jsc || {};

console.log("parser:load");

jsc.Parser = function(options) {
	console.log("parser:init");
	console.log(options);
}

jsc.Parser.prototype = {

	parse: function(sourceText) {
		console.log("parser:parse");
		console.log(sourceText);
	}
	
}

module.exports = {
	create: function(options) {
		return new jsc.Parser(options);
	}
}