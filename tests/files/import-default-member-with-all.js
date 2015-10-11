import theDefaultFunc, * as theModule from "test-module";

theDefaultFunc(1);

console.log("theConst1 - %d", theModule.theConst1);

theModule.theFunc1(1);
theModule.theHiddenFunc1(1);