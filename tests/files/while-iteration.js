/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		while-iteration.js
 * Section:		Iterations
 *
 * This tests the 'while(<expr>) {...}' iteration statement.
 *
 ****************************************************************************/
 
var x = 0;
var y = 1;
var z = 2;

var a = true;
var b = false;

if(x == 1)
	print("NOT OK");

if(x == 0)
	print("OK");

while(x <= z)
{
	print("ITERATION: " + x);
	
	if(x++ == 0)
		continue;
	
	print("NEXT " + x);
	
	if(x == 2)
	{
		print("BREAK");
		break;
	}
}

print("DONE");