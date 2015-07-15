/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		unary-typeof-operator.js
 * Section:		Unary Operators
 *
 * This tests the 'typeof' unary operator
 *
 ****************************************************************************/
 
var a = void(0);
var b = null;
var c = true;
var d = 12;
var e = "foo";
var f = new Object();

var type_a = typeof(a);
var type_b = typeof b;
var type_c = typeof c;
var type_d = typeof(d);
var type_e = typeof(e);
var type_f = typeof f;

print("typeof-resolve:");
print(type_a, type_b, type_c, type_d, type_e, type_f);

var type_a = typeof(void(1));
var type_b = typeof null;
var type_c = typeof true;
var type_d = typeof(12);
var type_e = typeof("foo");
var type_f = typeof new Object();
var type_g = typeof this;

print("typeof-value:");
print(type_a, type_b, type_c, type_d, type_e, type_f, type_g);