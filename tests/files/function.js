/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		function.js
 * Section:		Functions
 *
 * This tests the various function styles and statements:
 *  - dot accessor i.e. base.func()
 *  - bracket accessor i.e. base["func"]()
 *  - normal i.e. func()
 *  - value i.e. func()()
 *
 ****************************************************************************/
var obj = new Object();
obj.A = function() { return 1; }

function B() {
	return 2;
}
 
function C() {
	return function() { return 3; }
}

function D() {
	var f = function foo() {
		return 4;
	}
	
	return f();
}

var a1 = obj.A();
var a2 = obj["A"]();
var b = B();
var c = C()();
var d = D();

console.log(a1);
console.log(a2);
console.log(b);
console.log(c);
console.log(d);