/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		unary-delete-operator.js
 * Section:		Unary Operators
 *
 * This tests the 'delete' unary operator
 *
 ****************************************************************************/

var x = new Object();
var y = 2;
var propName = "c";

x.a = 1;
x.b = "2";
x.c = "3";

delete 1;

// DeleteResolveExpression
delete y;

// DeleteDotExpression [ResolvableExpression]
delete x.a;
delete x.a;

// DeleteBracketExpression [ResolvableExpression, StringExpression]
delete x["b"];

// DeleteBracketExpression [ResolvableExpression, ResolvableExpression]
delete x[propName];