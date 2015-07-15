/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		for-iteration.js
 * Section:		Iterations
 *
 * This tests the 'for' iteration statements:
 *    - for( <init?>; <condition?>; <increment?>; ) {...}
 *    - for( var <init-var-decl-list>; <condition?>; <increment?>; ) {...}
 *
 ****************************************************************************/
 
var n = 0;
var len = 10;

for( var i = 0; i < len; ++i )
{
	console.log("FOR 1: " + i);
}


for( n; n < len; n++ )
{
	console.log("FOR 2: " + n);
}

n = 0;

for(;;)
{
	if(n == 10)
	{
		console.log("FOR 3: BREAK");
		break;
	}

	n++;
	console.log("FOR 3: " + n);
}

for(var x = true, y = 1; x; y = y * 2, x = (y <= 32));

console.log("Y = " + y);