/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		instanceof-operator.js
 * Section:		Relational Operators
 *
 * This tests the 'instanceof' relational operator.
 *
 ****************************************************************************/

var r;
 
var obj = new Object();
var n = new Number(1);
var b = new Boolean(false);
var str = new String("x");

r = obj instanceof Object;
print(r); // true

r = obj instanceof String;
print(r); // false

r = obj instanceof Number;
print(r); // false



r = n instanceof Object;
print(r); // true

r = n instanceof Number;
print(r); // true

r = n instanceof String;
print(r); // false


r = b instanceof Object;
print(r); // true

r = b instanceof Number;
print(r); // false

r = b instanceof String;
print(r); // false



r = str instanceof Object;
print(r); // true

r = str instanceof Number;
print(r); // false

r = str instanceof String;
print(r); // true