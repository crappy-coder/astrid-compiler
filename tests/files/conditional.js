/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		conditional.js
 * Section:		Control Flow / Conditional
 *
 * This tests the '<condition> ? <true-expr> : <false-expr>' expression.
 *
 ****************************************************************************/
var x = 0;
var y = 5;
var z = "One";

var b1 = false;
var b2 = true;

var a1 = null ? 1 : 2;
var a2 = undefined ? 1 : 2;
var a3 = true ? 1 : 2;
var a4 = false ? 1 : 2;
var a5 = 1 ? 1 : 2;
var a6 = 10 ? 1 : 2;
var a7 = 0 ? 1 : 2;
var a8 = "yes" ? 1 : 2;
var a9 = true ? null : undefined;
var a10 = false ? undefined : null;

var v1 = x == 0 ? y : z;
var v2 = x == 1 ? y : z;
var v3 = 0;

v3 = y >= 5 ? "yes" : "no";

var v4 = b1 ? 1 : b2 ? 2 : 3;
var v5 = 0;

b2 ? v5 = 1 : v5 = 2;