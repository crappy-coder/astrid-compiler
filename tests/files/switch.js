/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		switch.js
 * Section:		Control Flow
 *
 * This tests the 'switch (<expr>) { case <expr>:' iteration statements:
 *
 ****************************************************************************/
var x = 1;

if(x == 1)
{
	switch(4)
	{
		case 1:
		{
				print("CASE 1");		
			break;
		}
		case "A":
			print("CASE 2");
			break;
		case 3:
			print("CASE 3");
			break;
		default:
			print("DEFAULT");
			break;
		case 4:
			print("CASE 4");
		case 5:
			print("CASE 5");
			break;
	}
}

print("DONE");