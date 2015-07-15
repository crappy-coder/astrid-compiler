/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		logical-operators.js
 * Section:		Logical Operators
 *
 * This tests the binary logical AND (&&) and OR (||) operators.
 *
 ****************************************************************************/

var vTrue = true;
var vFalse = false;
var vStr1 = "1";
var vObj = new Object();
var vNull = null;
var vUndefined;
var r;

r = 5 && 13;
print(r); // 13

r = vTrue && vTrue;
print(r); // true

r = vFalse && vFalse;
print(r); // false

r = vTrue && vFalse;
print(r); // false

r = vTrue && vStr1;
print(r); // "1"


r = 5 || 13;
print(r); // 5

r = vStr1 || null;
print(r); // "1"

r = vStr1 || vNull;
print(r); // "1"

r = vStr1 || vUndefined;
print(r); // "1"

r = null || vStr1;
print(r); // "1"

r = vNull || vStr1;
print(r); // "1"

r = vUndefined || vStr1;
print(r); // "1"

r = vObj || null;
print(r); // vObj

r = vObj || vNull;
print(r); // vObj

r = vObj || vUndefined;
print(r); // vObj

r = null || vObj;
print(r); // vObj

r = vNull || vObj;
print(r); // vObj

r = vUndefined || vObj;
print(r); // vObj

r = vNull || false;
print(r); // false;

r = vNull || true;
print(r); // true;

r = true || vNull;
print(r); // true;

r = false || vNull;
print(r); // null;