
              import * as testModule from "test-module";

console.log("theConst1 - %d", testModule.theConst1);
console.log("theConst2 - %d", testModule.theConst2);
console.log("theFunc1 - %d", testModule.theFunc1(1));
console.log("theFunc2 - %d", testModule.theFunc2(1, 2));
console.log("theDefaultFunc - %d", testModule.theDefaultFunc(1));
console.log("theHiddenFunc1 - %d", testModule.theHiddenFunc1(1));
console.log("theHiddenFunc2 - %d", testModule.theHiddenFunc2(1, 2));