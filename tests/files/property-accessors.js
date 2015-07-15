/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		property-accessors.js
 * Section:		Property Accessors (Assignment)
 *
 * This tests the property accessors for dot, bracket and expression accessors.
 *
 ****************************************************************************/

var obj1 = new Object();
var obj2 = new Object();
var p1 = "b";

// setup the objects first
obj1.a = 1;
obj1.b = 2;
obj1.c = "3";

obj2.x = 4;
obj2.y = "5";

obj1.o = obj2;

// assignment and resolve property accessors
obj2.a = obj1.a;
obj2.b = obj1[p1];
obj2.c = obj1["c"];

// resolve multi-name properties
var x = obj1.o.x;
var y = obj1["o"]["y"];

print(obj2.a, obj2.b, obj2.c, x, obj1["o"]["y"]);