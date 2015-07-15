/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		assignment.js
 * Section:		Assignment
 *
 * This tests the simple assignment '=' operator and compound assignment 
 * '<op>=' operators, where <op> is one of the following:
 *     • *
 *     • /
 *     • %
 *     • +
 *     • -
 *     • <<
 *     • >>
 *     • >>>
 *     • &
 *     • ^
 *     • |
 *
 ****************************************************************************/

var v1 = 1;
var v2 = 2;
var v3 = 3;
var v6 = 6;
 
var a1  = 1,  b1 = 1;
var a2  = 2,  b2 = 2;
var a3  = 3,  b3 = 3;
var a4  = 4,  b4 = 4;
var a5  = 9,  b5 = 9;
var a6  = 1,  b6 = 1;
var a7  = 8,  b7 = 8;
var a8  = 8,  b8 = 8;
var a9  = 5,  b9 = 5;
var a10 = 1, b10 = 1;
var a11 = 5, b11 = 5;

/*
	ReadModifyResolveExpression: 
	{
		id: a1,
		right: NumberExpression { value: 1.0 },
		op: OpPlusEqual
	}
*/
a1 += 	1;	// 2
a2 -= 	1;	// 1
a3 *= 	3;	// 9
a4 /= 	2;	// 2
a5 %= 	6;	// 3
a6 <<= 	3;	// 8
a7 >>= 	1;	// 4
a8 >>>= 1;	// 4
a9 &= 	2;	// 0
a10 |= 	2;	// 3
a11 ^= 	2;	// 7

/*
	ReadModifyResolveExpression: 
	{
		id: a1,
		right: ResolvableExpression { id: v1 },
		op: OpPlusEqual
	}
*/
b1 += 	v1;	// 2
b2 -= 	v1;	// 1
b3 *= 	v3;	// 9
b4 /= 	v2;	// 2
b5 %= 	v6;	// 3
b6 <<= 	v3;	// 8
b7 >>= 	v1;	// 4
b8 >>>= v1;	// 4
b9 &= 	v2;	// 0
b10 |= 	v2;	// 3
b11 ^= 	v2;	// 7
