/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		do-while-iteration.js
 * Section:		Iterations
 *
 * This tests the 'do {...} while(<expr>)' iteration statement.
 *
 ****************************************************************************/
 
var x = 0;
var y = 1;
var z = 2;

var a = true;
var b = false;

do
{	
	if(x++ == 0)
	{
		continue;
	}

	if(x == 2)
	{
		break;
	}

} while(x <= z);