function foo(a, ...theArgs) {
	return function bar(x, y, z) {
		return (a + x * b + y * c + z);
	};
}

var params = [(1), 2];

foo(params);