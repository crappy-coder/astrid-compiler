var utils = require("./utils");
var text = require("./text");
var lex = require("./lexer");


//=============================================================================
// Context
//   � The AST parsing context.
//=============================================================================
jsc.AST.Context = function() {

};


//=============================================================================
// Node
//   � The base class for all AST nodes.
//=============================================================================
jsc.AST.Node = function(lineNumber) {
	this.lineNumber = utils.valueOrDefault(lineNumber, 1);
	this.kind = jsc.AST.NodeKind.UNKNOWN;
};


//=============================================================================
// Expression
//   � The base class for all language expressions.
//=============================================================================
jsc.AST.Expression = function(lineNumber, resultKind) {
	this.resultKind = utils.valueOrDefault(resultKind, jsc.AST.ExpressionResultKind.Unknown);
};

jsc.AST.Expression.prototype = {
	get isThis() {
		return (this.kind === jsc.AST.NodeKind.THIS);
	}
};


//=============================================================================
// ArrayElement
//   � An item (element) stored within an array.
//=============================================================================
jsc.AST.ArrayElement = function(elision, expr, nextEl) {
	this.elision = elision;
	this.expression = expr;
	this.nextElement = null;
	
	if(!utils.isNull(nextEl))
		nextEl.nextElement = this;
};


//=============================================================================
// ScriptNode
//   � An AST node that represents a complete program (script).
//=============================================================================
jsc.AST.ScriptNode = function(sourceCode, line, lastLine, props) {

};


//=============================================================================
// ExpressionResultKind
//   � Represents the type of value that an expression will most likely
//     produce once the expression has been evaluated.
//=============================================================================
jsc.AST.ExpressionResultKind = function(kind) {
	this.kind = utils.valueOrDefault(kind, jsc.AST.ExpressionResultKind.NULL);
};

jsc.AST.ExpressionResultKind.prototype = {
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
};


//-------------------------------------
// Constants
//-------------------------------------
jsc.AST.ExpressionResultKind.INT32		= 0x01;
jsc.AST.ExpressionResultKind.NUMBER		= 0x04;
jsc.AST.ExpressionResultKind.STRING		= 0x08;
jsc.AST.ExpressionResultKind.NULL		= 0x10;
jsc.AST.ExpressionResultKind.BOOL		= 0x20;
jsc.AST.ExpressionResultKind.OTHER		= 0x40;
jsc.AST.ExpressionResultKind.BITS		= (jsc.AST.ExpressionResultKind.NUMBER
										 | jsc.AST.ExpressionResultKind.STRING
										 | jsc.AST.ExpressionResultKind.NULL
										 | jsc.AST.ExpressionResultKind.BOOL
										 | jsc.AST.ExpressionResultKind.OTHER);

//-------------------------------------
// Static Methods
//-------------------------------------
jsc.AST.ExpressionResultKind.ForBitOp = function() {
	return jsc.AST.ExpressionResultKind.Int32;
};

jsc.AST.ExpressionResultKind.ForAdd = function(lhs, rhs) {
	if(lhs.isNumber && rhs.isNumber)
		return jsc.AST.ExpressionResultKind.Number;
		
	if(lhs.isString || rhs.isString)
		return jsc.AST.ExpressionResultKind.String;
		
	return jsc.AST.ExpressionResultKind.StringOrNumber;
};


//-------------------------------------
// Static Properties
//-------------------------------------
Object.defineProperties(jsc.AST.ExpressionResultKind, {
	"Unknown" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.BITS); }
	},
	"Null" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.NULL); }
	},
	"Int32" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.INT32 | jsc.AST.ExpressionResultKind.NUMBER); }
	},
	"Number" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.NUMBER); }
	},
	"String" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.STRING); }
	},
	"StringOrNumber" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.STRING |  | jsc.AST.ExpressionResultKind.NUMBER); }
	},
	"Boolean" : {
		get: function() { return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.BOOL); }
	}
});


(function() {

	// create the node kinds
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
		"THROW", "TRY", "SCOPE", "PROGRAM", "EVAL", "FUNCTION", "FUNCTION_EXPR", "FUNCTION_DECL", "SWITCH"
	];
	
	jsc.AST.NodeKind = utils.createEnum(-1, nodeKinds);
	
})();

module.exports = jsc.AST;