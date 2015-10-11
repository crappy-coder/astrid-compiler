function theHiddenFunc1(a) {
	console.log("theHiddenFunc1 - %d", a);
}

function theHiddenFunc2(a, b) {
	console.log("theHiddenFunc2 - %d, %d", a, b);
}

export function theFunc1(a) {
	console.log("theFunc1 - %d", a);
}

export function theFunc2(a, b) {
	console.log("theFunc2 - %d, %d", a, b);
}

export const theConst1 = 1;
export const theConst2 = 2;

var function theDefaultFunc(a) {
	console.log("theDefaultFunc - %d", a);
}

export default theDefaultFunc