//"use strict"

// var utils = require("../src/utils");
// var lex = require("../src/lexer");
// var token = require("../src/token");
// var fs = require("fs");

// fs.readFile("../tests/files/additive-operators.js", function(err, data) {
	// var lexer = lex.create(data.toString(), "../tests/files/additive-operators.js");
	// var tok = new token();
	// var tokType;

	// while((tokType = lexer.nextToken(tok, false)) !== token.Kind.EOF) {
		// console.log(tok, tokType);
	// }
// });

// var utils = require("../src/utils");
// var source = require("../src/source-code");
// var parse = require("../src/parser");
// var fs = require("fs");

// var file = "../tests/files/additive-operators.js";

// fs.readFile(file, function(err, data) {
	// var sc = new source.SourceCode(data.toString(), file);
	// var parser = parse.create(sc);
	// parser.debugMode = true;

	// var program = parser.parse();

	// console.log(program);
// });


//var jsc = jsc || {};
//jsc.AST = jsc.AST || {};
//
//jsc.AST.Node = function Node(x) {
//	this.x = x;
//};
//
//jsc.AST.Node.prototype = {
//	constructor: jsc.AST.Node,
//	get value() {
//		return this.x;
//	}
//};
//
//jsc.AST.Expression = function Expression(x, y) {
//	jsc.AST.Node.call(this, x);
//
//	this.y = y;
//};
//
//jsc.AST.Expression.prototype = Object.create(jsc.AST.Node.prototype);
//jsc.AST.Expression.prototype.constructor = jsc.AST.Expression;
//
//Object.defineProperty(jsc.AST.Expression.prototype, "value", {
//	get: function() { return this.x + this.y; }
//});
//
//var n = new jsc.AST.Node(2);
//var e = new jsc.AST.Expression(2, 4);
//
//console.log(n, n.value, n.constructor);
//console.log(e, e.value, e.constructor);
var jsc = require("../src/jsc");
var utils = require("../src/utils");

jsc.AST.Expression = Object.define({
    initialize: function(x) {
        this._value = x;
    },

    getValue: function() {
        return this._value;
    },

    get value() {
        return this._value;
    },

    set value(v) {
        this._value = v;
    }
});

jsc.AST.NewExpression = Object.define(jsc.AST.Expression, {
    initialize: function(x, y) {
        this.base.initialize.call(this, x);
        this.y = y;
    },

    getValue: function() {
        return this.base.getValue.call(this);
    }
});

var a = jsc.AST.Expression;
var aa = new a(10);

var b = jsc.AST.NewExpression;
var bb = new b(20, 30);

console.log(bb.value);
console.log(bb.getValue());