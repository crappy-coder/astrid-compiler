/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		multiplicative-operators.js
 * Section:		Multiplicative Operators
 *
 * This tests the multiplicative operators '*', '/' and '%'.
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

// multiplication
x = a * 1;
y = b * 1;
z = c * 1;

print(x, y, z);

x = 1 * a;
y = 1 * b;
z = 1 * c;

print(x, y, z);


// division
x = a / 1;
y = b / 1;
z = c / 1;

print(x, y, z);

x = 1 / a; // divide by zero
y = 1 / b;
z = 1 / c;

print(x, y, z);


// modulus
x = a % 1;
y = b % 1;
z = c % 1;

print(x, y, z);

x = 1 % a;
y = 1 % b;
z = 1 % c;

print(x, y, z);



//********************************************
// floating-point operations
//
var a = 0.0;
var b = 1.1;
var c = 2.2;

// multiplication
x = a * 1.5;
y = b * 1.5;
z = c * 1.5;

print(x, y, z);

x = 1.5 * a;
y = 1.5 * b;
z = 1.5 * c;

print(x, y, z);


// division
x = a / 1.5;
y = b / 1.5;
z = c / 1.5;

print(x, y, z);

x = 1.5 / a; // divide by zero
y = 1.5 / b;
z = 1.5 / c;

print(x, y, z);


// modulus
x = a % 1.5;
y = b % 1.5;
z = c % 1.5;

print(x, y, z);

x = 1.5 % a;
y = 1.5 % b;
z = 1.5 % c;

print(x, y, z);