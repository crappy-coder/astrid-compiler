/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		function-as-constructor-call-01.js 
 * Section:		Object Construction
 *
 * This tests creating an Object by calling a function as a constructor.
 *
 ****************************************************************************/

// FunctionDeclStatement
function Employee(a, b, c) {
	var y = 2;
	// ExpressionStatement
	//	-> AssignDotExpression (this.x = 1)
	//		-> ThisExpression (this)
	//		-> NumberExpression (1)
	this.x = 1;
}

// VarStatement (var e = new Employee())
//   -> AssignResolveExpression (e = new Employee())
//        -> NewExpression (new Employee())
//             -> ResolvableExpression (Employee)
var e = new Employee(1, 2, 3);

// VarStatement (var x = e.x)
//   -> AssignResolveExpression (x = e.x)
//        -> DotAccessorExpression (e.x)
//             -> ResolvableExpression (e)
var x = e.x;

//printf("%s\n", e);
console.log(x, e);