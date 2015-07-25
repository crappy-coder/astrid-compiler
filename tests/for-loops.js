"use strict"

var jsc = require("../src/jsc");
var fs = require("fs");
var grunt = require("grunt");

exports["Expressions"] = {
	"None": function(test) {
		test.expect(2);

		fs.readFile("./tests/files/for-loop-no-expressions.js", function(err, data) {
			test.ifError(err);
			test.ok(jsc.parse(data.toString()));
			test.done();
		});
	},
	
	"Variable-Declaration": function(test) {
		test.expect(2);

		fs.readFile("./tests/files/for-loop-var-decl.js", function(err, data) {
			test.ifError(err);
			test.ok(jsc.parse(data.toString()));
			test.done();
		});
	}
};