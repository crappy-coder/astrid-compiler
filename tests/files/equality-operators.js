/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		equality-operators.js
 * Section:		Equality Operators
 *
 * This tests the equality operators '==', '!=', '===' and '!=='.
 *
 ****************************************************************************/

var obj = new Object();
obj.x = 1;
obj.y = 2;

var r;
var x = "x";
var y = "y";

var a = 0.00009 + 0.1;
var b = 0.10009;


//**************************
// equals: '=='
//
r = obj == obj; // true
r = obj == x; // false
r = obj.x == obj.y; // false
r = obj.x == obj.x; // true
r = obj.x == 2; // false
r = obj.x == 1; // true
r = x == y; // false
r = x == "x"; // true
r = x == true; // false
r = true == true; // true
r = true == false; // false
r = 1 == 1; // true
r = 1 == 2; // false
r = 0.99 == 0.99;// true
r = a == a; // true
r = a == b;// false - because of rounding errors this will be false instead of true
r = "1" == 1;// true
r = "1" == 2;// false
r = "a" == "a";// true
r = "a" == "b";// false



//**************************
// not equals: '!='
//
r = obj != obj;// false
r = obj != x;// true
r = obj.x != obj.y;// true
r = obj.x != obj.x;// false
r = obj.x != 2;// true
r = obj.x != 1;// false
r = x != y;// true
r = x != "x";// false
r = x != true;// true
r = true != true;// false
r = true != false;// true
r = 1 != 1;// false
r = 1 != 2;// true
r = 0.99 != 0.99;// false
r = a != a;// false
r = a != b;// true - because of rounding errors this will be true instead of false
r = "1" != 1;// false
r = "1" != 2;// true
r = "a" != "a";// false
r = "a" != "b";// true


//**************************
// strict equals: '==='
//
r = obj === obj;// true
r = obj === x;// false
r = obj.x === obj.y;// false
r = obj.x === obj.x;// true
r = obj.x === 2;// false
r = obj.x === 1;// true
r = x === y;// false
r = x === "x";// true
r = x === true;// false
r = true === true; // true
r = true === false; // false
r = 1 === 1; // true
r = 1 === 2; // false
r = 0.99 === 0.99; // true
r = a === a; // true
r = a === b; // false - because of rounding errors this will be false instead of true
r = "1" === 1; // false
r = "1" === 2; // false
r = "a" === "a"; // true
r = "a" === "b"; // false



//**************************
// strict not equals: '!=='
//
r = obj !== obj; // false
r = obj !== x; // true
r = obj.x !== obj.y; // true
r = obj.x !== obj.x; // false
r = obj.x !== 2; // true
r = obj.x !== 1; // false
r = x !== y; // true
r = x !== "x"; // false
r = x !== true; // true
r = true !== true; // false
r = true !== false; // true
r = 1 !== 1; // false
r = 1 !== 2; // true
r = 0.99 !== 0.99; // false
r = a !== a; // false
r = a !== b; // true - because of rounding errors this will be true instead of false
r = "1" !== 1; // true
r = "1" !== 2; // true
r = "a" !== "a"; // false
r = "a" !== "b"; // true
