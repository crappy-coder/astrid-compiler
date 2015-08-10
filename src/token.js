var jsc = require("./jsc");

jsc.Token = Object.define({
	initialize: function() {
		this.kind = jsc.Token.Kind.UNKNOWN;
		this.begin = 0;
		this.end = 0;
		this.line = 0;
		this.value = null;
	}
});

Object.extend(jsc.Token, {
	IN_PRECEDENCE: 0x04,
	PRECEDENCE: 0x08,
	PRECEDENCE_MASK: 0x0F << jsc.Token.PRECEDENCE,
	UNARY: 0x40,
	KEYWORD: 0x80,
	
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
		NULL					: [ 0 + keyword                                                 ,            "null"],
		TRUE					: [ 1 + keyword                                                 ,            "true"],
		FALSE					: [ 2 + keyword                                                 ,           "false"],
		BREAK					: [ 3 + keyword                                                 ,           "break"],
		CASE					: [ 4 + keyword                                                 ,            "case"],
		DEFAULT					: [ 5 + keyword                                                 ,         "default"],
		FOR						: [ 6 + keyword                                                 ,             "for"],
		NEW						: [ 7 + keyword                                                 ,             "new"],
		VAR						: [ 8 + keyword                                                 ,             "var"],
		CONST					: [ 9 + keyword                                                 ,           "const"],
		CONTINUE				: [10 + keyword                                                 ,        "continue"],
		FUNCTION				: [11 + keyword                                                 ,        "function"],
		RETURN					: [12 + keyword                                                 ,          "return"],
		IF						: [13 + keyword                                                 ,              "if"],
		THIS					: [14 + keyword                                                 ,            "this"],
		DO						: [15 + keyword                                                 ,              "do"],
		WHILE					: [16 + keyword                                                 ,           "while"],
		SWITCH					: [17 + keyword                                                 ,          "switch"],
		WITH					: [18 + keyword                                                 ,            "with"],
		RESERVED				: [19 + keyword                                                 ,                ""],
		RESERVED_STRICT			: [20 + keyword                                                 ,                ""],
		THROW					: [21 + keyword                                                 ,           "throw"],
		TRY						: [22 + keyword                                                 ,             "try"],
		CATCH					: [23 + keyword                                                 ,           "catch"],
		FINALLY					: [24 + keyword                                                 ,         "finally"],
		DEBUGGER				: [25 + keyword                                                 ,        "debugger"],
		ELSE					: [26 + keyword                                                 ,            "else"],
		
	//  PUNCTUATORS
		OPEN_BRACE				: [ 0 + punctuator                                              ,               "{"],
		CLOSE_BRACE				: [ 1 + punctuator                                              ,               "}"],
		OPEN_PAREN				: [ 2 + punctuator                                              ,               "("],
		CLOSE_PAREN				: [ 3 + punctuator                                              ,               ")"],
		OPEN_BRACKET			: [ 4 + punctuator                                              ,               "["],
		CLOSE_BRACKET			: [ 5 + punctuator                                              ,               "]"],
		COMMA					: [ 6 + punctuator                                              ,               ","],
		QUESTION				: [ 7 + punctuator                                              ,               "?"],
		NUMBER					: [ 8 + punctuator                                              ,                ""],
		IDENTIFIER				: [ 9 + punctuator                                              ,                ""],
		STRING					: [10 + punctuator                                              ,                ""],
		SEMICOLON				: [11 + punctuator                                              ,               ";"],
		COLON					: [12 + punctuator                                              ,               ":"],
		DOT						: [13 + punctuator                                              ,               "."],
		ERROR					: [14 + punctuator                                              ,                ""],
		EOF						: [15 + punctuator                                              ,                ""],
		EQUAL					: [16 + punctuator                                              ,               "="],
		PLUS_EQUAL				: [17 + punctuator                                              ,              "+="],
		MINUS_EQUAL				: [18 + punctuator                                              ,              "-="],
		MULTIPLY_EQUAL			: [19 + punctuator                                              ,              "*="],
		DIVIDE_EQUAL			: [20 + punctuator                                              ,              "/="],
		LSHIFT_EQUAL			: [21 + punctuator                                              ,             "<<="],
		RSHIFT_EQUAL			: [22 + punctuator                                              ,             ">>="],
		RSHIFT_EQUAL_UNSIGNED	: [23 + punctuator                                              ,            ">>>="],
		AND_EQUAL				: [24 + punctuator                                              ,              "&="],
		MOD_EQUAL				: [25 + punctuator                                              ,              "%="],
		XOR_EQUAL				: [26 + punctuator                                              ,              "^="],
		OR_EQUAL				: [27 + punctuator                                              ,              "|="],
		LAST_UNTAGGED			: [28 + punctuator                                              ,                ""],
		
	//  BINARY OPERATORS
		OR						: [ 0 + ( 1 << precedence) | ( 1 << precedence_shift)           ,              "||"],
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
		IN						: [14 + ( 7 << precedence) | keyword                            ,              "in"],
		LSHIFT					: [15 + ( 8 << precedence) | ( 8 << precedence_shift)           ,              "<<"],
		RSHIFT					: [16 + ( 8 << precedence) | ( 8 << precedence_shift)           ,              ">>"],
		URSHIFT					: [17 + ( 8 << precedence) | ( 8 << precedence_shift)           ,             ">>>"],
		PLUS					: [18 + ( 9 << precedence) | ( 9 << precedence_shift) | unary   ,               "+"],
		MINUS					: [19 + ( 9 << precedence) | ( 9 << precedence_shift) | unary   ,               "-"],
		MULT					: [20 + (10 << precedence) | (10 << precedence_shift)           ,               "*"],
		DIV						: [21 + (10 << precedence) | (10 << precedence_shift)           ,               "/"],
		MOD						: [22 + (10 << precedence) | (10 << precedence_shift)           ,               "%"],

	//  UNARY OPERATORS
		PLUSPLUS				: [0 + unary                                                    ,              "++"],
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
	};
	
	Object.extend(jsc.Token, {
		KindNames: kindNames,
		Kind: Object.freeze(kinds),
		Identifiers: Object.freeze(identifiers)
	});
	
})();

module.exports = jsc.Token;