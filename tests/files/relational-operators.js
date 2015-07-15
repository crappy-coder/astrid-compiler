/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		relational-operators.js
 * Section:		Relational Operators
 *
 * This tests the relational operators '<', '<=', '>', '>='. Even though the
 * 'instanceof' and 'in' operators are considered relational as per the ECMA
 * spec, these are defined in their own seperate test cases.
 *
 ****************************************************************************/

var a = 0;
 
var x1 = 1;
var y1 = 1.2;
var z1 = "one";

var x2 = 1;
var y2 = 1.2;
var z2 = "one";

var x3 = 2;
var y3 = 2.2;
var z3 = "two";

// ****************************
// less than
a = 1 < 1;
print(a); // false

a = 1 < 2;
print(a); // true

a = 2 < 1;
print(a); // false

a = true < false;
print(a); // false

a = false < true;
print(a); // true

a = "x" < "y";
print(a); // true

a = "y" < "x";
print(a); // false

a = x1 < x2;
print(a); // false

a = x1 < x3;
print(a); // true

a = y1 < y2;
print(a); // false

a = y1 < y3;
print(a); // true

a = z1 < z2;
print(a); // false

a = z1 < z3;
print(a); // true


// ****************************
// less than or equal to
a = 1 <= 1;
print(a); // true

a = 1 <= 2;
print(a); // true

a = 2 <= 1;
print(a); // false

a = x1 <= x2;
print(a); // true

a = x1 <= x3;
print(a); // true

a = y1 <= y2;
print(a); // true

a = y1 <= y3;
print(a); // true

a = z1 <= z2;
print(a); // true

a = z1 <= z3;
print(a); // true


// ****************************
// greater than
a = 1 > 1;
print(a); // false

a = 1 > 2;
print(a); // false

a = 2 > 1;
print(a); // true

a = x1 > x2;
print(a); // false

a = x1 > x3;
print(a); // false

a = y1 > y2;
print(a); // false

a = y1 > y3;
print(a); // fakse

a = z1 > z2;
print(a); // false

a = z1 > z3;
print(a); // false


// ****************************
// greater than or equal to
a = 1 >= 1;
print(a); // true

a = 1 >= 2;
print(a); // false

a = 2 >= 1;
print(a); // true

a = x1 >= x2;
print(a); // true

a = x1 >= x3;
print(a); // false

a = y1 >= y2;
print(a); // true

a = y1 >= y3;
print(a); // false

a = z1 >= z2;
print(a); // true

a = z1 >= z3;
print(a); // false
