class MyClass {
	constructor(a, b) {
		this.a = a;
		this.b = b;
	}

	print() {
		console.log("a: %d, b: %d", this.a, this.b);
	}
}

class MySubClass extends MyClass {
	constructor(a, b, c) {
		super(a, b);

		this.c = c;
	}

	print() {
		super.print();
		console.log("c: %d", this.c);
	}
}