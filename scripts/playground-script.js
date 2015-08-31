/****************************************************************************
 *                          COMMENTS                             
 * --------------------------------------------------------------------------
 *
 * File: 		playground-script.js
 *
 * This is a test script for the playground.
 *
 ****************************************************************************/

 /* A: block comment */
 /*
    B block comment
 */
// single line comment

var a = 1; // inline comment
var b = 1+3*2;
var c = true | false;
var d = null;
var e = this;
var f = c === true ? 1 : 2;
;;;

a *= 10;
a = 10 || ~11;
a = -20;
a = !a;

{
	a--;
	--a;
}

if(a ? false : true)
	a = 2.2;
	
while(--a);
	
do {
	a++
}
while(a == 1);

// if(d == null)
	// d = 2.3;
	
// if(d === null) {
	// d = 3.2;
	// d *= 2;
// }

if(d == 0)
	d = 1;
else if(d == 1) {
	d = 2;
}
else if(d == 2)
	d = 3;
else {
	if(true == false)
		d = 5;
	else {
		d = 6;
	}
	
	d = 7;
}


/** bar **/
var x = function foo(a, b, c) {
	return x; // foo
}; // shibby

// boo boo