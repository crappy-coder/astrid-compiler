var jsc = require("./jsc");

jsc.TokenLocation = Object.define({
	initialize: function() {
		this.line = 0;
		this.lineBegin = 0;
		this.begin = 0;
		this.end = 0;
	},

	get beginColumn() {
		return (this.begin - this.lineBegin);
	},

	get endColumn() {
		return (this.end - this.lineBegin);
	},

	toString: function() {
		return jsc.Utils.format("%d [%d,%d]", this.line, this.beginColumn, this.endColumn);
	}
});

jsc.Token = Object.define({
	initialize: function() {
		this.kind = jsc.Token.Kind.UNKNOWN;
		this.value = null;

		// TODO: enable location, begin and end positions in the lexer
		//this.location = new jsc.TokenLocation();
		//this.begin = new jsc.TextPosition();
		//this.end = new jsc.TextPosition();

		this.begin = 0;
		this.end = 0;
		this.beginLine = 0;
		this.endLine = 0;
		this.column = 0;
	},

	get isKeyword() {
		return ((this.kind & jsc.Token.KEYWORD) === jsc.Token.KEYWORD);
	},

	get isReserved() {
		return (this.kind === jsc.Token.Kind.RESERVED || this.kind === jsc.Token.Kind.RESERVED_STRICT);
	},

	clone: function() {
		return jsc.Utils.cloneObject(this);
	}
});

jsc.Token.IN_PRECEDENCE 	= 0x04;
jsc.Token.PRECEDENCE 		= 0x08;
jsc.Token.PRECEDENCE_MASK 	= 0x0F << jsc.Token.PRECEDENCE;
jsc.Token.UNARY 			= 0x40;
jsc.Token.KEYWORD 			= 0x80;

Object.extend(jsc.Token, {

	getName: function(kind) {
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
	},

	getOperatorDescription: function(kind, isPrefix) {
		switch(kind)
		{
			case jsc.Token.Kind.PLUSPLUS:
			case jsc.Token.Kind.PLUSPLUS_AUTO:
				return (isPrefix ? "prefix-increment" : "increment");
			case jsc.Token.Kind.MINUSMINUS:
			case jsc.Token.Kind.MINUSMINUS_AUTO:
				return (isPrefix ? "prefix-decrement" : "decrement");
			case jsc.Token.Kind.EXCLAMATION:
				return "logical-not";
			case jsc.Token.Kind.TILDE:
				return "bitwise-not";
			case jsc.Token.Kind.TYPEOF:
				return "typeof";
			case jsc.Token.Kind.VOID:
				return "void";
			case jsc.Token.Kind.DELETE:
				return "delete";
		}

		return "error:unknown";
	}
});

(function() {
	var keyword = jsc.Token.KEYWORD;
	var unary = jsc.Token.UNARY;
	var precedence = jsc.Token.PRECEDENCE;
	var precedence_shift = jsc.Token.PRECEDENCE + jsc.Token.IN_PRECEDENCE;
	var punctuator = 0;
	var identifiers = null;
	var kinds = {};
	var kindNames = [];
	
	var kindNameMap = {
	//--------------------------------------------------------------------------------------------------------------+
	//  KEY                     |  VALUE                                                        |    PRINTABLE NAME |
	//--------------------------------------------------------------------------------------------------------------+
		UNKNOWN					: [-1                                                           ,                ""],

	//  KEYWORDS
		NULL					: [     keyword                                                 ,            "null"],
		TRUE					: [ 1 + keyword                                                 ,            "true"],
		FALSE					: [ 2 + keyword                                                 ,           "false"],
		BREAK					: [ 3 + keyword                                                 ,           "break"],
		CASE					: [ 4 + keyword                                                 ,            "case"],
		DEFAULT					: [ 5 + keyword                                                 ,         "default"],
		FOR						: [ 6 + keyword                                                 ,             "for"],
		NEW						: [ 7 + keyword                                                 ,             "new"],
		VAR						: [ 8 + keyword                                                 ,             "var"],
		LET						: [ 9 + keyword                                                 ,             "let"],
		CONST					: [10 + keyword                                                 ,           "const"],
		CONTINUE				: [11 + keyword                                                 ,        "continue"],
		FUNCTION				: [12 + keyword                                                 ,        "function"],
		RETURN					: [13 + keyword                                                 ,          "return"],
		IF						: [14 + keyword                                                 ,              "if"],
		THIS					: [15 + keyword                                                 ,            "this"],
		DO						: [16 + keyword                                                 ,              "do"],
		WHILE					: [17 + keyword                                                 ,           "while"],
		SWITCH					: [18 + keyword                                                 ,          "switch"],
		WITH					: [19 + keyword                                                 ,            "with"],
		RESERVED				: [20 + keyword                                                 ,                ""],
		RESERVED_STRICT			: [21 + keyword                                                 ,                ""],
		THROW					: [22 + keyword                                                 ,           "throw"],
		TRY						: [23 + keyword                                                 ,             "try"],
		CATCH					: [24 + keyword                                                 ,           "catch"],
		FINALLY					: [25 + keyword                                                 ,         "finally"],
		DEBUGGER				: [26 + keyword                                                 ,        "debugger"],
		ELSE					: [27 + keyword                                                 ,            "else"],
		IMPORT					: [28 + keyword                                                 ,          "import"],
		EXPORT					: [29 + keyword                                                 ,          "export"],
		CLASS					: [30 + keyword                                                 ,           "class"],
		EXTENDS					: [31 + keyword                                                 ,         "extends"],
		SUPER					: [32 + keyword                                                 ,           "super"],

	//  PUNCTUATORS
		OPEN_BRACE				: [     punctuator                                              ,               "{"],
		CLOSE_BRACE				: [ 1 + punctuator                                              ,               "}"],
		OPEN_PAREN				: [ 2 + punctuator                                              ,               "("],
		CLOSE_PAREN				: [ 3 + punctuator                                              ,               ")"],
		OPEN_BRACKET			: [ 4 + punctuator                                              ,               "["],
		CLOSE_BRACKET			: [ 5 + punctuator                                              ,               "]"],
		COMMA					: [ 6 + punctuator                                              ,               ","],
		QUESTION				: [ 7 + punctuator                                              ,               "?"],
		INTEGER					: [ 8 + punctuator                                              ,                ""],
		DOUBLE					: [ 9 + punctuator                                              ,                ""],
		IDENTIFIER				: [10 + punctuator                                              ,                ""],
		STRING					: [11 + punctuator                                              ,                ""],
		TEMPLATE				: [12 + punctuator                                              ,                ""],
		SEMICOLON				: [13 + punctuator                                              ,               ";"],
		COLON					: [14 + punctuator                                              ,               ":"],
		DOT						: [15 + punctuator                                              ,               "."],
		ERROR					: [16 + punctuator                                              ,                ""],
		EOF						: [17 + punctuator                                              ,                ""],
		EQUAL					: [18 + punctuator                                              ,               "="],
		PLUS_EQUAL				: [19 + punctuator                                              ,              "+="],
		MINUS_EQUAL				: [20 + punctuator                                              ,              "-="],
		MULTIPLY_EQUAL			: [21 + punctuator                                              ,              "*="],
		DIVIDE_EQUAL			: [22 + punctuator                                              ,              "/="],
		LSHIFT_EQUAL			: [23 + punctuator                                              ,             "<<="],
		RSHIFT_EQUAL			: [24 + punctuator                                              ,             ">>="],
		RSHIFT_EQUAL_UNSIGNED	: [25 + punctuator                                              ,            ">>>="],
		AND_EQUAL				: [26 + punctuator                                              ,              "&="],
		MOD_EQUAL				: [27 + punctuator                                              ,              "%="],
		XOR_EQUAL				: [28 + punctuator                                              ,              "^="],
		OR_EQUAL				: [29 + punctuator                                              ,              "|="],
		DOTDOTDOT				: [30 + punctuator                                              ,             "..."],
		ARROW_FUNC				: [31 + punctuator                                              ,              "=>"],
		LAST_UNTAGGED			: [32 + punctuator                                              ,                ""],
		
	//  BINARY OPERATORS
		OR						: [     ( 1 << precedence) | ( 1 << precedence_shift)           ,              "||"],
		AND						: [ 1 + ( 2 << precedence) | ( 2 << precedence_shift)           ,              "&&"],
		BITWISE_OR				: [ 2 + ( 3 << precedence) | ( 3 << precedence_shift)           ,               "|"],
		BITWISE_XOR				: [ 3 + ( 4 << precedence) | ( 4 << precedence_shift)           ,               "^"],
		BITWISE_AND				: [ 4 + ( 5 << precedence) | ( 5 << precedence_shift)           ,               "&"],
		EQUAL_EQUAL				: [ 5 + ( 6 << precedence) | ( 6 << precedence_shift)           ,              "=="],
		NOT_EQUAL				: [ 6 + ( 6 << precedence) | ( 6 << precedence_shift)           ,              "!="],
		STRICT_EQUAL			: [ 7 + ( 6 << precedence) | ( 6 << precedence_shift)           ,             "==="],
		STRICT_NOT_EQUAL		: [ 8 + ( 6 << precedence) | ( 6 << precedence_shift)           ,             "!=="],
		LESS					: [ 9 + ( 7 << precedence) | ( 7 << precedence_shift)           ,               "<"],
		GREATER					: [10 + ( 7 << precedence) | ( 7 << precedence_shift)           ,               ">"],
		LESS_EQUAL				: [11 + ( 7 << precedence) | ( 7 << precedence_shift)           ,              "<="],
		GREATER_EQUAL			: [12 + ( 7 << precedence) | ( 7 << precedence_shift)           ,              ">="],
		INSTANCEOF				: [13 + ( 7 << precedence) | ( 7 << precedence_shift) | keyword ,      "instanceof"],
		IN						: [14 + ( 7 << precedence_shift) | keyword                      ,              "in"],
		LSHIFT					: [15 + ( 8 << precedence) | ( 8 << precedence_shift)           ,              "<<"],
		RSHIFT					: [16 + ( 8 << precedence) | ( 8 << precedence_shift)           ,              ">>"],
		URSHIFT					: [17 + ( 8 << precedence) | ( 8 << precedence_shift)           ,             ">>>"],
		PLUS					: [18 + ( 9 << precedence) | ( 9 << precedence_shift) | unary   ,               "+"],
		MINUS					: [19 + ( 9 << precedence) | ( 9 << precedence_shift) | unary   ,               "-"],
		MULT					: [20 + (10 << precedence) | (10 << precedence_shift)           ,               "*"],
		DIV						: [21 + (10 << precedence) | (10 << precedence_shift)           ,               "/"],
		MOD						: [22 + (10 << precedence) | (10 << precedence_shift)           ,               "%"],

	//  UNARY OPERATORS
		PLUSPLUS				: [    unary                                                    ,              "++"],
		PLUSPLUS_AUTO			: [1 + unary                                                    ,              "++"],
		MINUSMINUS				: [2 + unary                                                    ,              "--"],
		MINUSMINUS_AUTO			: [3 + unary                                                    ,              "--"],
		EXCLAMATION				: [4 + unary                                                    ,               "!"],
		TILDE					: [5 + unary                                                    ,               "~"],
		
	//  UNARY KEYWORD OPERATORS
		TYPEOF					: [6 + unary | keyword                                          ,          "typeof"],
		VOID					: [7 + unary | keyword                                          ,            "void"],
		DELETE					: [8 + unary | keyword                                          ,          "delete"]
	};
	
	for(var s in kindNameMap)
	{
		if(!kindNameMap.hasOwnProperty(s))
			continue;

		// add the kind key/value pair
		Object.defineProperty(kinds, s, {
			enumerable: true,
			configurable: false,
			writable: false,
			value: kindNameMap[s][0]
		});
		
		// add the printable name
		kindNames.push(kindNameMap[s][1]);
	}
	
	identifiers = {
		"null"			: kinds.NULL,
		"true"			: kinds.TRUE,
		"false"			: kinds.FALSE,
		"break"			: kinds.BREAK,
		"case"			: kinds.CASE,
		"catch"			: kinds.CATCH,
		"const"			: kinds.CONST,
		"default"		: kinds.DEFAULT,
		"finally"		: kinds.FINALLY,
		"for"			: kinds.FOR,
		"instanceof"	: kinds.INSTANCEOF,
		"new"			: kinds.NEW,
		"var"			: kinds.VAR,
		"continue"		: kinds.CONTINUE,
		"function"		: kinds.FUNCTION,
		"return"		: kinds.RETURN,
		"void"			: kinds.VOID,
		"delete"		: kinds.DELETE,
		"if"			: kinds.IF,
		"this"			: kinds.THIS,
		"do"			: kinds.DO,
		"while"			: kinds.WHILE,
		"else"			: kinds.ELSE,
		"in"			: kinds.IN,
		"switch"		: kinds.SWITCH,
		"throw"			: kinds.THROW,
		"try"			: kinds.TRY,
		"typeof"		: kinds.TYPEOF,
		"with"			: kinds.WITH,
		"debugger"		: kinds.DEBUGGER,
		"export"		: kinds.EXPORT,
		"import"		: kinds.IMPORT,
		"class"			: kinds.CLASS,
		"extends"		: kinds.EXTENDS,
		"super"			: kinds.SUPER,

		"await"			: kinds.RESERVED,
		"enum"			: kinds.RESERVED,
		"let"			: kinds.RESERVED,
		"yield"			: kinds.RESERVED,

		"implements"	: kinds.RESERVED_STRICT,
		"package"		: kinds.RESERVED_STRICT,
		"protected"		: kinds.RESERVED_STRICT,
		"static"		: kinds.RESERVED_STRICT,
		"interface"		: kinds.RESERVED_STRICT,
		"private"		: kinds.RESERVED_STRICT,
		"public"		: kinds.RESERVED_STRICT,
	};
	
	Object.extend(jsc.Token, {
		KindNames: kindNames,
		Kind: Object.freeze(kinds),
		Identifiers: Object.freeze(identifiers)
	});
	
})();

module.exports = {
	Token: jsc.Token,
	TokenLocation: jsc.TokenLocation
};