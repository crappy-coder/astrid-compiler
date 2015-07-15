/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		assign-property-accessors.js
 * Section:		Property Accessors (Assignment)
 *
 * This tests the property assignment accessors for dot, bracket and 
 * expression accessors.
 *
 ****************************************************************************/

var obj = new Object();
var p1 = "e";

obj.a = 1;
obj.b = 2;
obj["c"] = 3;
obj["d"] = 4;
obj[p1] = 5;
obj.p2 = "f";
obj[obj.p2] = 6;
