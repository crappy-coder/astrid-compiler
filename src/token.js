var jsc = jsc || {};

jsc.Token = function() {
	this.kind = jsc.Token.Kind.UNKNOWN;
	this.begin = 0;
	this.end = 0;
	this.line = 0;
	this.value = null;
}

jsc.Token.getName = function(kind) {
	var kinds = jsc.Token.Kind;
	var i = 0;
	
	for(var k in kinds)
	{
		if(!kinds.hasOwnProperty(k))
			continue;
			
		if(kinds[k] === kind)
			return jsc.Token.KindNames[i];

		i++;
	}

	return "INVALID";
};

jsc.Token.IN_PRECEDENCE				= 4;
jsc.Token.PRECEDENCE				= 8;
jsc.Token.PRECEDENCE_MASK			= 15 << jsc.Token.PRECEDENCE;
jsc.Token.UNARY 					= 64;
jsc.Token.KEYWORD 					= 128;

(function() {
	var keyword = jsc.Token.KEYWORD;
	var unary = jsc.Token.UNARY;
	var precedence = jsc.Token.PRECEDENCE;
	var precedence_shift = jsc.Token.PRECEDENCE + jsc.Token.IN_PRECEDENCE;
	var punctuator = 0;
	
	// the token kind names must be kept in sync with the token kinds
	jsc.Token.KindNames = [
		"", "null", "true", "false", "break", "case", "default", "for", "new", "var", "const", "continue", "function",
		"", "if", "this", "do", "while", "switch", "with", "", "", "throw", "try", "catch", "finally",
		"debugger", "else", "{", "}", "(", ")", "[", "]", ",", "?", ";", ":", ".", "=", "+=", "-=", "*=", "/=", "<<=", ">>=", ">>>=",
		"&=", "|=", "^=", "%=", "", "", "", "", "", "||", "&&", "|", "^", "&", "==", "!=", "===", "!==", "<", ">", "<=", ">=", "instanceof",
		"in", "<<", ">>", ">>>", "+", "-", "*", "/", "%", "++", "++", "--", "--", "!", "~", "typeof", "void", "delete"
	];
	
	jsc.Token.Kind = Object.freeze({
		UNKNOWN			: -1,
		
		// keywords
		NULL			:  0 + keyword,
		TRUE			:  1 + keyword,
		FALSE			:  2 + keyword,
		BREAK			:  3 + keyword,
		CASE			:  4 + keyword,
		DEFAULT			:  5 + keyword,
		FOR				:  6 + keyword,
		NEW				:  7 + keyword,
		VAR				:  8 + keyword,
		CONST			:  9 + keyword,
		CONTINUE		: 10 + keyword,
		FUNCTION		: 11 + keyword,
		RETURN			: 12 + keyword,
		IF				: 13 + keyword,
		THIS			: 14 + keyword,
		DO				: 15 + keyword,
		WHILE			: 16 + keyword,
		SWITCH			: 17 + keyword,
		WITH			: 18 + keyword,
		RESERVED		: 19 + keyword,
		RESERVED_STRICT	: 20 + keyword,
		THROW			: 21 + keyword,
		TRY				: 22 + keyword,
		CATCH			: 23 + keyword,
		FINALLY			: 24 + keyword,
		DEBUGGER		: 25 + keyword,
		ELSE			: 26 + keyword,
		
		// punctuators
		OPEN_BRACE		:  1 + punctuator,
		CLOSE_BRACE		:  2 + punctuator,
		OPEN_PAREN		:  3 + punctuator,
		CLOSE_PAREN		:  4 + punctuator,
		OPEN_BRACKET	:  5 + punctuator,
		CLOSE_BRACKET	:  6 + punctuator,
		COMMA			:  7 + punctuator,
		QUESTION		:  8 + punctuator,
		SEMICOLON		:  9 + punctuator,
		COLON			: 10 + punctuator,
		DOT				: 11 + punctuator,
		EQUAL			: 12 + punctuator,
		PLUS_EQUAL		: 13 + punctuator,
		MINUS_EQUAL		: 14 + punctuator,
		MULT_EQUAL		: 15 + punctuator,
		DIV_EQUAL		: 16 + punctuator,
		LSHIFT_EQUAL	: 17 + punctuator,
		RSHIFT_EQUAL	: 18 + punctuator,
		URSHIFT_EQUAL	: 19 + punctuator,
		AND_EQUAL		: 20 + punctuator,
		OR_EQUAL		: 21 + punctuator,
		XOR_EQUAL		: 22 + punctuator,
		MOD_EQUAL		: 23 + punctuator,
		NUMBER			: 24 + punctuator,
		STRING			: 25 + punctuator,
		IDENTIFIER		: 26 + punctuator,
		ERROR			: 27 + punctuator,
		EOF				: 28 + punctuator,
		
		// binary operators
		OR				:  0 + ( 1 << precedence) | ( 1 << precedence_shift),
		AND				:  1 + ( 2 << precedence) | ( 2 << precedence_shift),
		BITWISE_OR		:  2 + ( 3 << precedence) | ( 3 << precedence_shift),
		BITWISE_XOR		:  3 + ( 4 << precedence) | ( 4 << precedence_shift),
		BITWISE_AND		:  4 + ( 5 << precedence) | ( 5 << precedence_shift),
		EQUAL_EQUAL		:  5 + ( 6 << precedence) | ( 6 << precedence_shift),
		NOT_EQUAL		:  6 + ( 6 << precedence) | ( 6 << precedence_shift),
		STRICT_EQUAL	:  7 + ( 6 << precedence) | ( 6 << precedence_shift),
		STRICT_NOT_EQUAL:  8 + ( 6 << precedence) | ( 6 << precedence_shift),
		LESS			:  9 + ( 7 << precedence) | ( 7 << precedence_shift),
		GREATER			: 10 + ( 7 << precedence) | ( 7 << precedence_shift),
		LESS_EQUAL		: 11 + ( 7 << precedence) | ( 7 << precedence_shift),
		GREATER_EQUAL	: 12 + ( 7 << precedence) | ( 7 << precedence_shift),
		INSTANCEOF		: 13 + ( 7 << precedence) | ( 7 << precedence_shift) | keyword,
		IN				: 14 + ( 7 << precedence) | keyword,
		LSHIFT			: 15 + ( 8 << precedence) | ( 8 << precedence_shift),
		RSHIFT			: 16 + ( 8 << precedence) | ( 8 << precedence_shift),
		URSHIFT			: 17 + ( 8 << precedence) | ( 8 << precedence_shift),
		PLUS			: 18 + ( 9 << precedence) | ( 9 << precedence_shift) | unary,
		MINUS			: 19 + ( 9 << precedence) | ( 9 << precedence_shift) | unary,
		MULT			: 20 + (10 << precedence) | (10 << precedence_shift),
		DIV				: 21 + (10 << precedence) | (10 << precedence_shift),
		MOD				: 22 + (10 << precedence) | (10 << precedence_shift),

		// unary operators
		PLUSPLUS		: 0 + unary,
		PLUSPLUS_AUTO	: 1 + unary,
		MINUSMINUS		: 2 + unary,
		MINUSMINUS_AUTO	: 3 + unary,
		EXCLAMATION		: 4 + unary,
		TILDE			: 5 + unary,
		
		// unary keyword operators
		TYPEOF			: 6 + unary | keyword,
		VOID			: 7 + unary | keyword,
		DELETE			: 8 + unary | keyword,
	});
	
	var kinds = jsc.Token.Kind;
	
	jsc.Token.Identifiers = Object.freeze({
		"null"		 : kinds.NULL,
		"true"		 : kinds.TRUE,
		"false"		 : kinds.FALSE,
		"break"		 : kinds.BREAK,
		"case"		 : kinds.CASE,
		"catch"		 : kinds.CATCH,
		"const"		 : kinds.CONST,
		"default"	 : kinds.DEFAULT,
		"finally"	 : kinds.FINALLY,
		"for"		 : kinds.FOR,
		"instanceof" : kinds.INSTANCEOF,
		"new"		 : kinds.NEW,
		"var"		 : kinds.VAR,
		"continue"	 : kinds.CONTINUE,
		"function"	 : kinds.FUNCTION,
		"return"	 : kinds.RETURN,
		"void"		 : kinds.VOID,
		"delete"	 : kinds.DELETE,
		"if"		 : kinds.IF,
		"this"		 : kinds.THIS,
		"do"		 : kinds.DO,
		"while"		 : kinds.WHILE,
		"else"		 : kinds.ELSE,
		"in"		 : kinds.IN,
		"switch"	 : kinds.SWITCH,
		"throw"		 : kinds.THROW,
		"try"		 : kinds.TRY,
		"typeof"	 : kinds.TYPEOF,
		"with"		 : kinds.WITH,
		"debugger"	 : kinds.DEBUGGER,
		"class"		 : kinds.RESERVED,
		"enum"		 : kinds.RESERVED,
		"export"	 : kinds.RESERVED,
		"extends"	 : kinds.RESERVED,
		"import"	 : kinds.RESERVED,
		"super"		 : kinds.RESERVED,
		"implements" : kinds.RESERVED_STRICT,
		"interface"	 : kinds.RESERVED_STRICT,
		"let"		 : kinds.RESERVED_STRICT,
		"package"	 : kinds.RESERVED_STRICT,
		"private"	 : kinds.RESERVED_STRICT,
		"protected"	 : kinds.RESERVED_STRICT,
		"public"	 : kinds.RESERVED_STRICT,
		"static"	 : kinds.RESERVED_STRICT,
		"yield"		 : kinds.RESERVED_STRICT,
	});
	
})()

module.exports = jsc.Token;