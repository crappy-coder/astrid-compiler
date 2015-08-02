var jsc = require("./jsc");
require("./utils");

/** @namespace */
jsc.AST = jsc.AST || {};


/**
 * The AST parsing context.
 *
 * @class
 */
jsc.AST.Context = Object.define({
	initialize: function(source, lexer) {
		this.source = source;
		this.lexer = lexer;
		this.evalCount = 0;
	}
});


/**
 * The base class for all AST nodes.
 *
 * @class
 */
jsc.AST.Node = Object.define({
	initialize: function(kind, lineNumber) {
		this.kind = jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.UNKNOWN);
		this.lineNumber = jsc.Utils.valueOrDefault(lineNumber, 1);
	}
});


/**
 * The base class for all language expressions.
 *
 * @class
 */
jsc.AST.Expression = Object.define(jsc.AST.Node, {
	initialize: function($super, kind, lineNumber, resultKind) {
		$super(kind, lineNumber);
		
		this.resultKind = jsc.Utils.valueOrDefault(resultKind, jsc.AST.ExpressionResultKind.Unknown);
	},
	
	get isThis() {
		return (this.kind === jsc.AST.NodeKind.THIS);
	}
});


/**
 * Represents a list of arguments.
 *
 * @class
 */
jsc.AST.ArgumentListNode = Object.define(jsc.AST.Node, {
	initialize: function($super, lineNumber, expression, nextNode) {
		$super(jsc.AST.NodeKind.ARGUMENT_LIST, lineNumber);

		this.expression = expression;
		this.next = null;
		
		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	}
});


/**
 * Represents a list of parameters.
 *
 * @class
 */
jsc.AST.ParameterListNode = Object.define({
	initialize: function(name, nextNode) {
		this.name = name;
		this.next = null;
		
		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	}
});


/**
 * Represents property info for an individual property in
 * a jsc.AST.PropertyListNode.
 *
 * @class
 */
jsc.AST.PropertyNode = Object.define({
	initialize: function(name, kindFlags, expr) {
		this.name = (jsc.Utils.isString(name) ? name : name.toString());
		this.flags = kindFlags;
		this.expression = expr;
	},
	
	get isConstant() {
		return (this.flags & jsc.AST.PropertyKindFlags.CONSTANT);
	},
	
	get isGetter() {
		return (this.flags & jsc.AST.PropertyKindFlags.GETTER);
	},
	
	get isSetter() {
		return (this.flags & jsc.AST.PropertyKindFlags.SETTER);
	}
});


/**
 * Represents a list of properties.
 *
 * @class
 */
jsc.AST.PropertyListNode = Object.define(jsc.AST.Node, {
	initialize: function($super, lineNumber, propNode, nextNode) {
		$super(jsc.AST.NodeKind.PROPERTY_LIST, lineNumber);

		this.property = propNode;
		this.next = null;
		
		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	},
	
	get name() {
		return this.property.name;
	}
});


/**
 * The base class for all language statements.
 *
 * @class
 */
jsc.AST.Statement = Object.define(jsc.AST.Node, {
	initialize: function($super, kind, lineNumber) {
		$super(kind, lineNumber);
		
		this.endLine = 0;
	},

	get startLine() {
		return this.lineNumber;
	},
	
	set startLine(value) {
		this.lineNumber = value;
	},
	
	get isEmpty() {
		return (this.kind === jsc.AST.NodeKind.EMPTY);
	}
});


/**
 * Represents just an empty statement.
 *
 * @class
 */
jsc.AST.EmptyStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber) {
		$super(jsc.AST.NodeKind.EMPTY, lineNumber);
	}
});


/**
 * Represents a statement with an expression.
 *
 * @class
 */
jsc.AST.ExpressionStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, expr) {
		$super(jsc.AST.NodeKind.EXPR_STATEMENT, lineNumber);

		this.expression = expr;
	}
});


/**
 * The base class for statements that are scoped, i.e. a function
 *
 * @class
 */
jsc.AST.ScopedStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, kind, lineNumber, inStrictMode) {
		$super(kind, lineNumber);
		
		this.features = inStrictMode ? jsc.AST.CodeFeatureFlags.STRICT_MODE : jsc.AST.CodeFeatureFlags.NONE;
		this.source = null;
		this.statements = [];
		this.functions = [];
		this.variables = [];
		this.capturedVariables = [];
		this.constantCount = 0;
	},
	
	get hasCapturedVariables() {
		return (this.capturedVariables && this.capturedVariables.length);
	},
	
	get inStrictMode() {
		return ((this.features & jsc.AST.CodeFeatureFlags.STRICT_MODE) !== jsc.AST.CodeFeatureFlags.NONE);
	},
	
	get usesArguments() {
		return (((this.features & jsc.AST.CodeFeatureFlags.ARGUMENTS) !== jsc.AST.CodeFeatureFlags.NONE) && 
				((this.features & jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS) === jsc.AST.CodeFeatureFlags.NONE));
	},
	
	set usesArguments(value) {
		this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;
	},
	
	get usesEval() {
		return ((this.features & jsc.AST.CodeFeatureFlags.EVAL) !== jsc.AST.CodeFeatureFlags.NONE);
	},
	
	get usesThis() {
		return ((this.features & jsc.AST.CodeFeatureFlags.THIS) !== jsc.AST.CodeFeatureFlags.NONE);
	},
	
	get needsActivation() {
		return (this.hasCapturedVariables || ((this.features & (jsc.AST.CodeFeatureFlags.EVAL | jsc.AST.CodeFeatureFlags.WITH | jsc.AST.CodeFeatureFlags.CATCH)) !== jsc.AST.CodeFeatureFlags.NONE));
	}
});


/**
 * An AST node that represents a complete program (script).
 *
 * @class
 */
jsc.AST.ScriptNode = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, source, lineNumber) {
		$super(jsc.AST.NodeKind.SCRIPT, lineNumber);
		
		this.source = source;
	}
});


/**
 * An item (element) stored within an array.
 *
 * @class
 */
jsc.AST.ArrayElement = Object.define({
	initialize: function(elision, expr, nextEl) {
		this.elision = elision;
		this.expression = expr;
		this.nextElement = null;
		
		if(!jsc.Utils.isNull(nextEl))
			nextEl.nextElement = this;
	}
});


/**
 * Represents storage for a variable declaration to hold the name
 * of the variable and a set of flags. Used as an element for an
 * array of variable declarations.
 *
 * @class
 */
jsc.AST.VariableDeclaration = Object.define({
	initialize: function(name, flags) {
		this.name = name;
		this.flags = flags;
	}
});



/**
 * Represents the type of value that an expression will most likely
 * produce once the expression has been evaluated.
 *
 * @class
 */
jsc.AST.ExpressionResultKind = Object.define({
	initialize: function(kind) {
		this.kind = jsc.Utils.valueOrDefault(kind, jsc.AST.ExpressionResultKind.NULL);
	},
	
	get isString() {
		return ((this.kind & jsc.AST.ExpressionResultKind.BITS) === jsc.AST.ExpressionResultKind.STRING);
	},
	
	get isInt32() {
		return (this.kind & jsc.AST.ExpressionResultKind.INT32);
	},
	
	get isNumber() {
		return ((this.kind & jsc.AST.ExpressionResultKind.BITS) === jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get isNotNumber() {
		return !this.isMaybeNumber;
	},
	
	get isMaybeNumber() {
		return ((this.kind & jsc.AST.ExpressionResultKind.NUMBER) === jsc.AST.ExpressionResultKind.NUMBER);
	}
});

Object.extend(jsc.AST.ExpressionResultKind, {
	INT32	: 0x01,
	NUMBER	: 0x04,
	STRING	: 0x08,
	NULL	: 0x10,
	BOOL	: 0x20,
	OTHER	: 0x40,
	BITS	: ( jsc.AST.ExpressionResultKind.NUMBER |
				jsc.AST.ExpressionResultKind.STRING |
				jsc.AST.ExpressionResultKind.NULL 	|
				jsc.AST.ExpressionResultKind.BOOL 	|
				jsc.AST.ExpressionResultKind.OTHER),

	ForBitOp: function() {
		return jsc.AST.ExpressionResultKind.Int32;
	},
	
	ForAdd: function(lhs, rhs) {
		if(lhs.isNumber && rhs.isNumber)
			return jsc.AST.ExpressionResultKind.Number;
			
		if(lhs.isString || rhs.isString)
			return jsc.AST.ExpressionResultKind.String;

		return jsc.AST.ExpressionResultKind.StringOrNumber;
	},
	
	get Unknown() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.BITS);
	},
	
	get Null() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.NULL);
	},
	
	get Int32() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.INT32 | jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get Number() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get String() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.STRING);
	},
	
	get StringOrNumber() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.STRING | jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get Boolean() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.BOOL);
	}
});


/** @enum */
jsc.AST.OpCode = {};

/** @enum */
jsc.AST.CodeFeatureFlags = {};

/** @enum */
jsc.AST.NodeKind = {};

/** @enum */
jsc.AST.AssignmentOperatorKind = {};

/** @enum */
jsc.AST.LogicalOperatorKind = {
	AND	: 1,
	OR	: 2
};

/** @enum */
jsc.AST.PropertyKindFlags = {
	UNKNOWN	: 0x00,
	CONSTANT: 0x01,
	GETTER	: 0x02,
	SETTER	: 0x04
};

/** @enum */
jsc.AST.VariableFlags = {
	NONE			: 0x00,
	CONSTANT		: 0x01,
	HAS_INITIALIZER	: 0x02
};


(function() {

	//
	// NodeKind
	//
	var nodeKinds = [
		"UNKNOWN", "NULL", "BOOLEAN", "NUMBER", "STRING", "REGEX", "THIS", "RESOLVE", "ARRAY", "PROPERTY_LIST", "OBJECT_LITERAL",
		"BRACKET_ACCESSOR", "DOT_ACCESSOR", "ARGUMENT_LIST", "NEW", "FUNC_CALL_VALUE", "FUNC_CALL_RESOLVE", "FUNC_CALL_BRACKET",
		"FUNC_CALL_DOT", "FUNC_CALL_EVAL", "FUNCTION_CALL", "FUNCTION_APPLY", "PREPOST_RESOLVE", "POSTFIX_RESOLVE", "POSTFIX_BRACKET",
		"POSTFIX_DOT", "POSTFIX_ERROR", "DELETE_RESOLVE", "DELETE_BRACKET", "DELETE_DOT", "DELETE_VALUE", "VOID", "TYPEOF_RESOLVE",
		"TYPEOF_VALUE", "PREFIX_RESOLVE", "PREFIX_BRACKET", "PREFIX_DOT", "PREFIX_ERROR", "UNARY_OP", "UNARY_PLUS", "NEGATE", "BITWISE_NOT",
		"LOGICAL_NOT", "BINARY_OP", "MULTIPLY", "DIVIDE", "MODULUS", "ADD", "SUBSTRACT", "LEFT_SHIFT", "RIGHT_SHIFT", "RIGHT_SHIFT_UNSIGNED",
		"LESS", "LESS_EQ", "GREATER", "GREATER_EQ", "INSTANCEOF", "IN", "EQUAL", "EQUAL_STRICT", "NOT_EQUAL", "NOT_EQUAL_STRICT", "BIT_AND",
		"BIT_OR", "BIT_XOR", "LOGICAL_OP", "CONDITIONAL", "READ_MODIFY_RESOLVE", "READ_MODIFY_BRACKET", "READ_MODIFY_DOT", "ASSIGN_RESOLVE",
		"ASSIGN_BRACKET", "ASSIGN_DOT", "ASSIGN_ERROR", "COMMA", "CONST_DECL", "CONST_STATEMENT", "BLOCK", "EMPTY", "DEBUGGER",
		"EXPR_STATEMENT", "VAR", "IF", "IF_ELSE", "DO_WHILE", "WHILE", "FOR", "FOR_IN", "CONTINUE", "BREAK", "RETURN", "WITH", "LABEL",
		"THROW", "TRY", "SCOPE", "SCRIPT", "EVAL", "FUNCTION", "FUNCTION_EXPR", "FUNCTION_DECL", "SWITCH"
	];
	
	jsc.Utils.createEnum(-1, nodeKinds, jsc.AST.NodeKind);
	
	
	//
	// AssignmentOperatorKind
	//
	var assignmentOperatorKinds = [
		"EQUAL", "PLUS_EQUAL", "MINUS_EQUAL", "MULTIPLY_EQUAL", "DIVIDE_EQUAL", "PLUS_PLUS", "MINUS_MINUS",
		"AND_EQUAL", "OR_EQUAL", "XOR_EQUAL", "MOD_EQUAL", "LSHIFT_EQUAL", "RSHIFT_EQUAL", "RSHIFT_EQUAL_UNSIGNED"
	];
	
	jsc.Utils.createEnum(1, assignmentOperatorKinds, jsc.AST.AssignmentOperatorKind);
	
	
	//
	// OpCode
	//
	var opCodes = [
		"EQUAL", "NOT_EQUAL", "EQUAL_STRICT", "NOT_EQUAL_STRICT", "LESS", "LESS_EQ", "GREATER", "GREATER_EQ",
		"ADD", "MULTIPLY", "DIVIDE", "MODULUS", "SUBSTRACT", "LEFT_SHIFT", "RIGHT_SHIFT", "RIGHT_SHIFT_UNSIGNED",
		"BIT_AND", "BIT_OR", "BIT_XOR", "INSTANCEOF", "IN"
	];
	
	jsc.Utils.createEnum(1, opCodes, jsc.AST.OpCode);
	
	
	//
	// CodeFeatureFlags
	//
	var featureNames = [
		"NONE", "EVAL", "ARGUMENTS", "WITH", "CATCH", "THIS", "STRICT_MODE", "SHADOWS_ARGUMENTS"
	];
	
	jsc.Utils.createEnumFlags(featureNames, jsc.AST.CodeFeatureFlags);
	
	Object.defineProperty(jsc.AST.CodeFeatureFlags, "ALL", {
		value: (jsc.AST.CodeFeatureFlags.EVAL | jsc.AST.CodeFeatureFlags.ARGUMENTS | jsc.AST.CodeFeatureFlags.WITH | jsc.AST.CodeFeatureFlags.CATCH | jsc.AST.CodeFeatureFlags.THIS | jsc.AST.CodeFeatureFlags.STRICT_MODE | jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS),
		enumerable: true,
		configurable: false,
		writable: false
	});
	
	
	// make the enums immutable
	Object.freeze(jsc.AST.NodeKind);
	Object.freeze(jsc.AST.AssignmentOperatorKind);
	Object.freeze(jsc.AST.LogicalOperatorKind);
	Object.freeze(jsc.AST.PropertyKindFlags);
	Object.freeze(jsc.AST.VariableFlags);
	Object.freeze(jsc.AST.OpCode);
	Object.freeze(jsc.AST.CodeFeatureFlags);
})();

module.exports = jsc.AST;