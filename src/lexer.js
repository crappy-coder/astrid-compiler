var jsc = require("./jsc");

jsc.Lexer = Object.define({
	initialize: function(sourceCode) {
		if(jsc.Utils.isNull(sourceCode))
			throw new Error("The sourceCode argument must not be null.");

		this.state = {
			lastTokenKind: jsc.Token.Kind.UNKNOWN,
			lastTokenLocation: new jsc.TokenLocation(),
			lastLineNumber: 0,
			sourcePosition: sourceCode.begin,
			sourceBegin: sourceCode.begin,
			sourceEnd: sourceCode.end,
			lineBegin: sourceCode.begin,
			lineNumber: sourceCode.beginLine,
			positionBeforeLastNewLine: new jsc.TextPosition(),
			isLineBegin: true,
			hasLineTerminator: false,
			error: null,
			debugMode: false
		};

		this.sourceCode = sourceCode;
		this.sourceBuffer = this.sourceCode.buffer;
		this.chBuffer = null;
		this.ch = null;
		this.chLast = null;
		this.chCode = 0;
		this.comments = [];

		// start at the source offset
		this.position = this.state.sourceBegin;
	},

	// gets or sets whether or not to output debugging information
	get debugMode() {
		return this.state.debugMode;
	},
	set debugMode(value) {
		this.state.debugMode = value;
	},

	/** gets the remaining number of characters to lex. */
	get remainingCharCount() {
		return (this.state.sourceEnd - this.state.sourcePosition);
	},

	get textPosition() {
		return new jsc.TextPosition(this.lineNumber, this.position, this.lineBegin);
	},

	// gets or sets the lexers current position within the buffer
	get position() {
		return this.state.sourcePosition;
	},
	set position(value) {
		this.clearError();
		this.state.sourcePosition = value;
		this.chBuffer = [];
		this.chLast = this.ch;
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
	},

	/** gets or sets the start position of a line */
	get lineBegin() {
		return this.state.lineBegin;
	},
	set lineBegin(value) {
		this.state.lineBegin = value;
	},


	// gets or sets the current line number
	get lineNumber() {
		return this.state.lineNumber;
	},
	set lineNumber(value) {
		this.state.lineNumber = value;
	},

	// gets or sets the last line number
	get lastLineNumber() {
		return this.state.lastLineNumber;
	},
	set lastLineNumber(value) {
		this.state.lastLineNumber = value;
	},

	// gets the last token location
	get lastTokenLocation() {
		return this.state.lastTokenLocation;
	},

	// gets the last token kind
	get lastTokenKind() {
		return this.state.lastTokenKind;
	},


	// gets the last generated error
	get error() {
		return this.state.error;
	},


	// gets whether or not there is a current line terminator
	get hasLineTerminator() {
		return this.state.hasLineTerminator;
	},


	// gets whether or not we've reached the end
	get isEnd() {
		return (this.state.sourcePosition >= this.state.sourceEnd);
	},


	// gets whether or not the next token is a colon
	get isNextTokenColon() {
		while(!this.isEnd)
		{
			var nextChar = this.peekChar(0);

			if(jsc.TextUtils.isWhitespace(nextChar) || jsc.TextUtils.isLineTerminator(nextChar))
			{
				this.position++;
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
		++this.state.sourcePosition;

		this.chLast = this.ch;
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
	},

	nextLine: function() {
		if(!jsc.TextUtils.isLineTerminator(this.ch))
			this.throwOnError("Expected a line terminator.");

		var prevChar = this.ch;

		this.state.positionBeforeLastNewLine = this.textPosition;
		this.next();

		if(prevChar === '\r' && this.ch === '\n')
			this.next();

		++this.lineNumber;
	},

	nextToken: function(tok, inStrictMode) {
		inStrictMode = jsc.Utils.valueOrDefault(inStrictMode, false);

		this.throwOnError();

		if(this.chBuffer.length)
			this.throwOnError("The character buffer is not empty. Cannot parse the next token with a non-empty character buffer.");

		this.state.hasLineTerminator = false;
		this.state.lastTokenLocation = tok.location.clone();

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

				tok.begin = this.textPosition;
				tok.location.begin = this.position;

				switch(jsc.Lexer.getCharacterKind(this.chCode))
				{
					case jsc.Lexer.CharacterKind.EQUAL:
					{
						// '=>'
						if(this.peekChar(1) === '>')
						{
							tokKind = jsc.Token.Kind.ARROW_FUNC;
							tok.valueInfo.line = this.lineNumber;
							tok.valueInfo.lineBegin = this.lineBegin;
							tok.valueInfo.begin = this.position;

							this.next();
							this.next();

							break loop;
						}

						this.next();

						// '=='
						if(this.ch === '=')
						{
							this.next();

							// '==='
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
									tokKind = jsc.Token.Kind.RSHIFT_EQUAL_UNSIGNED;
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

							if(this.parseMultilineComment(tok))
								continue;

							hasError = true;
							tokKind = jsc.Token.Kind.ERROR_MULTILINE_COMMENT_UNTERMINATED;
							this.setError("Multiline comment was not properly closed.");
							break;
						}

						if(this.ch === '=')
						{
							this.next();
							tokKind = jsc.Token.Kind.DIVIDE_EQUAL;
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

						// '--'
						if(this.ch === '-')
						{
							this.next();
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
							tokKind = jsc.Token.Kind.MULTIPLY_EQUAL;
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
							// '...'
							if(this.ch === '.' && this.peekChar(1) === '.')
							{
								this.next();
								this.next();

								tokKind = jsc.Token.Kind.DOTDOTDOT;
								break loop;
							}

							// '.'
							tokKind = jsc.Token.Kind.DOT;
							break loop;
						}

						inNumber = true;
						break;
					}
					case jsc.Lexer.CharacterKind.QUOTE:
					{
						tokKind = this.parseString(tok, inStrictMode);

						if(tokKind !== jsc.Token.Kind.STRING)
						{
							hasError = true;
							break;
						}

						this.next();
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
						tok.valueInfo.line = this.lineNumber;
						tok.valueInfo.lineBegin = this.lineBegin;
						tok.valueInfo.begin = this.position;
						tokKind = jsc.Token.Kind.OPEN_BRACE;

						this.next();
						break loop;
					}
					case jsc.Lexer.CharacterKind.CLOSE_BRACE:
					{
						tok.valueInfo.line = this.lineNumber;
						tok.valueInfo.lineBegin = this.lineBegin;
						tok.valueInfo.begin = this.position;
						tokKind = jsc.Token.Kind.CLOSE_BRACE;

						this.next();
						break loop;
					}
					case jsc.Lexer.CharacterKind.ZERO:
					{
						this.next();

						// hexadecimal numbers '0xFF'
						if(this.ch === 'x' || this.ch === 'X')
						{
							if(!jsc.TextUtils.isHexDigit(this.peekChar(1)))
							{
								tokKind = jsc.Token.Kind.ERROR_HEX_NUMBER_UNTERMINATED;
								hasError = true;

								this.setError("No hexadecimal digits were found after '0x'.");
								break;
							}

							this.next();
							this.parseHex(tok);

							if(jsc.Lexer.isIdentifierBegin(this.chCode))
							{
								tokKind = jsc.Token.Kind.ERROR_HEX_NUMBER_UNTERMINATED;
								hasError = true;

								this.setError("No space between hexadecimal literal and identifier.");
								break;
							}

							tokKind = jsc.Lexer.getTokenKindForNumber(tok.value);
							this.chBuffer = [];
							break loop;
						}

						// binary numbers '0b1111'
						if(this.ch === 'b' || this.ch === 'B')
						{
							if(!jsc.TextUtils.isBinaryDigit(this.peekChar(1)))
							{
								tokKind = jsc.Token.Kind.ERROR_BINARY_NUMBER_UNTERMINATED;
								hasError = true;

								this.setError("No binary digits were found after '0b'.");
								break;
							}

							this.next();
							this.parseBinary(tok);

							if(jsc.Lexer.isIdentifierBegin(this.chCode))
							{
								tokKind = jsc.Token.Kind.ERROR_BINARY_NUMBER_UNTERMINATED;
								hasError = true;

								this.setError("No space between binary literal and identifier.");
								break;
							}

							tokKind = jsc.Lexer.getTokenKindForNumber(tok.value);
							this.chBuffer = [];
							break loop;
						}

						// octal numbers '0o021'
						if(this.ch === 'o' || this.ch === 'O')
						{
							if(!jsc.TextUtils.isOctalDigit(this.peekChar(1)))
							{
								tokKind = jsc.Token.Kind.ERROR_OCTAL_NUMBER_UNTERMINATED;
								hasError = true;

								this.setError("No octal digits were found after '0o'.");
								break;
							}

							this.next();
							this.parseOctal(tok);

							if(jsc.Lexer.isIdentifierBegin(this.chCode))
							{
								tokKind = jsc.Token.Kind.ERROR_OCTAL_NUMBER_UNTERMINATED;
								hasError = true;

								this.setError("No space between octal literal and identifier.");
								break;
							}

							tokKind = jsc.Lexer.getTokenKindForNumber(tok.value);
							this.chBuffer = [];
							break loop;
						}


						this.appendChar('0');

						if(inStrictMode && jsc.TextUtils.isDigit(this.ch))
						{
							tokKind = jsc.Token.Kind.ERROR_OCTAL_NUMBER_UNTERMINATED;
							hasError = true;

							this.setError("Decimal integer literals with a leading zero are not allowed in strict mode.");
							break;
						}

						if(jsc.TextUtils.isOctalDigit(this.ch))
						{
							if(this.parseOctal(tok))
								tokKind = jsc.Lexer.getTokenKindForNumber(tok.value);
						}

					} // fall through to NUMBER
					case jsc.Lexer.CharacterKind.NUMBER:
					{
						inNumber = true;
						break;
					}
					case jsc.Lexer.CharacterKind.LINE_TERMINATOR:
					{
						if(!jsc.TextUtils.isLineTerminator(this.ch))
							this.throwOnError(jsc.Utils.format("Expected a line terminator. Actual character found: '%s'.", this.ch));

						this.nextLine();

						this.state.isLineBegin = true;
						this.state.hasLineTerminator = true;
						this.state.lineBegin = this.position;
						continue;
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
						tokKind = jsc.Token.Kind.ERROR;
						this.setError("Invalid character.");
						break;
					}
					default:
					{
						hasError = true;
						tokKind = jsc.Token.Kind.ERROR;
						this.setError("Unknown error.");
						break;
					}
				}

				if(inNumber)
				{
					inNumber = false;

					if(tokKind !== jsc.Token.Kind.INTEGER && tokKind !== jsc.Token.Kind.DOUBLE)
					{
						var isParsingAfterDecimalPoint = (this.chLast === '.');

						if(isParsingAfterDecimalPoint || !this.parseDecimal(tok))
						{
							if(!isParsingAfterDecimalPoint)
							{
								tokKind = jsc.Token.Kind.INTEGER;

								if(this.ch === '.')
								{
									isParsingAfterDecimalPoint = true;
									this.next();
								}
							}

							if(isParsingAfterDecimalPoint)
							{
								this.parseNumberAfterDecimalPoint();
								tokKind = jsc.Token.Kind.DOUBLE;
							}

							if(this.ch === 'e' || this.ch === 'E')
							{
								if(!this.parseNumberAfterExponent())
								{
									tokKind = (this.isEnd ? jsc.Token.Kind.ERROR_NUMERIC_LITERAL_UNTERMINATED : jsc.Token.Kind.ERROR_NUMERIC_LITERAL_INVALID);
									hasError = true;

									this.setError("Non-number was found after the exponent indicator.");
									break;
								}
							}

							tok.value = parseFloat(this.chBuffer.join(""));
						}

						tokKind = jsc.Lexer.getTokenKindForNumber(tok.value);
					}

					if(jsc.Lexer.isIdentifierBegin(this.chCode))
					{
						tokKind = (this.isEnd ? jsc.Token.Kind.ERROR_NUMERIC_LITERAL_UNTERMINATED : jsc.Token.Kind.ERROR_NUMERIC_LITERAL_INVALID);
						hasError = true;

						this.setError("No identifiers are allowed directly after numeric literal.");
						break;
					}

					this.chBuffer = [];
					break;
				}

				if(hasError)
					break;

				if(inSingleLineComment)
				{
					if(!this.parseComment(tok))
						return jsc.Token.Kind.EOF;

					this.nextLine();

					this.state.isLineBegin = true;
					this.state.hasLineTerminator = true;
					this.state.lineBegin = this.position;

					if(!this.isLastTokenCompletionKeyword)
					{
						inSingleLineComment = false;
						continue;
					}

					tokKind = jsc.Token.Kind.SEMICOLON;
					break;
				}
			}

		tok.kind = tokKind;
		tok.end = this.textPosition;
		tok.location.line = this.lineNumber;
		tok.location.end = this.position;
		tok.location.lineBegin = this.lineBegin;

		if(!inSingleLineComment)
			this.state.isLineBegin = false;

		if(!hasError)
			this.state.lastTokenKind = tokKind;

		return tokKind;
	},

	nextIdentifier: function(tok, inStrictMode) {
		var beginPosition = this.textPosition;
		var begin = this.state.sourcePosition;
		var end = this.state.sourceEnd;

		if(this.position >= end)
			return this.nextToken(tok, inStrictMode);

		if(!jsc.TextUtils.isAlpha(this.getChar()))
			return this.nextToken(tok, inStrictMode);

		++this.position;

		while(!this.isEnd)
		{
			if(!jsc.TextUtils.isAlphaNumeric(this.getChar()))
				break;

			++this.position;
		}

		if(!this.isEnd)
		{
			if(!jsc.TextUtils.isAscii(this.ch) || this.ch === '\\' || this.ch === '_' || this.ch === '$')
				return this.nextToken(tok, inStrictMode);
		}

		this.appendString(begin, this.position - begin);

		tok.value = this.chBuffer.join("");
		tok.begin = beginPosition;
		tok.end = this.textPosition;
		tok.location.line = this.state.lineNumber;
		tok.location.lineBegin = this.state.lineBegin;
		tok.location.begin = begin;
		tok.location.end = this.position;

		this.chBuffer = [];
		this.state.lastTokenKind = jsc.Token.Kind.IDENTIFIER;

		return jsc.Token.Kind.IDENTIFIER;
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
		if(this.remainingCharCount >= jsc.Lexer.MAX_KEYWORD_LENGTH)
		{
			var keyword = this.parseKeyword(tok);

			if(keyword !== jsc.Token.Kind.IDENTIFIER)
			{
				if(jsc.Utils.isNull(tok.value))
					this.throwOnError("The token has no identifier value.");

				return (keyword === jsc.Token.Kind.RESERVED_STRICT && !inStrictMode ? jsc.Token.Kind.IDENTIFIER : keyword);
			}
		}

		var identifierBegin = this.position;
		var identifierBeginLine = this.lineBegin;

		while(jsc.Lexer.isIdentifierPart(this.chCode))
			this.next();

		if(this.ch === '\\')
		{
			this.resetPosition(identifierBegin, identifierBeginLine);
			return this.parseIdentifierOrEscape(tok, inStrictMode);
		}

		tok.value = this.getString(identifierBegin, this.position - identifierBegin);

		if(this.remainingCharCount < jsc.Lexer.MAX_KEYWORD_LENGTH)
		{
			var identifierTokenKind = jsc.Lexer.getTokenKindFromIdentifier(tok.value);

			if(identifierTokenKind === jsc.Token.Kind.UNKNOWN)
				return jsc.Token.Kind.IDENTIFIER;

			return (identifierTokenKind !== jsc.Token.Kind.RESERVED_STRICT || inStrictMode ? identifierTokenKind : jsc.Token.Kind.IDENTIFIER);
		}

		return jsc.Token.Kind.IDENTIFIER;
	},

	parseIdentifierOrEscape: function(tok, inStrictMode) {
		var identifierBegin = this.position;
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
				len = this.position - identifierBegin;

				for(i = 0; i < len; i++)
					this.appendChar(identifierBeginChar);
			}

			this.next();

			if(this.ch !== 'u')
				return (this.isEnd ? jsc.Token.Kind.ERROR_IDENTIFIER_ESCAPE_UNTERMINATED : jsc.Token.Kind.ERROR_IDENTIFIER_ESCAPE_INVALID);

			this.next();

			var unicodeCharCode = this.parseUnicodeHexCode();

			if(unicodeCharCode === jsc.Lexer.ESCAPE_VALUE_INCOMPLETE || unicodeCharCode === jsc.Lexer.ESCAPE_VALUE_INVALID)
				return (unicodeCharCode === jsc.Lexer.ESCAPE_VALUE_INCOMPLETE ? jsc.Token.Kind.ERROR_IDENTIFIER_UNICODE_ESCAPE_UNTERMINATED : jsc.Token.Kind.ERROR_IDENTIFIER_UNICODE_ESCAPE_INVALID);

			if(this.chBuffer.length ? !jsc.Lexer.isIdentifierPart(unicodeCharCode) : !jsc.Lexer.isIdentifierBegin(unicodeCharCode))
				return jsc.Token.Kind.ERROR_IDENTIFIER_UNICODE_ESCAPE_INVALID;

			this.appendChar(String.fromCharCode(unicodeCharCode));

			identifierBegin = this.position;
			identifierBeginChar = this.getChar();
			identifierBeginCharCode = this.getCharCode();
		}

		var identifierLength = 0;
		var identifier = null;

		if(!useBuffer)
		{
			identifierLength = this.position - identifierBegin;

			for(i = identifierBegin; i < identifierLength; i++)
				identifier += this.sourceBuffer.getChar(i);
		}
		else
		{
			if(identifierBeginCharCode !== this.getCharCode())
			{
				len = this.position - identifierBegin;

				for(i = 0; i < len; i++)
					this.appendChar(identifierBeginChar);
			}

			identifier = this.chBuffer.join("");

		}

		this.chBuffer = [];

		tok.value = identifier;

		var tokKind = jsc.Lexer.getTokenKindFromIdentifier(tok.value);

		if(tokKind === jsc.Token.Kind.UNKNOWN)
			return jsc.Token.Kind.IDENTIFIER;

		return (tokKind !== jsc.Token.Kind.RESERVED_STRICT || inStrictMode ? tokKind : jsc.Token.Kind.IDENTIFIER);
	},

	parseKeyword: function(tok) {
		if(this.remainingCharCount < jsc.Lexer.MAX_KEYWORD_LENGTH)
			this.throwOnError("Unable to parse keyword.");

		var c = this.getChar();

		for(var keyword in jsc.Token.Identifiers)
		{
			if(!jsc.Token.Identifiers.hasOwnProperty(keyword))
				continue;

			if(c === keyword[0] && this.compareString(keyword))
			{
				if(!jsc.Lexer.isIdentifierPart(this.peekCharCode(keyword.length)))
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
		var startOffset = 0;

		this.next();

		startOffset = this.position;

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

					if(!jsc.TextUtils.isHexDigit(this.ch) || !jsc.TextUtils.isHexDigit(this.peekChar(1)))
					{
						this.setError("\\x can only be followed by a hex character sequence.");

						if(this.isEnd || (jsc.TextUtils.isHexDigit(this.ch) && (this.position + 1 === this.state.sourceEnd)))
							return jsc.Token.Kind.ERROR_STRING_LITERAL_UNTERMINATED;

						return jsc.Token.Kind.ERROR_STRING_LITERAL_INVALID;
					}

					this.appendChar(String.fromCharCode(parseInt(this.ch+this.peekChar(1), 16)));
					this.seek(2);
				}
				else if(this.ch === 'u')
				{
					this.next();

					if(this.ch === quoteChar)
						this.appendChar('u');
					else
					{
						var unicodeChar = this.parseUnicodeHex();

						if(unicodeChar !== jsc.Lexer.ESCAPE_VALUE_INCOMPLETE && unicodeChar !== jsc.Lexer.ESCAPE_VALUE_INVALID)
							this.appendChar(unicodeChar);
						else
						{
							this.setError("\\u can only be followed by a Unicode character sequence.");

							return (unicodeChar === jsc.Lexer.ESCAPE_VALUE_INCOMPLETE ? jsc.Token.Kind.ERROR_STRING_LITERAL_UNTERMINATED : jsc.Token.Kind.ERROR_STRING_LITERAL_INVALID);
						}
					}
				}
				else if(inStrictMode && jsc.TextUtils.isDigit(this.ch))
				{
					var prevChar = this.ch;

					this.next();

					if(prevChar !== '0' || jsc.TextUtils.isDigit(this.ch))
					{
						this.setError("The only valid numeric escape in strict mode is '\\0'.");
						return jsc.Token.Kind.ERROR_STRING_LITERAL_INVALID;
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
					return jsc.Token.Kind.ERROR_STRING_LITERAL_UNTERMINATED;
				}

				startOffset = this.position;
				continue;
			}

			if(this.isEnd || jsc.TextUtils.isLineTerminator(this.ch))
			{
				this.setError("Unexpected end of file.");
				return (this.isEnd ? jsc.Token.Kind.ERROR_STRING_LITERAL_UNTERMINATED : jsc.Token.Kind.ERROR_STRING_LITERAL_INVALID);
			}

			this.next();
		}

		if(this.position !== startOffset)
			this.appendString(startOffset, this.position - startOffset);

		tok.value = this.chBuffer.join("");
		this.chBuffer = [];

		return jsc.Token.Kind.STRING;
	},

	parseComment: function(tok) {
		var result = true;
		var startOffset = this.position;
		var commentValue = "";

		while(!jsc.TextUtils.isLineTerminator(this.ch))
		{
			if(this.isEnd)
			{
				result = false;
				break;
			}

			this.next();
		}

		// add the contents of the comment that come after the '//'
		if(this.position !== startOffset)
		{
			for(var i = startOffset; i < this.position; i++)
				commentValue += this.sourceBuffer.getChar(i);
		}

		var location = new jsc.TokenLocation();
		location.begin = tok.location.begin;
		location.line = this.lineNumber;
		location.lineBegin = this.lineBegin;
		location.end = this.position;

		this.comments.push(
			new jsc.Lexer.CommentInfo(commentValue, false, tok.begin, this.textPosition, location));

		return result;
	},

	parseMultilineComment: function(tok) {
		var startPosition = this.position;

		while(true)
		{
			// at end of comment? '*/'
			while(this.ch === '*')
			{
				var endPosition = this.position;

				this.next();

				if(this.ch === '/')
				{
					var commentValue = "";

					this.next();

					// add the contents of the comment contained inside the '/*' and '*/'
					if(endPosition !== startPosition)
					{
						for(var i = startPosition; i < endPosition; i++)
							commentValue += this.sourceBuffer.getChar(i);
					}

					var location = new jsc.TokenLocation();
					location.begin = tok.location.begin;
					location.line = this.lineNumber;
					location.lineBegin = this.lineBegin;
					location.end = this.position;

					this.comments.push(
						new jsc.Lexer.CommentInfo(commentValue, true, tok.begin, this.textPosition, location));
					return true;
				}
			}

			// end of file reached before finishing comment
			if(this.isEnd)
				return false;

			// move to next character
			if(!jsc.TextUtils.isLineTerminator(this.ch))
				this.next();

			// move to next line
			else
			{
				this.nextLine();
				this.state.hasLineTerminator = true;
			}
		}
	},

	parseDecimal: function(tok) {
		// TODO: need to test and fix this
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
		while(jsc.TextUtils.isHexDigit(this.ch))
		{
			this.appendChar(this.ch);
			this.next();
		}

		tok.value = parseInt(this.chBuffer.join(""), 16);
		return true;
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

	parseBinary: function(tok) {
		while(jsc.TextUtils.isBinaryDigit(this.ch))
		{
			this.appendChar(this.ch);
			this.next();
		}

		tok.value = parseInt(this.chBuffer.join(""), 2);
		return true;
	},

	parseUnicodeHexCode: function() {
		var a = this.ch;
		var b = this.peekChar(1);
		var c = this.peekChar(2);
		var d = this.peekChar(3);

		if(!jsc.TextUtils.isHexDigit(a) || !jsc.TextUtils.isHexDigit(b) || !jsc.TextUtils.isHexDigit(c) || !jsc.TextUtils.isHexDigit(d))
			return ((this.position + 4 >= this.state.sourceEnd) ? jsc.Lexer.ESCAPE_VALUE_INCOMPLETE : jsc.Lexer.ESCAPE_VALUE_INVALID);

		this.seek(4);

		return parseInt(a+b+c+d, 16);
	},

	parseUnicodeHex: function() {
		var code = this.parseUnicodeHexCode();

		if(code < 0)
			return code;

		return String.fromCharCode(code);
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
			if(this.peekChar(i) !== str[i])
				return false;
		}

		return true;
	},

	peekChar: function(offset) {
		if((this.position+offset) < this.state.sourceEnd)
			return this.sourceBuffer.getChar(this.position+offset);

		return '\0';
	},

	peekCharCode: function(offset) {
		if((this.position+offset) < this.state.sourceEnd)
			return this.sourceBuffer.getCharCode(this.position+offset);

		return 0;
	},

	seek: function(offset) {
		this.state.sourcePosition += offset;
		this.chLast = this.ch;
		this.ch = this.getChar();
		this.chCode = this.getCharCode();
	},

	getChar: function() {
		if(!this.isEnd)
			return this.sourceBuffer.getChar(this.position);

		return '\0';
	},

	getCharCode: function() {
		if(!this.isEnd)
			return this.sourceBuffer.getCharCode(this.position);

		return 0;
	},

	getString: function(offset, len) {
		return this.sourceBuffer.getString(offset, len);
	},

	appendChar: function(ch) {
		this.chBuffer.push(ch);
	},

	appendString: function(index, length) {
		for(var i = index; i < index+length; i++)
			this.appendChar(this.sourceBuffer.getChar(i));
	},

	resetPosition: function(position, lineBegin) {
		this.position = position;
		this.lineBegin = lineBegin;
	},

	clear: function() {
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

jsc.Lexer.CommentInfo = Object.define({
	initialize: function(value, isMultiline, begin, end, location) {
		this.value = value;
		this.isMultiline = isMultiline;
		this.begin = begin.clone();
		this.end = end.clone();
		this.location = location.clone();
	}
});

Object.extend(jsc.Lexer, {
	ESCAPE_VALUE_INCOMPLETE: -2,
	ESCAPE_VALUE_INVALID: -1,
	MAX_KEYWORD_LENGTH: 11,

	isIdentifierBegin: function(chCode) {
		return (jsc.Lexer.CharacterKindMap[chCode] === jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN);
	},

	isIdentifierPart: function(chCode) {
		return (jsc.Lexer.CharacterKindMap[chCode] >= jsc.Lexer.CharacterKind.IDENTIFIER_BEGIN);
	},

	getCharacterKind: function(chCode) {
		return jsc.Lexer.CharacterKindMap[chCode];
	},

	getTokenKindFromIdentifier: function(id) {
		if(jsc.Token.Identifiers.hasOwnProperty(id))
			return jsc.Token.Identifiers[id];

		return jsc.Token.Kind.UNKNOWN;
	},

	getTokenKindForNumber: function(value) {
		if(jsc.Utils.isInteger(value))
			return jsc.Token.Kind.INTEGER;

		return jsc.Token.Kind.DOUBLE;
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
})();


module.exports = jsc.Lexer;