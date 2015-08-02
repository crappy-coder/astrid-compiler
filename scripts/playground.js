"use strict"

var jsc = require("../src/jsc");
var fs = require("fs");
var file = "../tests/files/additive-operators.js";

fs.readFile(file, function(err, data) {
	var sc = new jsc.SourceCode(data.toString(), file);
	var result = jsc.parse(sc, true);
	
	console.log("");
	console.log("FEATURES: %d", result.features);
	console.log("CONSTANT COUNT: %d", result.constantCount);
	
	console.log("\nSTATEMENTS:");
	console.log(result.statements);
	
	console.log("\nFUNCTIONS:");
	console.log(result.functions);
	
	console.log("\nVARIABLES:");
	console.log(result.variables);
	
	console.log("\nCAPTURED VARIABLES:");
	console.log(result.capturedVariables);
});

;(function() {

})();
