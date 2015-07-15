/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		unary-void-operator.js
 * Section:		Unary Operators
 *
 * This tests the 'void' unary operator
 *
 ****************************************************************************/

var n = 0;
var a = void(0);
var b = void(n);
var c = void 0;
var d = void n;
var e = void(n+1);
var f = void(n = n + 1); // n=1
var g = void(n = n + 1, n = n + 1); // n=3

void(void(0));
void(null);
void(0);
void(n);
void 0;
void n;