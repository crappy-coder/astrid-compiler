/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		for-in-iteration.js
 * Section:		Iterations
 *
 * This tests the 'for..in' iteration statements:
 *    - for( <expr> in <expr> ) {...}
 *    - for( var <var-decl> in <expr> ) {...}
 *
 ****************************************************************************/

var obj = new Object();
obj.a = "A";
obj.b = "B";
obj.c = "C";
obj.x = 1;
obj.y = 2;
obj.z = 3;
obj.t = true;
obj.u = false;
 
// ForInStatement[id=p, left=ResolvableExpression[id=p], right=ResolvableExpression[id=obj], init=null]
for(var p in obj)
{
	console.log("FOR 1: " + p + " : " + obj[p]);
}

// ForInStatement[id=null, left=DotAccessorExpression[id=a, base=ResolvableExpression[id=obj]], right=ResolvableExpression[id=obj], init=null]

for(obj.a in obj)
{
	console.log(obj.a);
}

var f = 1;

for(f in obj)
{
	console.log("FOR 2: " + f + " : " + obj[f]);
}

for(var p in obj)
{
	console.log("FOR 3: " + p + " : " + obj[p]);

	if(p == "x")
	{
		console.log("FOR 3: BREAK");
		break;
	}
}