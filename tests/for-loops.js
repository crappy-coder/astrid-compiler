"use strict"

var jsc = require("../src/jsc");
var fs = require("fs");

/*
	for ( [Expression] ; [Expression] ; [Expression] ) Statement
	for ( var VariableDeclarationList; [Expression] ; [Expression] ) Statement
	for ( LexicalDeclaration [Expression] ; [Expression] ) Statement
*/

exports["Expressions"] = {
	"None": function(test) {
		test.expect(2);

		fs.readFile("./tests/files/for-loop-no-expressions.js", function(err, data) {
			test.ifError(err);
			test.ok(jsc.parse(data.toString()));
			test.done();
		});
	}
};