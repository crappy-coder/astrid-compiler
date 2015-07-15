/****************************************************************************
 *                       MoEnjin LLVM Compilation Test                       
 * -------------------------------------------------------------------------
 *
 * File: 		unary-prefix-operator.js
 * Section:		Unary Operators
 *
 * This tests the 'prefix' unary operators ++<expr> and --<expr>.
 *
 ****************************************************************************/

var x = 0;
var y = 2;

// AssignResolveExpression -> PrefixResolveExpression[OpPlusPlus]
var x1 = ++x;
// AssignResolveExpression -> PrefixResolveExpression[OpPlusPlus]
var x2 = ++x;

// AssignResolveExpression -> PrefixResolveExpression[OpMinusMinus]
var y1 = --y;
// AssignResolveExpression -> PrefixResolveExpression[OpMinusMinus]
var y2 = --y;

// PrefixResolveExpression[OpPlusPlus]
++x;
// PrefixResolveExpression[OpMinusMinus]
--y;

// AssignResolveExpression -> PrefixErrorExpression[OpPlusPlus, NumberExpression]
var a = ++1;

// AssignResolveExpression -> PrefixErrorExpression[OpMinusMinus, NumberExpression]
var b = --1;

print(x, y, a, b);

var obj = new Object();
obj.x = 0;
obj.y = 2;

// AssignResolveExpression[ox1, PrefixDotExpression[ResolvableExpression[obj], x, OpPlusPlus]]
var ox1 = ++obj.x;
// AssignResolveExpression -> PrefixBracketExpression[OpPlusPlus]
var ox2 = ++obj["x"];

// AssignResolveExpression -> PrefixDotExpression[OpMinusMinus]
var oy1 = --obj.y;
// AssignResolveExpression -> PrefixBracketExpression[OpMinusMinus]
var oy2 = --obj["y"];

print(obj.x, obj.y, ox1, ox2, oy1, oy2);
