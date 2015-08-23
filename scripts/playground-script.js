/****************************************************************************
 *                          COMMENTS                             
 * --------------------------------------------------------------------------
 *
 * File: 		playground-script.js
 *
 * This is a test script for the playground.
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


function Employee(a, b, c) {
	var y = 2;

	this.x = 1;
}

var e = new Employee(1, 2, 3);
var x = e.x;

function add(x, y)
{
	return x + y;
}

var a = add(1, 2);