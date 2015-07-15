/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		try-catch-finally.js
 * Section:		Error Handling
 *
 * This tests the 'try {...} catch(<expr>) {...} finally {...}' statements.
 *
 ****************************************************************************/

function foo() {
	print("FOO BEGIN");
	
	try
	{
		print("FOO TRY BEGIN");
		throw 123;
		print("FOO TRY END");
	}
	finally
	{
		print("FOO FINALLY");
	}
	
	print("FOO END");
}

try 
{
	foo();
}
catch(e) 
{
	print("FOO THREW ERROR: " + e);
}

print("DONE");