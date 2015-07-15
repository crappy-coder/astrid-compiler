/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		bitwise-shift-operators.js
 * Section:		Bitwise Operators
 *
 * This tests the bitwise shift operators '<<', '>>' and '>>>'.
 *
 ****************************************************************************/

var x = 1;
var y = 2;
var z = 3;
 
var a = 1 << 1;
var b = 1 << 2;
var c = 1 << 3;
var d = 1 << 4;
var e = 1 << 5;

a = x << 1;
b = x << 2;
c = x << 3;
d = x << 4;
e = x << 5;

a = x << y;

x = 32;
a = x >> 1;
b = a >> 1;
c = b >> 1;

a = x >> 2;

x = -32;
a = x >> 1;
b = a >> 1;
c = b >> 1;

a = x >> 2;

x = 32;
a = x >>> 1;
b = a >>> 1;
c = b >>> 1;

a = x >>> 2;

x = -32;
a = x >>> 1;
b = a >>> 1;
c = b >>> 1;

a = x >>> 2;
