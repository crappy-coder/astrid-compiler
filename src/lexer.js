var token = require("./token");
var utils = require("./utils");
var source = require("./source-code");
var text = require("./text");
var jsc = jsc || {};

jsc.Lexer = function(sourceCode) {
	if(utils.isNull(sourceCode))
		throw new Error("The sourceCode argument must not be null.");

	this.state = {
		lastTokenKind: token.Kind.UNKNOWN,
		lastLineNumber: 0,
		position: sourceCode.offsetBegin,
		end: sourceCode.offsetEnd,
		lineNumber: sourceCode.startLine,
		isReparsing: false,
		isLineBegin: true,
		hasLineTerminator: false,
		error: null
	};

	this.sourceCode = sourceCode;
	this.sourceBuffer = this.sourceCode.buffer;
	this.charBuffer = [];
	this.ch = this.current;
};

jsc.Lexer.prototype = {
	// gets the current character within the buffer
	get current() {
		if(this.position < this.state.end)
			return this.sourceBuffer.getChar(this.position);

		return 0;
	},
	

	// gets or sets the lexers current position within the buffer
	get position() {
		return this.state.position;
	},
	set position(value) {
		this.clearError();
		this.state.position = value;
		this.charBuffer = [];
		this.ch = this.current;
	},
	
	
	// gets or sets the current line number
	get lineNumber() {
		return this.state.lineNumber;
	},
	set lineNumber(value) {
		this.state.lineNumber = value;
	},
	
	
	// gets the last token kind
	get lastTokenKind() {
		return this.state.lastTokenKind;
	},
	

	// gets or sets the last line number
	get lastLineNumber() {
		return this.state.lastLineNumber; 
	},
	set lastLineNumber(value) {
		this.state.lastLineNumber = value;
	},
	
	
	// gets the last generated error
	get error() {
		return this.state.error;
	},
	
	
	// gets whether or not there is a current line terminator
	get hasLineTerminator() {
		return this.state.hasLineTerminator;
	},

	
	// gets or sets whether or not we are reparsing
	get isReparsing() {
		return this.state.isReparsing;
	},
	set isReparsing(value) {
		this.state.isReparsing = value;
	},
	
	
	// gets whether or not we've reached the end
	get isEnd() {
		return (!this.ch && this.position === this.state.end);
	},
	
	
	// gets whether or not the next token is a colon
	get isNextTokenColon() {
		
		while(this.state.position < this.state.end)
		{
			var nextChar = this.peek(this.state.position);
			
			if(text.TextUtils.isWhitespace(nextChar) || text.TextUtils.isLineTerminator(nextChar))
			{
				this.state.position++;
				continue;
			}
			
			break;
		}

		return (this.current === 0x3A);
	},
	
	
	// gets whether or not the last known token is a completion keyword
	get isLastTokenCompletionKeyword() {
		return (this.state.lastTokenKind === token.Kind.CONTINUE ||
				this.state.lastTokenKind === token.Kind.BREAK    ||
				this.state.lastTokenKind === token.Kind.RETURN   ||
				this.state.lastTokenKind === token.Kind.THROW);
	},
	
	
	next: function() {
		this.state.position++;
		this.ch = this.current;
	},
	
	nextLine: function() {
		if(!text.TextUtils.isLineTerminator(this.ch))
			this.throwOnError("Expected a line terminator");
			
		var prevChar = this.ch;
		
		this.next();

		// \n\r
		if(prevChar === 0x0A && this.ch === 0x0D)
			this.next();

		this.lineNumber++;
	},
	
	nextToken: function(tok, inStrictMode) {
		this.throwOnError();
		
		if(this.charBuffer.length)
			this.throwOnError("The character buffer is not empty. Cannot parse the next token with a non-empty character buffer.");
			
		this.state.hasLineTerminator = false;
		
		var tokKind = token.Kind.ERROR;
		
		begin: while(true) 
		{
			this.skipWhitespace();

			if(this.isEnd)
				return tok.Kind.EOF;
				
			tok.begin = this.position;
			
			switch(jsc.Lexer.getCharacterKind(this.ch))
			{
				case jsc.Lexer.CharacterKind.EQUAL:
					break;
				case jsc.Lexer.CharacterKind.LESS:
					break;
				case jsc.Lexer.CharacterKind.GREATER:
					break;
				case jsc.Lexer.CharacterKind.EXCLAMATION:
					break;
				case jsc.Lexer.CharacterKind.SLASH:
					break;
				case jsc.Lexer.CharacterKind.ADD:
					break;
				case jsc.Lexer.CharacterKind.SUBTRACT:
					break;
				case jsc.Lexer.CharacterKind.AND:
					break;
				case jsc.Lexer.CharacterKind.OR:
					break;
				case jsc.Lexer.CharacterKind.XOR:
					break;
				case jsc.Lexer.CharacterKind.MODULO:
					break;
				case jsc.Lexer.CharacterKind.COMMA:
					break;
				case jsc.Lexer.CharacterKind.COLON:
					break;
				case jsc.Lexer.CharacterKind.SEMICOLON:
					break;
				case jsc.Lexer.CharacterKind.QUESTION:
					break;
				case jsc.Lexer.CharacterKind.TILDE:
					break;
				case jsc.Lexer.CharacterKind.DOT:
					break;
				case jsc.Lexer.CharacterKind.QUOTE:
					break;
				case jsc.Lexer.CharacterKind.OPEN_PAREN:
					break;
				case jsc.Lexer.CharacterKind.CLOSE_PAREN:
					break;
				case jsc.Lexer.CharacterKind.OPEN_BRACKET:
					break;
				case jsc.Lexer.CharacterKind.CLOSE_BRACKET:
					break;
				case jsc.Lexer.CharacterKind.OPEN_BRACE:
					break;
				case jsc.Lexer.CharacterKind.CLOSE_BRACE:
					break;
				case jsc.Lexer.CharacterKind.ZERO:
					break;
				case jsc.Lexer.CharacterKind.NUMBER:
					break;
				case jsc.Lexer.CharacterKind.LINE_TERMINATOR:
					break;
				case jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN:
					this.throwOnError(!jsx.Lexer.isIdentifierBegin(this.ch));				
				case jsc.Lexer.CharacterKind.BACKSLASH:
					tokKind = this.parseIdentifier(tok, inStrictMode);
					break;
				case jsc.Lexer.CharacterKind.INVALID:
					break;
				default:
					break;
			}
		}
		
	},
	
	nextTokenImpl: function(tok, tokKind, inStrictMode) {

	},
	
	skipWhitespace: function() {
		while(text.TextUtils.isWhitespace(this.ch))
			this.next();
	},
	
	parseIdentifier: function(tok, inStrictMode) {
	
	},
	
	peek: function(offset) {
		if((this.position+offset) < this.state.end)
			return this.sourceBuffer.getChar(this.position+offset);

		return 0;
	},
	
	seek: function(offset) {
		this.state.position += offset;
		this.ch = this.current;
	},
	
	appendChar: function(ch) {
		this.charBuffer.push(ch);
	},
	
	appendString: function(index, length) {
		for(var i = index; i < length; i++)
			this.appendChar(this.sourceBuffer.getChar(i));
	},
	
	clear: function() {
		this.state.isReparsing = false;
		this.charBuffer = [];
	},
	
	setError: function(message) {
		this.state.error = message;
	},
	
	clearError: function() {
		this.state.error = null;
	},

	throwOnError: function(message) {
		// set and throw an immediate error when there is a message, otherwise
		// throw only when an error already exists
		if(!utils.isStringNullOrEmpty(message))
			this.setError(message);

		// only throw when an error exists
		if(!utils.isStringNullOrEmpty(this.state.error))
			throw new Error(this.state.error);
	}
};

jsc.Lexer.isIdentifierBegin = function(ch) {
	return (jsc.Lexer.CharacterKindMap[ch] === jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN);
};

jsc.Lexer.isIdentifierPart = function(ch) {
	return (jsc.Lexer.CharacterKindMap[ch] >= jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN);
};

jsc.Lexer.getCharacterKind = function(ch) {
	return jsc.Lexer.CharacterKindMap[ch];
};

(function() {

	// the IDENTIFIER_BEGIN kind and any kinds after it must
	// only be a kind that represent an identifier char, add
	// all other kinds before IDENTIFIER_BEGIN
	var charKinds = [
		"INVALID", "LINE_TERMINATOR", "EXCLAMATION", "OPEN_PAREN", "CLOSE_PAREN", "OPEN_BRACE", "CLOSE_BRACE", "OPEN_BRACKET", "CLOSE_BRACKET",
		"COMMA", "COLON", "SEMICOLON", "QUESTION", "TILDE", "QUOTE", "DOT", "SLASH", "BACKSLASH", "ADD", "SUBTRACT", "MULTIPLY", "MODULO", "AND",
		"OR", "XOR", "LESS", "GREATER", "EQUAL", "WHITESPACE", "IDENTIFIER_BEGIN", "ZERO", "NUMBER"
	];
	
	var charKindEnum = utils.createEnum(-1, charKinds);
	
	jsc.Lexer.CharacterKind = charKindEnum;
	jsc.Lexer.CharacterKindMap = [
		/*   0 - Null               */ charKindEnum.INVALID,
		/*   1 - Start of Heading   */ charKindEnum.INVALID,
		/*   2 - Start of Text      */ charKindEnum.INVALID,
		/*   3 - End of Text        */ charKindEnum.INVALID,
		/*   4 - End of Transm.     */ charKindEnum.INVALID,
		/*   5 - Enquiry            */ charKindEnum.INVALID,
		/*   6 - Acknowledgment     */ charKindEnum.INVALID,
		/*   7 - Bell               */ charKindEnum.INVALID,
		/*   8 - Back Space         */ charKindEnum.INVALID,
		/*   9 - Horizontal Tab     */ charKindEnum.WHITESPACE,
		/*  10 - Line Feed          */ charKindEnum.LINE_TERMINATOR,
		/*  11 - Vertical Tab       */ charKindEnum.WHITESPACE,
		/*  12 - Form Feed          */ charKindEnum.WHITESPACE,
		/*  13 - Carriage Return    */ charKindEnum.LINE_TERMINATOR,
		/*  14 - Shift Out          */ charKindEnum.INVALID,
		/*  15 - Shift In           */ charKindEnum.INVALID,
		/*  16 - Data Line Escape   */ charKindEnum.INVALID,
		/*  17 - Device Control 1   */ charKindEnum.INVALID,
		/*  18 - Device Control 2   */ charKindEnum.INVALID,
		/*  19 - Device Control 3   */ charKindEnum.INVALID,
		/*  20 - Device Control 4   */ charKindEnum.INVALID,
		/*  21 - Negative Ack.      */ charKindEnum.INVALID,
		/*  22 - Synchronous Idle   */ charKindEnum.INVALID,
		/*  23 - End of Transmit    */ charKindEnum.INVALID,
		/*  24 - Cancel             */ charKindEnum.INVALID,
		/*  25 - End of Medium      */ charKindEnum.INVALID,
		/*  26 - Substitute         */ charKindEnum.INVALID,
		/*  27 - Escape             */ charKindEnum.INVALID,
		/*  28 - File Separator     */ charKindEnum.INVALID,
		/*  29 - Group Separator    */ charKindEnum.INVALID,
		/*  30 - Record Separator   */ charKindEnum.INVALID,
		/*  31 - Unit Separator     */ charKindEnum.INVALID,
		/*  32 - Space              */ charKindEnum.WHITESPACE,
		/*  33 - !                  */ charKindEnum.EXCLAMATION,
		/*  34 - "                  */ charKindEnum.QUOTE,
		/*  35 - #                  */ charKindEnum.INVALID,
		/*  36 - $                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  37 - %                  */ charKindEnum.MODULO,
		/*  38 - &                  */ charKindEnum.AND,
		/*  39 - '                  */ charKindEnum.QUOTE,
		/*  40 - (                  */ charKindEnum.OPEN_PAREN,
		/*  41 - )                  */ charKindEnum.CLOSE_PAREN,
		/*  42 - *                  */ charKindEnum.MULTIPLY,
		/*  43 - +                  */ charKindEnum.ADD,
		/*  44 - ,                  */ charKindEnum.COMMA,
		/*  45 - -                  */ charKindEnum.SUBTRACT,
		/*  46 - .                  */ charKindEnum.DOT,
		/*  47 - /                  */ charKindEnum.SLASH,
		/*  48 - 0                  */ charKindEnum.ZERO,
		/*  49 - 1                  */ charKindEnum.NUMBER,
		/*  50 - 2                  */ charKindEnum.NUMBER,
		/*  51 - 3                  */ charKindEnum.NUMBER,
		/*  52 - 4                  */ charKindEnum.NUMBER,
		/*  53 - 5                  */ charKindEnum.NUMBER,
		/*  54 - 6                  */ charKindEnum.NUMBER,
		/*  55 - 7                  */ charKindEnum.NUMBER,
		/*  56 - 8                  */ charKindEnum.NUMBER,
		/*  57 - 9                  */ charKindEnum.NUMBER,
		/*  58 - :                  */ charKindEnum.COLON,
		/*  59 - ;                  */ charKindEnum.SEMICOLON,
		/*  60 - <                  */ charKindEnum.LESS,
		/*  61 - =                  */ charKindEnum.EQUAL,
		/*  62 - >                  */ charKindEnum.GREATER,
		/*  63 - ?                  */ charKindEnum.QUESTION,
		/*  64 - @                  */ charKindEnum.INVALID,
		/*  65 - A                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  66 - B                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  67 - C                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  68 - D                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  69 - E                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  70 - F                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  71 - G                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  72 - H                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  73 - I                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  74 - J                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  75 - K                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  76 - L                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  77 - M                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  78 - N                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  79 - O                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  80 - P                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  81 - Q                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  82 - R                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  83 - S                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  84 - T                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  85 - U                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  86 - V                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  87 - W                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  88 - X                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  89 - Y                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  90 - Z                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  91 - [                  */ charKindEnum.OPEN_BRACKET,
		/*  92 - \                  */ charKindEnum.BACKSLASH,
		/*  93 - ]                  */ charKindEnum.CLOSE_BRACKET,
		/*  94 - ^                  */ charKindEnum.XOR,
		/*  95 - _                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  96 - `                  */ charKindEnum.INVALID,
		/*  97 - a                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  98 - b                  */ charKindEnum.IDENTIFIER_BEGIN,
		/*  99 - c                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 100 - d                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 101 - e                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 102 - f                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 103 - g                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 104 - h                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 105 - i                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 106 - j                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 107 - k                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 108 - l                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 109 - m                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 110 - n                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 111 - o                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 112 - p                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 113 - q                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 114 - r                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 115 - s                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 116 - t                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 117 - u                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 118 - v                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 119 - w                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 120 - x                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 121 - y                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 122 - z                  */ charKindEnum.IDENTIFIER_BEGIN,
		/* 123 - {                  */ charKindEnum.OPEN_BRACE,
		/* 124 - |                  */ charKindEnum.OR,
		/* 125 - }                  */ charKindEnum.CLOSE_BRACE,
		/* 126 - ~                  */ charKindEnum.TILDE,
		/* 127 - Delete             */ charKindEnum.INVALID,
		/* 128 - Cc category        */ charKindEnum.INVALID,
		/* 129 - Cc category        */ charKindEnum.INVALID,
		/* 130 - Cc category        */ charKindEnum.INVALID,
		/* 131 - Cc category        */ charKindEnum.INVALID,
		/* 132 - Cc category        */ charKindEnum.INVALID,
		/* 133 - Cc category        */ charKindEnum.INVALID,
		/* 134 - Cc category        */ charKindEnum.INVALID,
		/* 135 - Cc category        */ charKindEnum.INVALID,
		/* 136 - Cc category        */ charKindEnum.INVALID,
		/* 137 - Cc category        */ charKindEnum.INVALID,
		/* 138 - Cc category        */ charKindEnum.INVALID,
		/* 139 - Cc category        */ charKindEnum.INVALID,
		/* 140 - Cc category        */ charKindEnum.INVALID,
		/* 141 - Cc category        */ charKindEnum.INVALID,
		/* 142 - Cc category        */ charKindEnum.INVALID,
		/* 143 - Cc category        */ charKindEnum.INVALID,
		/* 144 - Cc category        */ charKindEnum.INVALID,
		/* 145 - Cc category        */ charKindEnum.INVALID,
		/* 146 - Cc category        */ charKindEnum.INVALID,
		/* 147 - Cc category        */ charKindEnum.INVALID,
		/* 148 - Cc category        */ charKindEnum.INVALID,
		/* 149 - Cc category        */ charKindEnum.INVALID,
		/* 150 - Cc category        */ charKindEnum.INVALID,
		/* 151 - Cc category        */ charKindEnum.INVALID,
		/* 152 - Cc category        */ charKindEnum.INVALID,
		/* 153 - Cc category        */ charKindEnum.INVALID,
		/* 154 - Cc category        */ charKindEnum.INVALID,
		/* 155 - Cc category        */ charKindEnum.INVALID,
		/* 156 - Cc category        */ charKindEnum.INVALID,
		/* 157 - Cc category        */ charKindEnum.INVALID,
		/* 158 - Cc category        */ charKindEnum.INVALID,
		/* 159 - Cc category        */ charKindEnum.INVALID,
		/* 160 - Zs category (nbsp) */ charKindEnum.WHITESPACE,
		/* 161 - Po category        */ charKindEnum.INVALID,
		/* 162 - Sc category        */ charKindEnum.INVALID,
		/* 163 - Sc category        */ charKindEnum.INVALID,
		/* 164 - Sc category        */ charKindEnum.INVALID,
		/* 165 - Sc category        */ charKindEnum.INVALID,
		/* 166 - So category        */ charKindEnum.INVALID,
		/* 167 - So category        */ charKindEnum.INVALID,
		/* 168 - Sk category        */ charKindEnum.INVALID,
		/* 169 - So category        */ charKindEnum.INVALID,
		/* 170 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 171 - Pi category        */ charKindEnum.INVALID,
		/* 172 - Sm category        */ charKindEnum.INVALID,
		/* 173 - Cf category        */ charKindEnum.INVALID,
		/* 174 - So category        */ charKindEnum.INVALID,
		/* 175 - Sk category        */ charKindEnum.INVALID,
		/* 176 - So category        */ charKindEnum.INVALID,
		/* 177 - Sm category        */ charKindEnum.INVALID,
		/* 178 - No category        */ charKindEnum.INVALID,
		/* 179 - No category        */ charKindEnum.INVALID,
		/* 180 - Sk category        */ charKindEnum.INVALID,
		/* 181 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 182 - So category        */ charKindEnum.INVALID,
		/* 183 - Po category        */ charKindEnum.INVALID,
		/* 184 - Sk category        */ charKindEnum.INVALID,
		/* 185 - No category        */ charKindEnum.INVALID,
		/* 186 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 187 - Pf category        */ charKindEnum.INVALID,
		/* 188 - No category        */ charKindEnum.INVALID,
		/* 189 - No category        */ charKindEnum.INVALID,
		/* 190 - No category        */ charKindEnum.INVALID,
		/* 191 - Po category        */ charKindEnum.INVALID,
		/* 192 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 193 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 194 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 195 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 196 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 197 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 198 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 199 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 200 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 201 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 202 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 203 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 204 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 205 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 206 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 207 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 208 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 209 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 210 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 211 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 212 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 213 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 214 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 215 - Sm category        */ charKindEnum.INVALID,
		/* 216 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 217 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 218 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 219 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 220 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 221 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 222 - Lu category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 223 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 224 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 225 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 226 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 227 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 228 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 229 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 230 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 231 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 232 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 233 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 234 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 235 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 236 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 237 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 238 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 239 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 240 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 241 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 242 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 243 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 244 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 245 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 246 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 247 - Sm category        */ charKindEnum.INVALID,
		/* 248 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 249 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 250 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 251 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 252 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 253 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 254 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN,
		/* 255 - Ll category        */ charKindEnum.IDENTIFIER_BEGIN
	];
})()


module.exports = {
	create: function(text, url, startLine, startIndex, endIndex) {
		return new jsc.Lexer(new source.SourceCode(text, url, startLine, startIndex, endIndex));
	}
}