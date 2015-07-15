/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		bitwise-operators.js
 * Section:		Bitwise Operators
 *
 * This tests the binary bitwise AND (&), OR (|) and XOR (^) operators.
 *
 ****************************************************************************/

var x = 5;
var y = 13;
var r;

r = x | y; 			// 13
r = 5 | 13;			// 13

r = x & y;			// 5
r = 5 & 13;			// 5

r = x ^ y;			// 8
r = 5 ^ 13;			// 8
r = 5 ^ "13";		// 8
r = "5" ^ "13";		// 8

r = true ^ true;	// 0
r = true ^ false;	// 1