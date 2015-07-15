/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		if-else.js
 * Section:		Control Flow (if/else)
 *
 * This tests the if, else if and else statements (or just if/else), else if
 * is simply defined as else + an if statement and not a specific 'else if'.
 *
 ****************************************************************************/

var x = 1 + 1;
var y = 2;
var z = 3;

var a = true;
var b = false;

if(x == y)
	console.log("OK");

if(x == z)
	console.log("NOT OK");
else
	console.log("OK");
	
if(x == z)
	console.log("NOT OK");
else if(y == z)
	console.log("NOT OK");
else if(a)
{
	if(x != y)
		console.log("NOT OK");
	else if(x == z)
		console.log("NOT OK");
	else
		console.log("OK");
}
else
	console.log("NOT OK");

a = false;
b = true;
x = y;