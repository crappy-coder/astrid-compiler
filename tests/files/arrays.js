/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		arrays.js
 * Section:		Arrays
 *
 * Tests the array initializer '[element0, element1, ..., elementN]' 
 * expression
 ****************************************************************************/

 /*
	var a1 = [0,1,2,,4];	// length=5
	var a2 = [0,,];			// length=2
	var a3 = [,];			// length=1
	var a4 = [,,];			// length=2
	var a5 = [,1,2,3];		// length=4
	var a6 = [,1,2,3,];		// length=4
	var a7 = [0,1,,,4];		// length=5
 */
 
var v1 = 0;
var v2 = 1;
var v3 = "a";
var v4 = "b";
var a1 = [];
var a2 = [,];
var a3 = [,,];
var a4 = [0];
var a5 = [0,1];
var a6 = [0,1,2,,4];
var a7 = [,1,2,3,4];
var a8 = [0,1,2,3,];
var a9 = [0,"a"];
var a10 = ["a", "b"];
var a11 = [0, v1, 1, v2];
var a12 = [v3];
var a13 = [v3, v4];
var a14 = [v1, v3, v2, v4];
