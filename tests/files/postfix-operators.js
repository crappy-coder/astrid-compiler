/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		postfix-operators.js
 * Section:		Postfix Operators
 *
 * This tests the 'postfix' increment (X++) and decrement (X--) operators
 *
 ****************************************************************************/

var x = 0;
var y = 2;

// AssignResolveExpression[x1, PostfixResolveExpression[OpPlusPlus, x]]
var x1 = x++;

// AssignResolveExpression[x2, PostfixResolveExpression[OpPlusPlus, x]]
var x2 = x++;

// AssignResolveExpression[y1, PostfixResolveExpression[OpMinusMinus, y]]
var y1 = y--;
// AssignResolveExpression[y2, PostfixResolveExpression[OpMinusMinus, y]]
var y2 = y--;

// PostfixResolveExpression[OpPlusPlus, x]
x++;
// PostfixResolveExpression[OpMinusMinus, y]
y--;

// AssignResolveExpression[a, PostfixErrorExpression[OpPlusPlus, NumberExpression[1]]]
var a = 1++;

// AssignResolveExpression[b, PostfixErrorExpression[OpMinusMinus, NumberExpression[1]]]
var b = 1--;

print(x, y, a, b);

var obj = new Object();
obj.x = 0;
obj.y = 2;

// AssignResolveExpression[ox1, PostfixDotExpression[OpPlusPlus, ResolvableExpression[obj], x]]
var ox1 = obj.x++;
// AssignResolveExpression[ox2, PostfixBracketExpression[OpPlusPlus, ResolvableExpression[obj], StringExpression[x]]]
var ox2 = obj["x"]++;

// AssignResolveExpression[oy1, PostfixDotExpression[OpMinusMinus, ResolvableExpression[obj], y]]
var oy1 = obj.y--;
// AssignResolveExpression[oy2, PostfixBracketExpression[OpMinusMinus, ResolvableExpression[obj], StringExpression[y]]]
var oy2 = obj["y"]--;

print(obj.x, obj.y, ox1, ox2, oy1, oy2);
