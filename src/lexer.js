var jsc = require("./jsc");

jsc.Lexer = Object.define({
	initialize: function(sourceCode) {
		if(jsc.Utils.isNull(sourceCode))
			throw new Error("The sourceCode argument must not be null.");

		this.state = {
			lastTokenKind: jsc.Token.Kind.UNKNOWN,
			lastLineNumber: 0,
			position: sourceCode.offsetBegin,
			end: sourceCode.offsetEnd,
			lineNumber: sourceCode.startLine,
			isReparsing: false,
			isLineBegin: true,
			hasLineTerminator: false,
			error: null,
			debugMode: false
		};

		this.sourceCode = sourceCode;
		this.sourceBuffer = this.sourceCode.buffer;
		this.chBuffer = [];
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
		this.chLast = null;
	},

	// gets or sets whether or not to output debugging information
	get debugMode() {
		return this.state.debugMode;
	},
	set debugMode(value) {
		this.state.debugMode = value;
	},

	// gets or sets the lexers current position within the buffer
	get position() {
		return this.state.position;
	},
	set position(value) {
		this.clearError();
		this.state.position = value;
		this.chBuffer = [];
		this.chLast = this.ch;
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
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
		return (!this.chCode && this.position === this.state.end);
	},


	// gets whether or not the next token is a colon
	get isNextTokenColon() {

		while(this.state.position < this.state.end)
		{
			var nextChar = this.peek(this.state.position);

			if(jsc.TextUtils.isWhitespace(nextChar) || jsc.TextUtils.isLineTerminator(nextChar))
			{
				this.state.position++;
				continue;
			}

			break;
		}

		return (this.getChar() === ':');
	},


	// gets whether or not the last known token is a completion keyword
	get isLastTokenCompletionKeyword() {
		return (this.state.lastTokenKind === jsc.Token.Kind.CONTINUE ||
		this.state.lastTokenKind === jsc.Token.Kind.BREAK    ||
		this.state.lastTokenKind === jsc.Token.Kind.RETURN   ||
		this.state.lastTokenKind === jsc.Token.Kind.THROW);
	},


	next: function() {
		this.state.position++;
		this.chLast = this.ch;
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
	},

	nextLine: function() {
		if(!jsc.TextUtils.isLineTerminator(this.ch))
			this.throwOnError("Expected a line terminator");

		var prevChar = this.ch;

		this.next();

		if(prevChar === '\n' && this.ch === '\r')
			this.next();

		this.lineNumber++;
	},

	nextToken: function(tok, inStrictMode) {
		inStrictMode = jsc.Utils.valueOrDefault(inStrictMode, false);

		this.throwOnError();

		if(this.chBuffer.length)
			this.throwOnError("The character buffer is not empty. Cannot parse the next token with a non-empty character buffer.");

		this.state.hasLineTerminator = false;

		var tokKind = jsc.Token.Kind.ERROR;
		var hasError = false;
		var inSingleLineComment = false;
		var inNumber = false;
		var validateNumericLiteral = false;

		loop:
			while(true)
			{
				this.skipWhitespace();

				if(this.isEnd)
					return jsc.Token.Kind.EOF;

				tok.begin = this.position;

				switch(jsc.Lexer.getCharacterKind(this.chCode))
				{
					case jsc.Lexer.CharacterKind.EQUAL:
					{
						this.next();

						if(this.ch === '=')
						{
							this.next();

							if(this.ch === '=')
							{
								this.next();
								tokKind = jsc.Token.Kind.STRICT_EQUAL;
								break loop;
							}

							tokKind = jsc.Token.Kind.EQUAL_EQUAL;
							break loop;
						}

						tokKind = jsc.Token.Kind.EQUAL;
						break loop;
					}
					case jsc.Lexer.CharacterKind.LESS:
					{
						this.next();

						// start of a www line comment '<!--'
						if(this.ch === '!' && this.peek(1) === '-' && this.peek(2) === '-')
						{
							inSingleLineComment = true;
							break;
						}

						if(this.ch === '<')
						{
							this.next();

							// '<<='
							if(this.ch === '=')
							{
								this.next();
								tokKind = jsc.Token.Kind.LSHIFT_EQUAL;
								break loop;
							}

							// '<<'
							tokKind = jsc.Token.Kind.LSHIFT;
							break loop;
						}

						// '<='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.LESS_EQUAL;
							break loop;
						}

						// '<'
						tokKind = jsc.Token.Kind.LESS;
						break loop;
					}
					case jsc.Lexer.CharacterKind.GREATER:
					{
						this.next();

						if(this.ch === '>')
						{
							this.next();

							if(this.ch === '>')
							{
								this.next();

								// '>>>='
								if(this.ch === '=')
								{
									this.next();
									tokKind = jsc.Token.Kind.URSHIFT_EQUAL;
									break loop;
								}

								// '>>>'
								tokKind = jsc.Token.Kind.URSHIFT;
								break loop;
							}

							// '>>='
							if(this.ch === '=')
							{
								this.next();
								tokKind = jsc.Token.Kind.RSHIFT_EQUAL;
								break loop;
							}

							// '>>'
							tokKind = jsc.Token.Kind.RSHIFT;
							break loop;
						}

						// '>='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.GREATER_EQUAL;
							break loop;
						}

						// '>'
						tokKind = jsc.Token.Kind.GREATER;
						break loop;
					}
					case jsc.Lexer.CharacterKind.EXCLAMATION:
					{
						this.next();

						if(this.ch === '=')
						{
							this.next();

							// '!=='
							if(this.ch === '=')
							{
								this.next();
								tokKind = jsc.Token.Kind.STRICT_NOT_EQUAL;
								break loop;
							}

							// '!='
							tokKind = jsc.Token.Kind.NOT_EQUAL;
							break loop;
						}

						// '!'
						tokKind = jsc.Token.Kind.EXCLAMATION;
						break loop;
					}
					case jsc.Lexer.CharacterKind.SLASH:
					{
						this.next();

						if(this.ch === '/')
						{
							this.next();
							inSingleLineComment = true;
							break;
						}

						if(this.ch === '*')
						{
							this.next();

							if(this.parseMultilineComment())
								continue loop;

							hasError = true;
							this.setError("Multiline comment was not properly closed.");
							break;
						}

						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.DIV_EQUAL;
							break loop;
						}

						tokKind = jsc.Token.Kind.DIV;
						break loop;
					}
					case jsc.Lexer.CharacterKind.ADD:
					{
						this.next();

						// '++'
						if(this.ch === '+')
						{
							this.next();
							tokKind = (!this.hasLineTerminator ? jsc.Token.Kind.PLUSPLUS : jsc.Token.Kind.PLUSPLUS_AUTO);
							break loop;
						}

						// '+='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.PLUS_EQUAL;
							break loop;
						}

						// '+'
						tokKind = jsc.Token.Kind.PLUS;
						break loop;
					}
					case jsc.Lexer.CharacterKind.SUBTRACT:
					{
						this.next();

						if(this.ch === '-')
						{
							this.next();

							// '-->' www end comment
							if(this.ch === '>' && this.state.isLineBegin)
							{
								this.next();
								inSingleLineComment = true;
								break;
							}

							// '--'
							tokKind = (!this.hasLineTerminator ? jsc.Token.Kind.MINUSMINUS : jsc.Token.Kind.MINUSMINUS_AUTO);
							break loop;
						}

						// '-='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.MINUS_EQUAL;
							break loop;
						}

						// '-'
						tokKind = jsc.Token.Kind.MINUS;
						break loop;
					}
					case jsc.Lexer.CharacterKind.MULTIPLY:
					{
						this.next();

						// '*='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.MULT_EQUAL;
							break loop;
						}

						// '*'
						tokKind = jsc.Token.Kind.MULT;
						break loop;
					}
					case jsc.Lexer.CharacterKind.AND:
					{
						this.next();

						// '&&'
						if(this.ch === '&')
						{
							this.next();
							tokKind = jsc.Token.Kind.AND;
							break loop;
						}

						// '&='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.AND_EQUAL;
							break loop;
						}

						// '&'
						tokKind = jsc.Token.Kind.BITWISE_AND;
						break loop;
					}
					case jsc.Lexer.CharacterKind.OR:
					{
						this.next();

						// '|='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.OR_EQUAL;
							break loop;
						}

						// '||'
						if(this.ch === '|')
						{
							this.next();
							tokKind = jsc.Token.Kind.OR;
							break loop;
						}

						// '|'
						tokKind = jsc.Token.Kind.BITWISE_OR;
						break loop;
					}
					case jsc.Lexer.CharacterKind.XOR:
					{
						this.next();

						// '^='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.XOR_EQUAL;
							break loop;
						}

						// '^'
						tokKind = jsc.Token.Kind.BITWISE_XOR;
						break loop;
					}
					case jsc.Lexer.CharacterKind.MODULO:
					{
						this.next();

						// '%='
						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.MOD_EQUAL;
							break loop;
						}

						// '%'
						tokKind = jsc.Token.Kind.MOD;
						break loop;
					}
					case jsc.Lexer.CharacterKind.COMMA:
					{
						this.next();
						tokKind = jsc.Token.Kind.COMMA;
						break loop;
					}
					case jsc.Lexer.CharacterKind.COLON:
					{
						this.next();
						tokKind = jsc.Token.Kind.COLON;
						break loop;
					}
					case jsc.Lexer.CharacterKind.SEMICOLON:
					{
						this.next();
						tokKind = jsc.Token.Kind.SEMICOLON;
						break loop;
					}
					case jsc.Lexer.CharacterKind.QUESTION:
					{
						this.next();
						tokKind = jsc.Token.Kind.QUESTION;
						break loop;
					}
					case jsc.Lexer.CharacterKind.TILDE:
					{
						this.next();
						tokKind = jsc.Token.Kind.TILDE;
						break loop;
					}
					case jsc.Lexer.CharacterKind.DOT:
					{
						this.next();

						if(!jsc.TextUtils.isDigit(this.ch))
						{
							tokKind = jsc.Token.Kind.DOT;
							break loop;
						}

						inNumber = true;
						break;
					}
					case jsc.Lexer.CharacterKind.QUOTE:
					{
						if(!this.parseString(tok, inStrictMode))
						{
							hasError = true;
							break;
						}

						this.next();
						tokKind = jsc.Token.Kind.STRING;
						break loop;
					}
					case jsc.Lexer.CharacterKind.OPEN_PAREN:
					{
						tokKind = jsc.Token.Kind.OPEN_PAREN;
						this.next();

						break loop;
					}
					case jsc.Lexer.CharacterKind.CLOSE_PAREN:
					{
						tokKind = jsc.Token.Kind.CLOSE_PAREN;
						this.next();

						break loop;
					}
					case jsc.Lexer.CharacterKind.OPEN_BRACKET:
					{
						this.next();
						tokKind = jsc.Token.Kind.OPEN_BRACKET;
						break loop;
					}
					case jsc.Lexer.CharacterKind.CLOSE_BRACKET:
					{
						this.next();
						tokKind = jsc.Token.Kind.CLOSE_BRACKET;
						break loop;
					}
					case jsc.Lexer.CharacterKind.OPEN_BRACE:
					{
						tokKind = jsc.Token.Kind.OPEN_BRACE;
						tok.value = this.position;
						this.next();

						break loop;
					}
					case jsc.Lexer.CharacterKind.CLOSE_BRACE:
					{
						tokKind = jsc.Token.Kind.CLOSE_BRACE;
						tok.value = this.position;
						this.next();

						break loop;
					}
					case jsc.Lexer.CharacterKind.ZERO:
					{
						this.next();

						if((this.ch === 'x' || this.ch === 'X') && jsc.TextUtils.isHexDigit(this.peek(1)))
						{
							this.parseHex(tok);
							tokKind = jsc.Token.Kind.NUMBER;
							validateNumericLiteral = true;
							break;
						}
						else
						{
							this.appendChar('0');

							if(jsc.TextUtils.isOctalDigit(this.ch))
							{
								if(this.parseOctal(tok))
								{
									if(inStrictMode)
									{
										hasError = true;
										this.setError("Octal escape sequences are not allowed in strict mode.");
										break;
									}

									tokKind = jsc.Token.Kind.NUMBER;
									validateNumericLiteral = true;
									break;
								}
							}
						}

					} // fall through to Number
					case jsc.Lexer.CharacterKind.NUMBER:
					{
						inNumber = true;

						if(tokKind !== jsc.Token.Kind.NUMBER)
							tokKind = jsc.Token.Kind.NUMBER;

						break;
					}
					case jsc.Lexer.CharacterKind.LINE_TERMINATOR:
					{
						if(!jsc.TextUtils.isLineTerminator(this.ch))
							this.throwOnError(jsc.Utils.format("Expected a line terminator. Actual character found: '%s'.", this.ch));

						this.nextLine();

						this.state.isLineBegin = true;
						this.state.hasLineTerminator = true;
						break;
					}
					case jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN:
					{
						if(!jsc.Lexer.isIdentifierBegin(this.chCode))
							this.throwOnError(jsc.Utils.format("Expected an identifier begin character. Actual character found: '%s'.", this.ch));
					}
					case jsc.Lexer.CharacterKind.BACKSLASH:
					{
						tokKind = this.parseIdentifier(tok, inStrictMode);
						break loop;
					}
					case jsc.Lexer.CharacterKind.INVALID:
					{
						hasError = true;
						this.setError("Invalid character.");
						break;
					}
					default:
					{
						hasError = true;
						this.setError("Unknown error.");
						break;
					}
				}

				if(inNumber)
				{
					inNumber = false;

					switch(1)
					{
						default:
						{
							if(this.chLast === '.' || !this.parseDecimal(tok))
							{
								if(this.ch === '.')
									this.next();

								if(this.chLast === '.')
									this.parseNumberAfterDecimalPoint();

								if(this.ch === 'e' || this.ch === 'E')
								{
									if(!this.parseNumberAfterExponent())
									{
										hasError = true;
										this.setError("Non-Number was found after the exponent indicator.");
										break;
									}
								}

								tok.value = parseFloat(this.chBuffer.join(""));
								tokKind = jsc.Token.Kind.NUMBER;
							}
						}
					}

					validateNumericLiteral = true;
				}

				if(validateNumericLiteral)
				{
					validateNumericLiteral = false;

					// no identifiers are allowed directly after a numeric literal, i.e. "1cm"
					if(jsc.Lexer.isIdentifierBegin(this.chCode))
					{
						hasError = true;
						this.setError("At least one digit must occur after a decimal point.");
						break;
					}

					this.chBuffer = [];
					break loop;
				}

				if(hasError)
					break;

				if(inSingleLineComment)
				{
					while(!jsc.TextUtils.isLineTerminator(this.ch))
					{
						if(this.isEnd)
							return jsc.Token.Kind.EOF;

						this.next();
					}

					this.nextLine();

					this.state.isLineBegin = true;
					this.state.hasLineTerminator = true;

					if(!this.isLastTokenCompletionKeyword)
					{
						inSingleLineComment = false;
						continue;
					}

					tokKind = jsc.Token.Kind.SEMICOLON;
					break;
				}
			}

		tok.line = this.lineNumber;
		tok.end = this.position;

		if(hasError)
			return jsc.Token.Kind.ERROR;

		if(!inSingleLineComment)
			this.state.isLineBegin = false;

		this.state.lastTokenKind = tokKind;
		tok.kind = tokKind

		return tokKind;
	},

	nextIdentifier: function(tok, inStrictMode) {
		var startOffset = this.position;

		if(this.position >= this.state.end)
		{
			if(this.position !== this.state.end)
				this.throwOnError("Reached the end of file.");

			return this.nextToken(tok, inStrictMode);
		}

		if(!jsc.TextUtils.isAlpha(this.getChar()))
			return this.nextToken(tok, inStrictMode);

		++this.position;

		while(this.position < this.state.end)
		{
			if(!jsc.TextUtils.isAlphaNumeric(this.getChar()))
				break;

			++this.position;
		}

		if(this.position >= this.state.end)
		{
			this.ch = '\0';
			this.chCode = 0;
		}
		else
		{
			var currentChar = this.getChar();
			var currentCharCode = this.getCharCode();

			if(!jsc.TextUtils.isAscii(currentChar) || currentChar === '\\' || currentChar === '_' || currentChar === '$')
				return this.nextToken(tok, inStrictMode);

			this.ch = currentChar;
			this.chCode = currentCharCode;
		}

		this.appendString(startOffset, this.position - startOffset);

		tok.line = this.lineNumber;
		tok.begin = startOffset;
		tok.end = this.position;
		tok.value = this.chBuffer.join("");

		this.chBuffer = [];
		this.state.lastTokenKind = jsc.Token.Kind.IDENTIFIER;

		return this.state.lastTokenKind;
	},

	scanRegEx: function(patternPrefix) {
		patternPrefix = jsc.Utils.valueOrDefault(patternPrefix, '\0');

		if(this.chBuffer.length)
			this.throwOnError("Character buffer has not been emptied.");

		var lastCharIsEscape = false;
		var inBrackets = false;
		var pattern = null;
		var flags = null;

		if(patternPrefix !== '\0')
		{
			if(jsc.TextUtils.isLineTerminator(patternPrefix))
				this.throwOnError("The regular expression patternPrefix cannot be a line terminator.");

			if(patternPrefix === '/')
				this.throwOnError("The regular expression patternPrefix cannot be a '/' character.");

			if(patternPrefix === '[')
				this.throwOnError("The regular expression patternPrefix cannot be a '[' character.");

			this.appendChar(patternPrefix);
		}

		while(true)
		{
			if(jsc.TextUtils.isLineTerminator(this.ch) || this.isEnd)
			{
				this.chBuffer = [];
				return null;
			}

			var prevChar = this.ch;

			this.next();

			if(prevChar === '/' && !lastCharIsEscape && !inBrackets)
				break;

			this.appendChar(prevChar);

			if(lastCharIsEscape)
			{
				lastCharIsEscape = false;
				continue;
			}

			switch(prevChar)
			{
				case '[':
					inBrackets = true;
					break;
				case ']':
					inBrackets = false;
					break;
				case '\\':
					lastCharIsEscape = true;
					break;
			}
		}

		pattern = this.chBuffer.join("");
		this.chBuffer = [];

		while(jsc.Lexer.isIdentifierPart(this.chCode))
		{
			this.appendChar(this.ch);
			this.next();
		}

		flags = this.chBuffer.join("");
		this.chBuffer = [];

		return {
			pattern: pattern,
			patternPrefix: patternPrefix,
			flags: flags
		};
	},

	skipRegEx: function() {
		var lastCharIsEscape = false;
		var inBrackets = false;

		while(true)
		{
			if(jsc.TextUtils.isLineTerminator(this.ch) || this.isEnd)
				return false;

			var prevChar = this.ch;

			this.next();

			if(prevChar === '/' && !lastCharIsEscape && !inBrackets)
				break;

			if(lastCharIsEscape)
			{
				lastCharIsEscape = false;
				continue;
			}

			switch(prevChar)
			{
				case '[':
					inBrackets = true;
					break;
				case ']':
					inBrackets = false;
					break;
				case '\\':
					lastCharIsEscape = true;
					break;
			}
		}

		while(jsc.Lexer.isIdentifierPart(this.chCode))
			this.next();

		return true;
	},

	skipWhitespace: function() {
		while(jsc.TextUtils.isWhitespace(this.ch))
			this.next();
	},

	parseIdentifier: function(tok, inStrictMode) {
		var remain = this.state.end - this.position;

		if(remain >= jsc.Lexer.MAX_KEYWORD_LENGTH)
		{
			var keyword = this.parseKeyword(tok);

			if(keyword !== jsc.Token.Kind.IDENTIFIER)
			{
				if(jsc.Utils.isNull(tok.value))
					this.throwOnError("The token has no identifier value.");

				return (keyword === jsc.Token.Kind.RESERVED_STRICT && !inStrictMode ? jsc.Token.Kind.IDENTIFIER : keyword);
			}
		}

		var identifierBeginIndex = this.position;

		while(jsc.Lexer.isIdentifierPart(this.chCode))
			this.next();

		if(this.ch === '\\')
		{
			this.position = identifierBeginIndex;
			return this.parseIdentifierOrEscape(tok, inStrictMode);
		}

		tok.value = this.getString(identifierBeginIndex, this.position - identifierBeginIndex);

		if(remain < jsc.Lexer.MAX_KEYWORD_LENGTH)
		{
			var identifierTokenKind = jsc.Lexer.getTokenKindFromIdentifier(tok.value);

			if(identifierTokenKind === jsc.Token.Kind.UNKNOWN)
				return jsc.Token.Kind.IDENTIFIER;

			return (identifierTokenKind !== jsc.Token.Kind.RESERVED_STRICT || inStrictMode ? identifierTokenKind : jsc.Token.Kind.IDENTIFIER);
		}

		return jsc.Token.Kind.IDENTIFIER;
	},

	parseIdentifierOrEscape: function(tok, inStrictMode) {
		var remain = this.state.end - this.position;
		var identifierBeginIndex = this.position;
		var identifierBeginChar = this.getChar();
		var identifierBeginCharCode = this.getCharCode();
		var useBuffer = false;
		var i, len;

		while(true)
		{
			if(jsc.Lexer.isIdentifierPart(this.chCode))
			{
				this.next();
				continue;
			}

			if(this.ch !== '\\')
				break;

			// \uXXXX unicode characters
			useBuffer = true;

			if(identifierBeginCharCode !== this.getCharCode())
			{
				len = this.position - identifierBeginIndex;

				for(i = 0; i < len; i++)
					this.appendChar(identifierBeginChar);
			}

			this.next();

			if(this.ch !== 'u')
				return jsc.Token.Kind.ERROR;

			this.next();

			var unicodeCharCode = this.parseUnicodeHexCode();

			if(unicodeCharCode === null)
				return jsc.Token.Kind.ERROR;

			if(this.chBuffer.length ? !jsc.Lexer.isIdentifierPart(unicodeCharCode) : !jsc.Lexer.isIdentifierBegin(unicodeCharCode))
				return jsc.Token.Kind.ERROR;

			this.appendChar(String.fromCharCode(unicodeCharCode));

			identifierBeginIndex = this.position;
			identifierBeginChar = this.getChar();
			identifierBeginCharCode = this.getCharCode();
		}

		var identifierLength = 0;
		var identifier = null;

		if(!useBuffer)
		{
			identifierLength = this.position - identifierBeginIndex;

			for(i = identifierBeginIndex; i < identifierLength; i++)
				identifier += this.sourceBuffer.getChar(i);
		}
		else
		{
			if(identifierBeginCharCode !== this.getCharCode())
			{
				len = this.position - identifierBeginIndex;

				for(i = 0; i < len; i++)
					this.appendChar(identifierBeginChar);
			}

			identifier = this.chBuffer.join("");
		}

		tok.value = identifier;

		if(!useBuffer)
		{
			if(remain < jsc.Lexer.MAX_KEYWORD_LENGTH)
			{
				var tokKind = jsc.Lexer.getTokenKindFromIdentifier(tok.value);

				if(tokKind === jsc.Token.Kind.UNKNOWN)
					return jsc.Token.Kind.IDENTIFIER;

				return (tokKind !== jsc.Token.Kind.RESERVED_STRICT || inStrictMode ? tokKind : jsc.Token.Kind.IDENTIFIER);
			}

			return jsc.Token.Kind.IDENTIFIER
		}

		this.chBuffer = [];

		return jsc.Token.Kind.IDENTIFIER;
	},

	parseKeyword: function(tok) {
		if((this.state.end - this.position) < jsc.Lexer.MAX_KEYWORD_LENGTH)
			this.throwOnError("Unable to parse keyword.");

		var c = this.getChar();

		for(var keyword in jsc.Token.Identifiers)
		{
			if(!jsc.Token.Identifiers.hasOwnProperty(keyword))
				continue;

			if(c === keyword[0] && this.compareString(keyword))
			{
				if(!jsc.Lexer.isIdentifierPart(this.peek(keyword.length)))
				{
					this.seek(keyword.length);
					tok.value = keyword;
					return jsc.Token.Identifiers[keyword];
				}
			}
		}

		return jsc.Token.Kind.IDENTIFIER;
	},

	parseString: function(tok, inStrictMode) {
		var quoteChar = this.ch;

		this.next();

		var startOffset = this.position;

		while(this.ch !== quoteChar)
		{
			if(this.ch === '\\')
			{
				if(startOffset !== this.position)
					this.appendString(startOffset, this.position - startOffset);

				this.next();

				var escapeChar = jsc.TextUtils.getEscapeChar(this.ch);

				if(escapeChar)
				{
					this.appendChar(escapeChar);
					this.next();
				}
				else if(jsc.TextUtils.isLineTerminator(this.ch))
					this.nextLine();
				else if(this.ch === 'x')
				{
					this.next();

					if(!jsc.TextUtils.isHexDigit(this.ch) || !jsc.TextUtils.isHexDigit(this.peek(1)))
					{
						this.setError("\\x can only be followed by a hex character sequence.");
						return false;
					}

					this.appendChar(String.fromCharCode(parseInt(this.ch+this.peek(1), 16)));
					this.seek(2);
				}
				else if(this.ch === 'u')
				{
					this.next();

					var unicodeChar = this.parseUnicodeHex();

					if(unicodeChar !== null)
						this.appendChar(unicodeChar);
					else if(this.ch === quoteChar)
						this.appendChar('u');
					else
					{
						this.setError("\\u can only be followed by a Unicode character sequence.");
						return false;
					}
				}
				else if(inStrictMode && jsc.TextUtils.isDigit(this.ch))
				{
					var prevChar = this.ch;

					this.next();

					if(prevChar !== '0' || jsc.TextUtils.isDigit(this.ch))
					{
						this.setError("The only valid numeric escape in strict mode is '\\0'.");
						return false;
					}

					this.appendChar('\0');
				}
				else if(!inStrictMode && jsc.TextUtils.isOctalDigit(this.ch))
				{
					var octalChars = [];

					for(var i = 0; i < 3; i++)
					{
						if(!jsc.TextUtils.isOctalDigit(this.ch))
							break;

						octalChars[i] = this.ch;
						this.next();
					}

					this.appendChar(String.fromCharCode(parseInt(octalChars.join(""), 8)));
				}
				else if(!this.isEnd)
				{
					this.appendChar(this.ch);
					this.next();
				}
				else
				{
					this.setError("Unterminated string constant.");
					return false;
				}

				startOffset = this.position;
				continue;
			}

			if(this.isEnd || jsc.TextUtils.isLineTerminator(this.ch))
			{
				this.setError("Unexpected end of file.");
				return false;
			}

			this.next();
		}

		if(this.position !== startOffset)
			this.appendString(startOffset, this.position - startOffset);

		tok.value = this.chBuffer.join("");
		this.chBuffer = [];

		return true;
	},

	parseMultilineComment: function() {
		while(true)
		{
			while(this.ch === '*')
			{
				this.next();

				if(this.ch === '/')
				{
					this.next();
					return true;
				}
			}

			if(this.isEnd)
				return false;

			if(!jsc.TextUtils.isLineTerminator(this.ch))
				this.next();
			else
			{
				this.nextLine();
				this.state.hasLineTerminator = true;
			}
		}
	},

	parseDecimal: function(tok) {
		var decimalValue = 0;

		if(!this.chBuffer.length)
		{
			var maxDigits = 9;
			var digits = [];

			do
			{
				decimalValue = decimalValue * 10 + (this.chCode - 0x30);
				digits[maxDigits--] = this.ch;

				this.next();
			}
			while(jsc.TextUtils.isDigit(this.ch) && maxDigits >= 0);

			if(maxDigits >= 0 && this.ch !== '.' && this.ch !== 'e' && this.ch !== 'E')
			{
				tok.value = decimalValue;
				return true;
			}

			for(var i = 9; i > maxDigits; --i)
				this.appendChar(digits[i]);
		}

		while(jsc.TextUtils.isDigit(this.ch))
		{
			this.appendChar(this.ch);
			this.next();
		}

		return false;
	},

	parseHex: function(tok) {
		this.next();

		while(jsc.TextUtils.isHexDigit(this.ch))
		{
			this.appendChar(this.ch);
			this.next();
		}

		tok.value = parseInt(this.chBuffer.join(""), 16);
		return true;
	},

	parseUnicodeHexCode: function() {
		var a = this.ch;
		var b = this.peek(1);
		var c = this.peek(2);
		var d = this.peek(3);

		if(!jsc.TextUtils.isHexDigit(a) || !jsc.TextUtils.isHexDigit(b) || !jsc.TextUtils.isHexDigit(c) || !jsc.TextUtils.isHexDigit(d))
			return null;

		this.seek(4);

		return parseInt(a+b+c+d, 16);
	},

	parseUnicodeHex: function() {
		var code = this.parseUnicodeHexCode();

		if(code === null)
			return null;

		return String.fromCharCode(code);
	},

	parseOctal: function(tok) {
		while(jsc.TextUtils.isOctalDigit(this.ch))
		{
			this.appendChar(this.ch);
			this.next();
		}

		tok.value = parseInt(this.chBuffer.join(""), 8);
		return true;
	},

	parseDigit: function(code, radix) {

	},

	parseNumberAfterDecimalPoint: function() {
		this.appendChar('.');

		while(jsc.TextUtils.isDigit(this.ch))
		{
			this.appendChar(this.ch);
			this.next();
		}

		return true;
	},

	parseNumberAfterExponent: function() {
		this.appendChar('e');
		this.next();

		if(this.ch === '+' || this.ch === '-')
		{
			this.appendChar(this.ch);
			this.next();
		}

		if(!jsc.TextUtils.isDigit(this.ch))
			return false;

		do
		{
			this.appendChar(this.ch);
			this.next();
		}
		while(jsc.TextUtils.isDigit(this.ch));

		return true;
	},

	compareString: function(str) {
		for(var i = 0; i < str.length; i++)
		{
			if(this.peek(i) !== str[i])
				return false;
		}

		return true;
	},

	peek: function(offset) {
		if((this.position+offset) < this.state.end)
			return this.sourceBuffer.getChar(this.position+offset);

		return null;
	},

	seek: function(offset) {
		this.state.position += offset;
		this.chLast = this.ch;
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
	},

	getChar: function() {
		if(this.position < this.state.end)
			return this.sourceBuffer.getChar(this.position);

		return '\0';
	},

	getCharCode: function() {
		if(this.position < this.state.end)
			return this.sourceBuffer.getCharCode(this.position);

		return 0;
	},

	getString: function(offset, len) {
		return this.sourceBuffer.toString(offset, len);
	},

	appendChar: function(ch) {
		this.chBuffer.push(ch);
	},

	appendString: function(index, length) {
		for(var i = index; i < index+length; i++)
			this.appendChar(this.sourceBuffer.getChar(i));
	},

	clear: function() {
		this.state.isReparsing = false;
		this.chBuffer = [];
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
		if(!jsc.Utils.isStringNullOrEmpty(message))
			this.setError(message);

		// only throw when an error exists
		if(!jsc.Utils.isStringNullOrEmpty(this.state.error))
			throw new Error(this.state.error);
	},

	debugLog: function(msg /*, ... */) {
		if(this.debugMode)
			console.log(jsc.Utils.format.apply(null, arguments));
	}
});

Object.extend(jsc.Lexer, {
	MAX_KEYWORD_LENGTH: 11,

	isIdentifierBegin: function(ch) {
		return (jsc.Lexer.CharacterKindMap[ch] === jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN);
	},

	isIdentifierPart: function(ch) {
		return (jsc.Lexer.CharacterKindMap[ch] >= jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN);
	},

	getCharacterKind: function(ch) {
		return jsc.Lexer.CharacterKindMap[ch];
	},

	getTokenKindFromIdentifier: function(id) {
		if(jsc.Token.Identifiers.hasOwnProperty(id))
			return jsc.Token.Identifiers[id];

		return jsc.Token.Kind.UNKNOWN;
	}
});

(function() {
	
	// the IDENTIFIER_BEGIN kind and any kinds after it must
	// only be a kind that represent an identifier char, add
	// all other kinds before IDENTIFIER_BEGIN
	var charKinds = [
		"INVALID", "LINE_TERMINATOR", "EXCLAMATION", "OPEN_PAREN", "CLOSE_PAREN", "OPEN_BRACE", "CLOSE_BRACE", "OPEN_BRACKET", "CLOSE_BRACKET",
		"COMMA", "COLON", "SEMICOLON", "QUESTION", "TILDE", "QUOTE", "DOT", "SLASH", "BACKSLASH", "ADD", "SUBTRACT", "MULTIPLY", "MODULO", "AND",
		"OR", "XOR", "LESS", "GREATER", "EQUAL", "WHITESPACE", "IDENTIFIER_BEGIN", "ZERO", "NUMBER"
	];
	
	var charKindEnum = jsc.Utils.createEnum(-1, charKinds);
	
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


module.exports = jsc.Lexer;