
//
// constructor variables
//
// [VarStatement -> AssignResolveExpression(<var-name>) -> ResolvableExpression(<constructor-name>)]
//

//printf("assigning constructor variables...\n");

var aNumberConstructor = Number;
// var aObjectConstructor = Object;
// var aStringConstructor = String;
// var aBooleanConstructor = Boolean;

 printf("aNumberConstructor=%d\n", aNumberConstructor);
// printf("aObjectConstructor=%d\n", aObjectConstructor);
// printf("aStringConstructor=%s\n", aStringConstructor);
// printf("aBooleanConstructor=%d\n", aBooleanConstructor);
// printf("-----------------------------------\n");





//
// built-in primitive object constructors
//
// [VarStatement -> AssignResolveExpression(<var-name>) -> NewExpression([args=ArgumentsListNode -> <type>Expression(<value>)]) -> ResolvableExpression(<constructor-name>)]
//

// printf("creating new objects from constructors directly...\n");

// var aNumberObject = new Number(22);
// var aObjectObject = new Object();
// var aStringObject = new String("used: new String(...)");
// var aBooleanObject = new Boolean(true);

// printf("aNumberObject=%d\n", aNumberObject);
// printf("aObjectObject=%d\n", aObjectObject);
// printf("aStringObject=%s\n", aStringObject);
// printf("aBooleanObject=%d\n", aBooleanObject);
// printf("-----------------------------------\n");





//
// assignment constructors
//
// [VarStatement -> AssignResolveExpression(<var-name>) -> NewExpression([args=ArgumentsListNode -> <type>Expression(<value>)]) -> ResolvableExpression(<var-name>)]
//

// printf("creating new objects from constructor variables...\n");

// var aNumberObjectVar = new aNumberConstructor(0.001);
// var aObjectObjectVar = new aObjectConstructor();
// var aStringObjectVar = new aStringConstructor("used: new aStringConstructor(...)");
// var aBooleanObjectVar = new aBooleanConstructor(false);

// printf("aNumberObjectVar=%d\n", aNumberObjectVar);
// printf("aObjectObjectVar=%d\n", aObjectObjectVar);
// printf("aStringObjectVar=%s\n", aStringObjectVar);
// printf("aBooleanObjectVar=%d\n", aBooleanObjectVar);
// printf("-----------------------------------\n");
