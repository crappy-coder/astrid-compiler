/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		in-operator.js
 * Section:		Relational Operators
 *
 * This tests the 'in' relational operator.
 *
 ****************************************************************************/

var obj = new Object();
obj.x = 1;
obj.y = 2;

var r;
var x = "x";
var z = "z";

r = "x" in obj; // true
r = "y" in obj;// true
r = "z" in obj;// false
r = x in obj; // true
r = z in obj; // false