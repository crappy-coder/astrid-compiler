/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		additive-operators.js
 * Section:		Additive Operators
 *
 * This tests the additive operators '+' and '-'.
 *
 ****************************************************************************/

var x = 0;
var y = 0;
var z = 0;
 
 
//********************************************
// integer operations
//
var a = 0;
var b = 1;
var c = 2;

// addition
x = a + 1;
y = b + 1;
z = c + 1;

x = 1 + a;
y = 1 + b;
z = 1 + c;


// subtraction
x = a - 1;
y = b - 1;
z = c - 1;

x = 1 - a;
y = 1 - b;
z = 1 - c;



//********************************************
// floating-point operations
//
var a = 0.0;
var b = 1.1;
var c = 2.2;

// addition
x = a + 1.5;
y = b + 1.5;
z = c + 1.5;

x = 1.5 + a;
y = 1.5 + b;
z = 1.5 + c;


// subtraction
x = a - 1.5;
y = b - 1.5;
z = c - 1.5;

x = 1.5 - a;
y = 1.5 - b;
z = 1.5 - c;



//********************************************
// string operations
//
var a = "one";
var b = "two";
var c = "three";

x = a + " " + b;
y = a + " " + b + " " + c;
z = a + b + c;

x = "1=" + a + ", 2=" + b + ", 3=" + c;
y = (a + b) + " " + c;
