/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		unary-not-operator.js
 * Section:		Unary Operators
 *
 * This tests the bitwise '~' and logical '!' NOT unary operators ~<expr> and !<expr>.
 *
 ****************************************************************************/

var x = ~1;
var y = 1;

print(x, y);

x = ~x;
y = ~y;

print(x, y);

x = 1;
y = !1;

print(x, y);

x = !x;
y = !y;

print(x, y);