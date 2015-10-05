"use strict"

var jsc = require("../src/jsc");
var path = require("path");
var fs = require("fs");
var grunt = require("grunt");
var tests = [
	//------------------------------------------------------------------------------------------
	// GROUP        | FILEPATH
	//------------------------------------------------------------------------------------------
	[ "Operators", "./tests/files/additive-operators.js"],
	[ "Operators", "./tests/files/multiplicative-operators.js"],
	[ "Operators", "./tests/files/equality-operators.js"],
	[ "Operators", "./tests/files/logical-operators.js"],
	[ "Operators", "./tests/files/relational-operators.js"],
	[ "Operators", "./tests/files/bitwise-operators.js"],
	[ "Operators", "./tests/files/bitwise-shift-operators.js"],
	[ "Operators", "./tests/files/postfix-operators.js"],
	[ "Operators", "./tests/files/in-operator.js"],
	[ "Operators", "./tests/files/instanceof-operator.js"],
	[ "Operators", "./tests/files/unary-delete-operator.js"],
	[ "Operators", "./tests/files/unary-not-operator.js"],
	[ "Operators", "./tests/files/unary-plus-minus-operator.js"],
	[ "Operators", "./tests/files/unary-prefix-operator.js"],
	[ "Operators", "./tests/files/unary-typeof-operator.js"],
	[ "Operators", "./tests/files/unary-void-operator.js"],
	[ "Operators", "./tests/files/operator-new-01.js"],
	[ "Operators", "./tests/files/conditional.js"],

	[ "Accessors", "./tests/files/property-accessors.js"],
	[ "Accessors", "./tests/files/assign-property-accessors.js"],
	[ "Accessors", "./tests/files/assignment.js"],

	[ "Arrays", "./tests/files/arrays.js"],

	[ "New", "./tests/files/new-object-01.js"],

	[ "Constructors", "./tests/files/error-constructors.js"],
	[ "Constructors", "./tests/files/number-constructor-01.js"],

	[ "Functions", "./tests/files/function-as-constructor-call-01.js"],
	[ "Functions", "./tests/files/function-as-constructor-call-02.js"],
	[ "Functions", "./tests/files/function-call-01.js"],
	[ "Functions", "./tests/files/function.js"],

	[ "Loops", "./tests/files/do-while-iteration.js"],
	[ "Loops", "./tests/files/while-iteration.js"],
	[ "Loops", "./tests/files/for-in-iteration.js"],
	[ "Loops", "./tests/files/for-iteration.js"],
	[ "Loops", "./tests/files/for-loop-no-expressions.js"],
	[ "Loops", "./tests/files/for-loop-var-decl.js"],

	[ "Statement Blocks", "./tests/files/if-else.js"],
	[ "Statement Blocks", "./tests/files/switch.js"],
	[ "Statement Blocks", "./tests/files/throw.js"],
	[ "Statement Blocks", "./tests/files/try-catch-finally.js"],
];

(function() {
	for(var i = 0; i < tests.length; ++i)
	{
		var t = tests[i];
		var group = "  " + t[0];
		var obj = exports[group] || {};
		var name = path.basename(t[1], path.extname(t[1]));

		obj[name] = (function(file) {
			return function(test) {

				test.expect(2);

				fs.readFile(file, function(err, data) {
					test.ifError(err);

					jsc.parse(new jsc.SourceCode(data.toString(), path.resolve(file)), function(result, parseErr) {
						test.ok(result, parseErr && parseErr.message);
					});

					test.done();
				});

			};
		})(t[1]);

		exports[group] = obj;
	}
})();