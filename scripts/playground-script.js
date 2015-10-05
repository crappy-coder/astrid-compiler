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

var z;
var a = 1; // inline comment
var b = 1+3*2;
var c = true | false;
var d = null;
var e = this;
var f = c === true ? 1 : 2;
var g = [1,,,2,,,3,];
var h, i = 0;
var j = 1, k = 2;
var l,m,n;
var str = "abc\n\t\"'xyz\"";
var x = [1, 2];
var y = [3, ...x, 0];
var obj = {
	a: 1,
	b: "2",
	c: true,
	next: {
		x: 1,
		y: 2
	},
	
	get foo() {
		return this.a;
	},
	
	set foo(value) {
		this.a = value;
	},
	
	get 1() {
		return "1";
	},
	
	get "2"() {
		return 2;
	}
};

function bar() { 
	return function() {
		return b;
	}
}

function foo(...theArgs) {
	return function bar(x, y, z) {
		return (a + x * b + y * c + z);
	};
};

x = foo(0, ...x, 1);

var rxa = /ab+c/g;
var rxb = /(?:)/;

const o = 1, p = 2;
const q = true;
const r = "foo";

void(0);

delete a;
delete a.b;
delete a["b"];
delete 2;

with(a)
	b = 1;

with(a) {
	b = 2;
	b -= 2;
}

a = typeof(a);
a = typeof a.b;
a = typeof(1);

a = +b;

h = 2;

;;;

for(var s in a)
	b = 1;
	
for(var s in a) {
	b = 1;
	b += 2;
}

for(s in a)
	b = 1;
	
for(s in a) {
	b = 1;
	b += 2;
}

for(var s=0 in a)
	b = 1;
	
for(var s=0 in a) {
	b = 1;
	b += 2;
}

for(a = 0; a < 1; a++)
	b = a*2;
	
for(a = 0; a < 1; a++) {
	b = a*2;
	b += 3;
}

for(var i = 0; i < 1; i++)
	b = i*2;
	
for(var i = 0, j = 1; i < 1; i++) {
	b = i*2;
	b += 3;
}

for(;;) {
	a = 2;
	break;
}

h = foo();
h = bar(1, 2, 3);

h = h.foo();
h = h.bar(1, 2, 3);

h = h["foo"]();
h = h["bar"](1, 2, 3);

h = "foo"();
h = "bar"(1, 2, 3);

h = eval("1 + 1");

h = foo.apply();
h = bar.apply(this, 1, 2, 3);

h = h.foo.apply();
h = h.bar.apply(this, 1, 2, 3);

h = h["foo"].apply();
h = h["bar"].apply(this, 1, 2, 3);

h = foo.call();
h = bar.call(this, 1, 2, 3);

h = h.foo.call();
h = h.bar.call(this, 1, 2, 3);

h = h["foo"].call();
h = h["bar"].call(this, 1, 2, 3);

eval("2 + 2");

switch(a) {
	default:
		a = 0;
		break;
}

switch(a) {
	case 1:
		a = 2;
		break;
	case 2: {
		a = 3;
		a -= 1;
		break;
	}
}

switch(a) {
	case 1:
		a = 2;
		break;
	case 2: {
		a = 3;
		a -= 1;
		break;
	}
	default:
		a = 0;
		break;
}

switch(a) {
	case 1:
		a = 2;
		break;
	default: {
		a = 0;
		break;
	}
	case 2: {
		a = 3;
		a -= 1;
		break;
	}
}

throw new Error("x", 1);

try {
	throw new Error("a");
}
catch(e) {
	a = e;
}

try {
	throw new Error("a");
}
catch(e) {
	a = e;
}
finally {
	a = f;
}

try {
	throw new Error("a");
}
finally {
	a = f;
}

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
	
	if(a == 0) {
		break;
	}
	else
		continue;
}
while(a == 1);

do_loop:
	do_two:
do {
	a++;
	
	if(a == 0) {
		break do_two;
	}
	else {
		continue do_loop;
	}
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