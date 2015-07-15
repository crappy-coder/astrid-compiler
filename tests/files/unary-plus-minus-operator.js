/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		unary-plus-minus-operator.js
 * Section:		Unary Operators
 *
 * This tests the '+' and '-' unary operators +<expr> and -<expr>.
 *
 ****************************************************************************/

var x = 0;
var y = 0;
var a = 0;
var b = 0;

// AssignResolveExpression[x, UnaryPlusExpression[NumberExpression[1]]]
x = +1; // x=1
// AssignResolveExpression[x, NumberExpression[-1]]
y = -1; // y=-1

print(x, y);

// AssignResolveExpression[a, NegateExpression[ResolvableExpression[x]]]
a = -x; // a=-1

// AssignResolveExpression[b, UnaryPlusExpression[ResolvableExpression[y]]]
b = +y; // b=1

print(x, y, a, b);

// AssignResolveExpression[a, NegateExpression[ResolvableExpression[a]]]
a = -a; // a=1

// AssignResolveExpression[b, NegateExpression[ResolvableExpression[b]]]
b = -b; // b=-1

print(x, y, a, b);

x = 1.02;
y = 402.0001;

print(x, y);

a = -x; // a=-1.02
print(x, a);
a = +x; // a=1.02
print(x, a);

b = -y; // b=-402.0001
print(y, b);
b = +y; // b=402.0001
print(y, b);


