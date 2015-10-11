var jsc = require("./jsc");
require("./ast");
require("./lexer");
require("./token");
require("./variable-environment");
require("./utils");


/**
 * The JavaScript source parser.
 *
 * @class
 */
jsc.Parser = Object.define({
	initialize: function(sourceCode, inStrictMode, parserMode, defaultConstructorKind) {
		if(jsc.Utils.isNull(sourceCode))
			throw new Error("The sourceCode argument must not be null.");

		this.state = {
			mode: jsc.Utils.valueOrDefault(parserMode, jsc.Parser.Mode.PROGRAM),
			defaultConstructorKind: jsc.Utils.valueOrDefault(defaultConstructorKind, jsc.Parser.ConstructorKind.NONE),
			lastIdentifier: null,
			lastFunctionName: null,
			lastTokenEndPosition: new jsc.TextPosition(),
			assignmentCount: 0,
			constantCount: 0,
			nonLHSCount: 0,
			nonTrivialExprCount: 0,
			statementDepth: 0,
			allowsIn: true,
			debugMode: false,
			error: null,
			errorFileName: null,
			errorLine: 0,
			errorColumn: 0
		};

		this.sourceCode = sourceCode;
		this.lexer = new jsc.Lexer(sourceCode);
		this.tok = new jsc.Token();
		this.scopeStack = [];
		this.features = jsc.AST.CodeFeatureFlags.NONE;
		this.statements = null;
		this.variableDecls = null;
		this.functions = null;

		this.prepare(inStrictMode);
	},

	get debugMode() {
		return this.state.debugMode;
	},
	set debugMode(value) {
		this.state.debugMode = value;
	},

	get mode() {
		return this.state.mode;
	},

	get inStrictMode() {
		return this.currentScope.strictMode;
	},

	get isValidStrictMode() {
		return this.currentScope.isValidStrictMode;
	},

	get error() {
		return this.state.error;
	},

	get errorDetails() {
		return {
			fileName: this.state.errorFileName,
			message: this.state.error,
			line: this.state.errorLine,
			column: this.state.errorColumn
		};
	},

	get hasError() {
		return !jsc.Utils.isStringNullOrEmpty(this.state.error);
	},

	get currentScope() {
		return this.scopeStack[this.scopeStack.length-1];
	},

	get tokenString() {
		return this.sourceCode.getString(this.tokenBegin, this.tokenEnd);
	},
	
	get tokenBegin() {
		return this.tok.location.begin;
	},

	get tokenBeginPosition() {
		return this.tok.begin.clone();
	},
	
	get tokenEnd() {
		return this.tok.begin.begin;
	},

	get tokenEndPosition() {
		return this.tok.end.clone();
	},

	get tokenLine() {
		return this.tok.location.line;
	},

	get tokenLineBegin() {
		return this.tok.location.lineBegin;
	},

	get tokenColumn() {
		return (this.tokenBegin - this.tokenLineBegin);
	},

	get tokenLocation() {
		return this.tok.location.clone();
	},

	get lastTokenLocation() {
		return this.lexer.lastTokenLocation.clone();
	},
	
	get lastTokenEndPosition() {
		return this.state.lastTokenEndPosition.clone();
	},
	
	get canBreak() {
		var scope = new jsc.ParserScopeRef(this, this.scopeStack.length-1);
		
		while(!scope.current.canBreak)
		{
			if(!scope.hasContainingScope)
				return false;
				
			scope = scope.containingScope;
		}
		
		return true;
	},
	
	get canContinue() {
		var scope = new jsc.ParserScopeRef(this, this.scopeStack.length-1);
		
		while(!scope.current.canContinue)
		{
			if(!scope.hasContainingScope)
				return false;
				
			scope = scope.containingScope;
		}
		
		return true;
	},

	prepare: function(inStrictMode) {
		var scope = this.pushScope();
		
		if(jsc.Parser.isFunctionParseMode(this.mode))
			scope.enterFunction();

		if(jsc.Parser.isModuleParseMode(this.mode))
			scope.enterModule();

		if(inStrictMode)
			scope.strictMode = true;

		this.tok.location.line = this.sourceCode.beginLine;
		this.tok.location.lineBegin = this.sourceCode.begin;
		this.tok.location.begin = this.sourceCode.begin;
		this.tok.location.end = this.sourceCode.begin;

		this.next();
	},

	parse: function() {
		var program = null;
		var errorLine = 0;
		var errorColumn = 0;
		var errorMessage = "";
		var beginLocation = this.tokenLocation;
		var beginColumn = this.sourceCode.beginColumn - 1;
		var endLocation = new jsc.TokenLocation();
		var endColumn = 0;

		try
		{
			// clear any previous statements
			this.statements = null;
			
			// parse the source
			this.parseImpl();

			// check for uncaught lexical errors
			var lexLine = this.lexer.lineNumber;
			var lexColumn = this.lexer.position;
			var lexError = this.lexer.error;

			this.lexer.clear();

			if(this.hasError || lexError)
			{
				errorLine = lexLine;
				errorColumn = lexColumn;
				errorMessage = lexError ? lexError : errorMessage;

				this.statements = null;
			}

			if(this.statements)
			{
				endLocation.line = this.lexer.lineNumber;
				endLocation.lineBegin = this.lexer.lineBegin;
				endLocation.begin = this.lexer.position;
				endColumn = endLocation.begin - endLocation.lineBegin;

				program = new jsc.AST.ScriptNode(this.sourceCode, beginLocation, endLocation, beginColumn, endColumn, this.inStrictMode);
				program.constantCount = this.state.constantCount;
				program.features = this.features;
				program.statements = this.statements;
				program.functions = this.functions;
				program.variableDeclarations = this.variableDecls.clone();
				program.variables = this.currentScope.finishLexicalEnvironment().clone();

				program.updatePosition(this.sourceCode.beginLine, this.lexer.lineNumber, this.lexer.position, this.lexer.lineBegin);
				program.end = this.lexer.position;
			}
			else
			{
				// TODO: handle error tokens
			}
		}
		catch(e)
		{
			var errMsg = "";
			
			if(!e.hasOwnProperty("stack"))
				errMsg = e.toString();
			else
				errMsg = e.stack;
				
			if(!this.hasError)
				this.setError(errMsg);

			this.debugLog(errMsg);
		}

		return program;
	},

	parseImpl: function() {
		var context = new jsc.AST.Context(this.sourceCode);
		var scope = this.currentScope;
		var statements = null;
		var isValidEnding = false;

		scope.enterLexicalScope();

		if(jsc.Parser.isModuleParseMode(this.mode))
			statements = this.parseModuleStatementList(context);
		else
			statements = this.parseStatementList(context, true);

		isValidEnding = this.consume(jsc.Token.Kind.EOF);

		if((!statements || !statements.length) || !isValidEnding)
		{
			if(!this.hasError)
				this.setError("Parser Error", false);

			this.throwOnError();
		}

		var getCapturedVariablesResult = scope.getCapturedVariables();
		var variables = scope.declaredVariables;

		for(var i = 0; i < getCapturedVariablesResult.variables.length; i++)
			variables.setIsCaptured(getCapturedVariablesResult.variables[i]);

		this.statements = statements;
		this.variableDecls = variables;
		this.features = context.features;
		this.functions = context.functions;
		this.state.constantCount = context.constantCount;
		
		if(scope.strictMode)
			this.features |= jsc.AST.CodeFeatureFlags.STRICT_MODE;
		
		if(scope.shadowsArguments)
			this.features |= jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS;

		if(getCapturedVariablesResult.modifiedParameter)
			this.features |= jsc.AST.CodeFeatureFlags.MODIFIED_PARAMETER;

		if(getCapturedVariablesResult.modifiedArguments)
			this.features |= jsc.AST.CodeFeatureFlags.MODIFIED_ARGUMENTS;
	},

	parseStatementList: function(context, checkForStrictMode) {
		var statements = [];
		var hasDirective = false;
		var hasSetStrict = false;
		var lastState = this.createRestorePoint();

		while(true)
		{
			var statement = this.parseStatementListItem(context);
			
			if(!statement)
				break;
				
			if(checkForStrictMode && !hasDirective)
			{
				var expr = (statement.kind === jsc.AST.NodeKind.EXPR_STATEMENT && statement.expression.kind === jsc.AST.NodeKind.STRING ? statement.expression : null);
				
				if(expr && expr.isDirective)
				{
					if(!hasSetStrict && expr.value === jsc.Parser.KnownIdentifiers.UseStrict)
					{
						this.currentScope.strictMode = true;
						hasSetStrict = true;
						
						if(!this.isValidStrictMode)
						{
							if(!jsc.Utils.isStringNullOrEmpty(this.state.lastFunctionName))
							{
								if(jsc.Parser.KnownIdentifiers.isArguments(this.state.lastFunctionName))
									this.fail("Cannot name a function 'arguments' in strict mode.");

								if(jsc.Parser.KnownIdentifiers.isEval(this.state.lastFunctionName))
									this.fail("Cannot name a function 'eval' in strict mode.");
							}

							if(this.hasDeclaredVariable(jsc.Parser.KnownIdentifiers.Arguments))
								this.fail("Cannot declare a variable named 'arguments' in strict mode.");

							if(this.hasDeclaredVariable(jsc.Parser.KnownIdentifiers.Eval))
								this.fail("Cannot declare a variable named 'eval' in strict mode.");

							this.failWhenFalse(this.isValidStrictMode, "Invalid parameter or function name in strict mode.");
						}

						lastState.restore(this);

						this.failWhenError();
						continue;
					}
				}
				else
				{
					hasDirective = true;
				}
			}

			statements.push(statement);
		}
		
		this.failWhenError();
		return statements;
	},

	parseModuleStatementList: function(context) {
		var statements = [];

		while(true)
		{
			var statement = null;

			if(this.match(jsc.Token.Kind.IMPORT))
				statement = this.parseImportStatment(context);
			else if(this.match(jsc.Token.Kind.EXPORT))
				statement = this.parseExportStatement(context);
			else
				statement = this.parseStatementListItem(context);

			if(!statement)
				break;

			statements.push(statement);
		}

		this.failWhenError();

		var scope = this.currentScope;
		var keys = scope.moduleExportedBindings.keys;

		keys.forEach(function(k) {
			if(scope.hasDeclaredVariable(k))
			{
				scope.declaredVariables.setIsExported(k);
				return;
			}
			else if(scope.hasDeclaredLexicalVariable(k))
			{
				scope.lexicalVariables.setIsExported(k);
				return;
			}

			this.fail("Exported binding '" + k + "' needs to refer to a top-level declared variable.");
		}, this);

		return statements;
	},

	parseStatementListItem: function(context) {
		var lastStatementDepth = this.state.statementDepth;
		var lastState = null;
		var dontSetEndOffset = false;
		var statement = null;

		try
		{
			this.state.statementDepth++;

			switch(this.tok.kind)
			{
				case jsc.Token.Kind.CONST:
					statement = this.parseVarDeclaration(context, jsc.Parser.DeclarationKind.CONST);
					break;
				case jsc.Token.Kind.LET:
				{
					var parseAsVarDeclaration = true;

					if(!this.inStrictMode)
					{
						lastState = this.createRestorePoint();

						this.next();

						if(!this.match(jsc.Token.Kind.IDENTIFIER) && !this.match(jsc.Token.Kind.OPEN_BRACE) && !this.match(jsc.Token.Kind.OPEN_BRACKET))
							parseAsVarDeclaration = false;

						lastState.restore(this);
					}

					if(parseAsVarDeclaration)
						statement = this.parseVarDeclaration(context, jsc.Parser.DeclarationKind.LET);
					else
						statement = this.parseExpressionOrLabel(context);

					break;
				}
				case jsc.Token.Kind.CLASS:
					statement = this.parseClassStatement(context);
					break;
				default:
					this.state.statementDepth--;
					statement = this.parseStatement(context);
					dontSetEndOffset = true;
					break;
			}

			if(statement && !dontSetEndOffset)
				statement.end = this.state.lastTokenEndPosition.begin;
		}
		finally
		{
			this.state.statementDepth = lastStatementDepth;
		}

		return statement;
	},

	parseStatement: function(context) {
		var nonTrivialExprCount = 0;
		var directive = null;
		var location = this.tokenLocation;
		var lastStatementDepth = this.state.statementDepth;
		var dontSetEndOffset = false;
		var statement = null;
		
		try
		{
			this.state.statementDepth++;
			
			switch(this.tok.kind)
			{
				case jsc.Token.Kind.OPEN_BRACE:
					statement = this.parseBlock(context);
					dontSetEndOffset = true;
					break;

				case jsc.Token.Kind.VAR:
					statement = this.parseVarDeclaration(context, jsc.Parser.DeclarationKind.VAR);
					break;

				case jsc.Token.Kind.FUNCTION:
				{
					this.failWhenFalseInStrictMode(this.state.statementDepth === 1, "Functions cannot be declared in a nested block in strict mode.");
					statement = this.parseFunctionDeclaration(context);
					break;
				}

				case jsc.Token.Kind.SEMICOLON:
				{
					this.next();
					statement = context.createEmptyStatement(location);
					break;
				}

				case jsc.Token.Kind.IF:
					statement = this.parseIf(context);
					break;

				case jsc.Token.Kind.DO:
					statement = this.parseDoWhile(context);
					break;

				case jsc.Token.Kind.WHILE:
					statement = this.parseWhile(context);
					break;

				case jsc.Token.Kind.FOR:
					statement = this.parseFor(context);
					break;

				case jsc.Token.Kind.CONTINUE:
					statement = this.parseContinue(context);
					break;

				case jsc.Token.Kind.BREAK:
					statement = this.parseBreak(context);
					break;

				case jsc.Token.Kind.RETURN:
					statement = this.parseReturn(context);
					break;

				case jsc.Token.Kind.WITH:
					statement = this.parseWith(context);
					break;

				case jsc.Token.Kind.SWITCH:
					statement = this.parseSwitch(context);
					break;

				case jsc.Token.Kind.THROW:
					statement = this.parseThrow(context);
					break;

				case jsc.Token.Kind.TRY:
					statement = this.parseTry(context);
					break;

				case jsc.Token.Kind.DEBUGGER:
					statement = this.parseDebugger(context);
					break;

				// end of statement tokens
				case jsc.Token.Kind.EOF:
				case jsc.Token.Kind.CASE:
				case jsc.Token.Kind.CLOSE_BRACE:
				case jsc.Token.Kind.DEFAULT:
					return null;

				case jsc.Token.Kind.IDENTIFIER:
					statement = this.parseExpressionOrLabel(context);
					break;

				case jsc.Token.Kind.STRING:
					directive = this.tok.value;
					nonTrivialExprCount = this.state.nonTrivialExprCount;
				default:
					var expressionStatement = this.parseExpressionStatement(context);
					
					if(!jsc.Utils.isNull(directive) && nonTrivialExprCount !== this.state.nonTrivialExprCount)
						directive = null;
						
					if(!jsc.Utils.isNull(directive) && expressionStatement.expression instanceof jsc.AST.StringExpression)
						expressionStatement.expression.isDirective = true;
						
					statement = expressionStatement;
					break;
			}

			if(statement && !dontSetEndOffset)
				statement.end = this.state.lastTokenEndPosition.begin;
		}
		finally
		{
			this.state.statementDepth = lastStatementDepth;
		}

		return statement;
	},

	parseImportStatment: function(context) {
		// TODO: IMPLEMENT
		throw new Error("NOT IMPLEMENTED");
	},

	parseExportStatement: function(context) {
		// TODO: IMPLEMENT
		throw new Error("NOT IMPLEMENTED");
	},

	parseClassStatement: function(context) {
		// TODO: IMPLEMENT
		throw new Error("NOT IMPLEMENTED");
	},

	parseClass: function(context, needsName) {
		var result = {
			expression: null,
			info: new jsc.ParserClassInfo()
		};

		this.fail("NOT IMPLEMENTED");

		return result;
	},

	parseBlock: function(context) {
		var location = this.tokenLocation;
		var begin = this.tok.valueInfo.begin;
		var beginLine = this.tokenLine;
		var end = 0;
		var statements = null;
		var lexicalScope = null;
		var result = null;

		try
		{
			if(this.state.statementDepth > 0)
			{
				lexicalScope = this.pushScope();
				lexicalScope.enterLexicalScope();
				lexicalScope.allowsVarDeclarations = false;
			}

			this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);
			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
			{
				end = this.tok.valueInfo.begin;

				this.next();

				result = context.createBlockStatement(location, beginLine, this.lastTokenEndPosition.line, null, (lexicalScope ? lexicalScope.finishLexicalEnvironment() : jsc.VariableEnvironment.Empty));
				result.begin = begin;
				result.end = end;
			}
			else
			{
				statements = this.parseStatementList(context, false);
				this.failWhenNull(statements, "Cannot parse the body of the block statement.");

				this.matchOrFail(jsc.Token.Kind.CLOSE_BRACE);
				end = this.tok.valueInfo.begin;

				this.next();

				result = context.createBlockStatement(location, beginLine, this.lastTokenEndPosition.line, statements, (lexicalScope ? lexicalScope.finishLexicalEnvironment() : jsc.VariableEnvironment.Empty));
				result.begin = begin;
				result.end = end;
			}
		}
		finally
		{
			if(lexicalScope)
				this.popScope(true);
		}

		return result;
	},

	parseDestructuringPattern: function(context, kind, isExported, bindingContextKind, depth, patternParseContext) {
		bindingContextKind = jsc.Utils.valueOrDefault(bindingContextKind, jsc.AST.AssignmentContextKind.DECLARATION);
		depth = jsc.Utils.valueOrDefault(depth, 0);
		patternParseContext = jsc.Utils.valueOrDefault(patternParseContext, null);

		var location = this.tokenLocation;
		var nonLHSCount = this.state.nonLHSCount;
		var innerPattern = null;
		var pattern = null;
		var defaultValue = null;
		var restElementWasFound = false;

		switch(this.tok.kind)
		{
			case jsc.Token.Kind.OPEN_BRACKET:
			{
				var arrayPattern = context.createArrayPattern(location);

				if(patternParseContext)
					patternParseContext.hasPattern = true;

				this.next();

				restElementWasFound = false;

				do
				{
					while(this.match(jsc.Token.Kind.COMMA))
					{
						arrayPattern.append(this.tokenLocation, jsc.AST.ArrayPatternBindingKind.ELISION);
						this.next();
					}

					if(this.hasError)
						return null;

					if(this.match(jsc.Token.Kind.CLOSE_BRACKET))
						break;

					if(this.match(jsc.Token.Kind.DOTDOTDOT))
					{
						location = this.tokenLocation;
						this.next();

						innerPattern = this.parseDestructuringPattern(context, kind, isExported, bindingContextKind, depth + 1, patternParseContext);

						if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && jsc.Utils.isNull(innerPattern))
							return null;

						this.failWhenNull(innerPattern, "Unable to parse destructuring pattern.");
						this.failWhenTrue((kind !== jsc.Parser.DestructuringKind.EXPRESSIONS && !innerPattern.isBindingPattern), "Expected an identifier for a rest element destructuring pattern.");

						arrayPattern.append(location, jsc.AST.ArrayPatternBindingKind.REST_ELEMENT, innerPattern);
						restElementWasFound = true;
						break;
					}

					location = this.tokenLocation;
					innerPattern = this.parseDestructuringPattern(context, kind, isExported, bindingContextKind, depth + 1, patternParseContext);

					if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && jsc.Utils.isNull(innerPattern))
						return null;

					this.failWhenNull(innerPattern, "Unable to parse destructuring pattern.");

					defaultValue = this.parseDefaultValueForDestructuringPattern(context);
					arrayPattern.append(location, jsc.AST.ArrayPatternBindingKind.ELEMENT, innerPattern, defaultValue);

				} while(this.consume(jsc.Token.Kind.COMMA));

				if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && !this.match(jsc.Token.Kind.CLOSE_BRACKET))
					return null;

				this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACKET, restElementWasFound ? "Expected a closing ']' following a rest element destructuring pattern" : "Expected either a closing ']' or a ',' following an element destructuring pattern.");
				pattern = arrayPattern;
				break;
			}
			case jsc.Token.Kind.OPEN_BRACE:
			{
				var objectPattern = context.createObjectPattern(location);

				if(patternParseContext)
					patternParseContext.hasPattern = true;

				this.next();

				do
				{
					var wasString = false;
					var propertyName = null;

					location = this.tokenLocation;

					if(this.match(jsc.Token.Kind.CLOSE_BRACE))
						break;

					if(this.match(jsc.Token.Kind.IDENTIFIER) || this.isLetMaskedAsIdentifier())
					{
						this.failWhenTrue(this.match(jsc.Token.Kind.LET) && (kind === jsc.Parser.DestructuringKind.LET || kind === jsc.Parser.DestructuringKind.CONST), "Cannot use 'let' as an identifier name.");

						propertyName = this.tok.value;

						this.next();

						if(this.consume(jsc.Token.Kind.COLON))
							innerPattern = this.parseDestructuringPattern(context, kind, isExported, bindingContextKind, depth + 1, patternParseContext);
						else
							innerPattern = this.createBindingPattern(context, kind, isExported, bindingContextKind, propertyName, depth + 1, location, patternParseContext);
					}
					else
					{
						var tokKind = this.tok.kind;
						var tokIsKeyword = this.tok.isKeyword;

						switch(tokKind)
						{
							case jsc.Token.Kind.DOUBLE:
							case jsc.Token.Kind.INTEGER:
							case jsc.Token.Kind.STRING:
							{
								propertyName = this.tok.value;
								wasString = (tokKind === jsc.Token.Kind.STRING);
								break;
							}
							default:
							{
								if(!this.tok.isReserved && !this.tok.isKeyword)
								{
									if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS)
										return null;

									this.fail("Expected a property name.");
								}
								propertyName = this.tok.value;
								break;
							}
						}

						this.next();

						if(!this.consume(jsc.Token.Kind.COLON))
						{
							if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS)
								return null;

							this.failWhenTrue(tokKind === jsc.Token.Kind.RESERVED, "Cannot use abbreviated destructuring syntax for reserved keyword '" + propertyName + "'");
							this.failWhenTrueInStrictMode(tokKind === jsc.Token.Kind.RESERVED_STRICT, "Cannot use abbreviated destructuring syntax for reserved keyword '" + propertyName + "' in strict mode.");
							this.failWhenTrue(tokIsKeyword, "Cannot use abbreviated destructuring syntax for keyword '" + propertyName + "'");

							this.fail("Expected a ':' prior to a named destructuring property.");
						}

						innerPattern = this.parseDestructuringPattern(context, kind, isExported, bindingContextKind, depth + 1, patternParseContext);
					}

					if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && jsc.Utils.isNull(innerPattern))
						return null;

					this.failWhenNull(innerPattern, "Unable to parse destructuring pattern.");

					defaultValue = this.parseDefaultValueForDestructuringPattern(context);

					if(jsc.Utils.isStringNullOrEmpty(propertyName))
						this.fail("Expected a property name.");

					objectPattern.append(location, propertyName, wasString, innerPattern, defaultValue);

				} while(this.consume(jsc.Token.Kind.COMMA));

				if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && !this.match(jsc.Token.Kind.CLOSE_BRACE))
					return null;

				if(!this.consume(jsc.Token.Kind.CLOSE_BRACE))
					this.fail("Expected either a closing '}' or an ',' after a property destructuring pattern.");

				pattern = objectPattern;
				break;
			}
			default:
			{
				if(!this.match(jsc.Token.Kind.IDENTIFIER) && !this.isLetMaskedAsIdentifier())
				{
					if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS)
						return null;

					this.failForUsingKeyword("variable name");
					this.fail("Expected a parameter pattern or a ')' in the parameter list.");
				}

				this.failWhenTrue(this.match(jsc.Token.Kind.LET) && (kind === jsc.Parser.DestructuringKind.LET || kind === jsc.Parser.DestructuringKind.CONST), "Cannot use 'let' as an identifier name.");

				pattern = this.createBindingPattern(context, kind, isExported, bindingContextKind, this.tok.value, depth, this.tokenLocation, patternParseContext);
				this.next();
				break;
			}
		}

		this.state.nonLHSCount = nonLHSCount;

		return pattern;
	},

	parseDefaultValueForDestructuringPattern: function(context) {
		if(!this.match(jsc.Token.Kind.EQUAL))
			return null;

		this.next();
		return this.parseAssignment(context);
	},

	createBindingPattern: function(context, kind, isExported, bindingContextKind, name, depth, location, patternParseContext) {
		var result = null;

		if(kind === jsc.Parser.DestructuringKind.VARIABLES)
			this.failWhenTrueInStrictMode(this.declareVariable(name) & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE, "Unable to declare the variable '" + name + "' in strict mode.");
		else if(kind === jsc.Parser.DestructuringKind.LET || kind === jsc.Parser.DestructuringKind.CONST)
		{
			result = this.declareVariable(name, kind === jsc.Parser.DestructuringKind.LET ? jsc.Parser.DeclarationKind.LET : jsc.Parser.DeclarationKind.CONST);

			if(result !== jsc.Parser.DeclarationResultFlags.VALID)
			{
				this.failWhenTrueInStrictMode(result & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE, "Cannot destructure to a variable named '" + name + "' in strict mode.");
				this.failWhenTrue(result & jsc.Parser.DeclarationResultFlags.INVALID_DUPLICATED, "Cannot declare the variable '" + name + "' twice.");
			}
		}
		else if(kind === jsc.Parser.DestructuringKind.PARAMETERS)
		{
			if(depth)
			{
				var bindingResult = this.currentScope.declareBoundParameter(name);

				if(bindingResult === jsc.Parser.BindingResult.FAIL_STRICT && this.inStrictMode)
				{
					this.failWhenTrue(jsc.Parser.KnownIdentifiers.isEvalOrArguments(name), "Cannot destructure to a parameter named '" + name + "' in strict mode.");

					if(this.state.lastFunctionName && this.state.lastFunctionName === name)
						this.fail("Cannot destructure to '" + name + "' as it shadows the name of a strict mode function.");

					this.failForUsingKeyword("bound parameter name");

					if(this.hasDeclaredParameter(name))
						this.fail("Cannot destructure to '" + name + "' as it has already been declared.");

					this.fail("Cannot bind to a parameter named '" + name + "' in strict mode.");
				}

				if(bindingResult === jsc.Parser.BindingResult.FAIL)
				{
					this.failForUsingKeyword("bound parameter name");

					if(this.hasDeclaredParameter(name))
						this.fail("Cannot destructure to '" + name + "' as it has already been declared.");

					this.fail("Cannot destructure to a parameter named '" + name + "'");
				}
			}
			else
			{
				result = this.declareParameter(name);

				if((result & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE) && this.inStrictMode)
				{
					this.failWhenTrue(jsc.Parser.KnownIdentifiers.isEvalOrArguments(name), "Cannot destructure to a parameter named '" + name + "' in strict mode.");

					if(this.state.lastFunctionName && this.state.lastFunctionName === name)
						this.fail("Cannot declare a parameter named '" + name + "' as it shadows the name of a strict mode function.");

					this.failForUsingKeyword("parameter name");

					if(this.hasDeclaredParameter(name))
						this.fail("Cannot declare a parameter named '" + name + "' in strict mode as it has already been declared.");

					this.fail("Cannot declare a parameter named '" + name + "' in strict mode.");
				}

				if(patternParseContext && (result & jsc.Parser.DeclarationResultFlags.INVALID_DUPLICATED))
					patternParseContext.duplicateName = name;
			}
		}

		if(isExported)
		{
			this.failWhenFalse(this.exportName(name), "Cannot export a duplicate name '" + name + "'");
			this.exportBinding(name);
		}

		return context.createBindingPattern(location, name, bindingContextKind);
	},

	parseVarDeclaration: function(context, declarationKind, isExported) {
		isExported = jsc.Utils.valueOrDefault(isExported, false);

		var location = this.tokenLocation;
		var beginLine = this.tokenLine;
		var result = null;

		if(!this.match(jsc.Token.Kind.VAR) && !this.match(jsc.Token.Kind.LET) && !this.match(jsc.Token.Kind.CONST))
			this.fail(jsc.Utils.format("The token '%s' was not recognized. Expected a 'var', 'let' or 'const'.", this.tokenString));

		result = this.parseVarDeclarationList(context, jsc.Parser.DeclarationListKind.VAR, declarationKind, isExported);

		this.failWhenError();
		this.failWhenFalse(this.insertSemicolon(), "Expected ';' after variable declaration.");

		return context.createDeclarationStatement(location, beginLine, 0, result.expr);
	},
	
	parseVarDeclarationList: function(context, declarationListKind, declarationKind, isExported) {
		var declExpr = null;
		var assignmentContextKind = this.getAssignmentContextKindFromDeclarationKind(declarationKind);
		var lastNameLocation = null;
		var result = {
			expr: null,
			count: 0,
			lastName: null,
			lastInitializer: null,
			lastPattern: null,
			forLoopConstHasInitializer: true
		};

		do
		{
			var location = this.tokenLocation;
			var varLocation = 0;
			var initialAssignmentCount = 0;
			var hasInitializer = false;
			var initializer = null;
			var name = null;
			var node = null;
			var declarationResult = 0;

			result.lastPattern = null;
			result.lastName = null;
			result.count++;
			
			this.next();

			if(this.match(jsc.Token.Kind.IDENTIFIER) || this.isLetMaskedAsIdentifier())
			{
				this.failWhenTrue(this.match(jsc.Token.Kind.LET) && (declarationKind === jsc.Parser.DeclarationKind.LET || declarationKind === jsc.Parser.DeclarationKind.CONST), "Cannot use 'let' as an identifier name for a Lxical Declaration.");

				varLocation = this.tokenLocation;
				lastNameLocation = this.tokenLocation;
				name = this.tok.value;
				result.lastName = name;

				this.next();

				hasInitializer = this.match(jsc.Token.Kind.EQUAL);

				declarationResult = this.declareVariable(name, declarationKind);

				if(declarationResult !== jsc.Parser.DeclarationResultFlags.VALID)
				{
					this.failWhenTrueInStrictMode(declarationResult & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE, "Cannot declare a variable named '" + name + "' in strict mode.");

					if(declarationResult & jsc.Parser.DeclarationResultFlags.INVALID_DUPLICATED)
					{
						if(declarationKind === jsc.Parser.DeclarationKind.LET)
							this.fail("Cannot declare a let variable twice: '" + name + "'");

						if(declarationKind === jsc.Parser.DeclarationKind.CONST)
							this.fail("Cannot declare a const variable twice: '" + name + "'");

						this.throwUnreachableError();
					}
				}

				if(isExported)
				{
					this.failWhenFalse(this.currentScope.exportName(name), "Cannot export a duplicate name '" + name + "'");
					this.currentScope.exportBinding(name);
				}

				if(hasInitializer)
				{
					this.next();

					initialAssignmentCount = this.state.assignmentCount;
					initializer = this.parseAssignment(context);
					result.lastInitializer = initializer;

					this.failWhenNull(initializer, "Expected expression as the initializer for the variable '" + name + "'");

					node = context.createAssignResolveExpression(location, name, initializer, initialAssignmentCount !== this.state.assignmentCount);
				}
				else
				{
					if(declarationListKind === jsc.Parser.DeclarationListKind.FORLOOP && declarationKind === jsc.Parser.DeclarationKind.CONST)
						result.forLoopConstHasInitializer = false;

					this.failWhenTrue(declarationListKind !== jsc.Parser.DeclarationListKind.FORLOOP && declarationKind === jsc.Parser.DeclarationKind.CONST, "The const declared variable '" + name + "' must have an initializer.");

					switch(declarationKind)
					{
						case jsc.Parser.DeclarationKind.VAR:
							node = context.createEmptyDeclarationExpression(varLocation, name, jsc.AST.DeclarationKind.VAR);
							break;
						case jsc.Parser.DeclarationKind.LET:
							node = context.createEmptyDeclarationExpression(varLocation, name, jsc.AST.DeclarationKind.LET);
							break;
						case jsc.Parser.DeclarationKind.CONST:
							node = context.createEmptyDeclarationExpression(varLocation, name, jsc.AST.DeclarationKind.CONST);
							break;
					}
				}
			}
			else
			{
				result.lastName = null;

				var pattern = this.parseDestructuringPattern(context, this.getDestructuringKindFromDeclarationKind(declarationKind), isExported, assignmentContextKind);
				this.failWhenNull(pattern, "Cannot parse this destructuring pattern.");

				hasInitializer = this.match(jsc.Token.Kind.EQUAL);

				this.failWhenTrue(declarationListKind === jsc.Parser.DeclarationListKind.VAR && !hasInitializer, "Expected an initializer in destructuring variable declaration.");

				result.lastPattern = pattern;

				if(hasInitializer)
				{
					this.next();

					initializer = this.parseAssignment(context);
					node = context.createDestructuringAssignmentExpression(location, pattern, initializer);

					result.lastInitializer = initializer;
				}
			}

			declExpr = context.combineCommaExpressions(location, declExpr, node);
		}
		while(this.match(jsc.Token.Kind.COMMA));

		if(!jsc.Utils.isStringNullOrEmpty(result.lastName))
			result.lastPattern = context.createBindingPattern(lastNameLocation, result.lastName, assignmentContextKind);

		result.expr = declExpr;

		return result;
	},

	parseIf: function(context) {
		var beginLine = this.tokenLine;
		var endLine = 0;
		var condition = null;
		var trueBlock = null;
		var ifLocation = this.tokenLocation;

		this.matchOrFail(jsc.Token.Kind.IF);
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		condition = this.parseExpression(context);
		this.failWhenNull(condition);
		
		endLine = this.tokenLine;
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		trueBlock = this.parseStatement(context);
		this.failWhenNull(trueBlock);
		
		if(!this.match(jsc.Token.Kind.ELSE))
			return context.createIfStatement(ifLocation, beginLine, endLine, condition, trueBlock, null);

		var expressions = [];
		var statements = [];
		var positions = [];
		var locations = [];
		var location = null;
		var statement = null;
		var hasTrailingElse = false;
		
		do
		{
			location = this.tokenLocation;

			this.next();
			
			if(!this.match(jsc.Token.Kind.IF))
			{
				statement = this.parseStatement(context);
				this.failWhenNull(statement);
				
				statements.push(statement);
				hasTrailingElse = true;
				break;
			}

			var innerBeginLine = this.tokenLine;
			var innerEndLine = 0;
			var innerCondition = null;
			var innerTrueBlock = null;
			
			this.next();
			this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
			
			innerCondition = this.parseExpression(context);
			this.failWhenNull(innerCondition);
			
			innerEndLine = this.tokenLine;
			this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
			
			innerTrueBlock = this.parseStatement(context);
			this.failWhenNull(innerTrueBlock);

			locations.push(location);
			expressions.push(innerCondition);
			positions.push([innerBeginLine, innerEndLine]);
			statements.push(innerTrueBlock);
		}
		while(this.match(jsc.Token.Kind.ELSE));
		
		var expr = null;
		var block = null;
		var pos = null;

		if(!hasTrailingElse)
		{
			expr = expressions.pop();
			block = statements.pop();
			pos = positions.pop();
			location = locations.pop();

			statement = context.createIfStatement(location, pos[0], pos[1], expr, block, null);
			statement.end = block.end;

			statements.push(statement);
		}
		
		while(expressions.length)
		{
			expr = expressions.pop();
			block = statements.pop();
			pos = positions.pop();
			location = locations.pop();

			statement = context.createIfStatement(location, pos[0], pos[1], expr, statements.pop(), block);
			statement.end = block.end;

			statements.push(statement);
		}
		
		return context.createIfStatement(ifLocation, beginLine, endLine, condition, trueBlock, statements[statements.length-1]);
	},
	
	parseDoWhile: function(context) {
		var location = null;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var statement = null;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.DO);
		this.next();
		this.currentScope.beginLoop();
		
		statement = this.parseStatement(context);
		
		this.currentScope.endLoop();
		
		this.failWhenNull(statement);
		
		endLine = this.tokenLine;
		location = this.tokenLocation;
		
		this.consumeOrFail(jsc.Token.Kind.WHILE);
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		expr = this.parseExpression(context);
		
		this.failWhenNull(expr);
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		
		// skip semicolon, will always perform an automatic semicolon insertion
		if(this.match(jsc.Token.Kind.SEMICOLON))
			this.next();
			
		return context.createDoWhileStatement(location, beginLine, endLine, expr, statement);
	},
	
	parseWhile: function(context) {
		var location = this.tokenLocation;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var statement = null;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.WHILE);
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		endLine = this.tokenLine;
		
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		
		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();

		this.failWhenNull(statement);
			
		return context.createWhileStatement(location, beginLine, endLine, expr, statement);
	},
	
	parseFor: function(context) {
		var location = this.tokenLocation;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var expr = null;
		var statement = null;
		var isOfEnumeration = false;
		var loopContext = new jsc.ParserForLoopContext(this);
		var result = null;

		loopContext.nonLHSCount = this.state.nonLHSCount;

		this.matchOrFail(jsc.Token.Kind.FOR);
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		loopContext.isVarDecl = this.match(jsc.Token.Kind.VAR);
		loopContext.isLetDecl = this.match(jsc.Token.Kind.LET);
		loopContext.isConstDecl = this.match(jsc.Token.Kind.CONST);

		try
		{

			if(loopContext.isVarDecl || loopContext.isLetDecl || loopContext.isConstDecl)
			{
				/*
					for(var/let/const <ID> in/of <EXPRESSION>) <STATEMENT>
					for(var/let/const <VAR-DECL-LIST>; <EXPRESSION-opt>; <EXPRESSION-opt>)
				*/
				var inLocation = 0;
				var declKind = 0;
				var declListResult = null;

				if(loopContext.isLetDecl || loopContext.isConstDecl)
				{
					this.pushScope();

					loopContext.lexicalScopeRef = new jsc.ParserScopeRef(this, this.scopeStack.length-1);
					loopContext.lexicalScopeRef.current.enterLexicalScope();
					loopContext.lexicalScopeRef.current.allowsVarDeclarations = false;
				}

				this.state.allowsIn = false;

				if(loopContext.isVarDecl)
					declKind = jsc.Parser.DeclarationKind.VAR;
				else if(loopContext.isLetDecl)
					declKind = jsc.Parser.DeclarationKind.LET;
				else if(loopContext.isConstDecl)
					declKind = jsc.Parser.DeclarationKind.CONST;
				else
					this.throwUnreachableError();

				declListResult = this.parseVarDeclarationList(context, jsc.Parser.DeclarationListKind.FORLOOP, declKind, false);
				loopContext.decls = declListResult.expr;
				loopContext.forLoopConstHasInitializer = declListResult.forLoopConstHasInitializer;

				this.state.allowsIn = true;
				this.failWhenError();

				if(this.match(jsc.Token.Kind.SEMICOLON))
					return this.parseForLoop(context, loopContext, location, beginLine);

				this.failWhenFalse(declListResult.count === 1, "Can only declare a single variable in an enumeration.");
				this.failWhenTrueInStrictMode(declListResult.lastInitializer !== null, "Cannot use initializer syntax in strict mode enumeration.");

				if(declListResult.lastInitializer)
					this.failWhenFalse(declListResult.lastPattern.isBindingPattern, "Cannot use initializer syntax when binding to a pattern during enumeration.");

				// handle for-in with var declaration
				inLocation = this.tokenBegin;

				if(!this.consume(jsc.Token.Kind.IN))
				{
					this.failWhenFalse(this.match(jsc.Token.Kind.IDENTIFIER) && this.tok.value === "of", "Expected either 'in' or 'of' in enumeration syntax.");
					isOfEnumeration = true;
					this.failWhenTrue(declListResult.lastInitializer !== null, "Cannot use initializer syntax in a for-of enumeration.");
					this.next();
				}

				expr = this.parseExpression(context);
				this.failWhenNull(expr);

				endLine = this.tokenLine;

				this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

				this.currentScope.beginLoop();
				statement = this.parseStatement(context);
				this.currentScope.endLoop();

				this.failWhenNull(statement);

				loopContext.gatherLexicalVariablesIfNeeded();

				if(isOfEnumeration)
					result = context.createForOfStatement(location, beginLine, endLine, declListResult.lastInitializer, expr, statement, loopContext.lexicalVariables);
				else
					result = context.createForInStatement(location, beginLine, endLine, declListResult.lastInitializer, expr, statement, loopContext.lexicalVariables);

				loopContext.popLexicalScopeIfNeeded();

				return result;
			}

			if(!this.match(jsc.Token.Kind.SEMICOLON))
			{
				if(this.match(jsc.Token.Kind.OPEN_BRACE) || this.match(jsc.Token.Kind.OPEN_BRACKET))
				{
					var lastState = this.createRestorePoint();

					loopContext.pattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.EXPRESSIONS, false, jsc.AST.AssignmentContextKind.DECLARATION);

					if(loopContext.pattern && (this.match(jsc.Token.Kind.IN) || (this.match(jsc.Token.Kind.IDENTIFIER) && this.tok.value === "of")))
						return this.parseEnumerationForLoop(context, loopContext, location, beginLine);

					loopContext.pattern = null;
					lastState.restore(this);
				}

				this.state.allowsIn = false;

				loopContext.decls = this.parseExpression(context);

				this.state.allowsIn = true;

				this.failWhenNull(loopContext.decls);
			}

			// parse standard for loop
			if(this.match(jsc.Token.Kind.SEMICOLON))
				return this.parseForLoop(context, loopContext, location, beginLine);

			return this.parseEnumerationForLoop(context, loopContext, location, beginLine);
		}
		finally
		{
			if(loopContext.lexicalScopeRef)
				this.popScope(false);
		}
	},

	parseForLoop: function(context, loopContext, location, beginLine) {
		var statement = null;
		var condition = null;
		var increment = null;
		var result = null;
		var endLine = 0;

		this.next();
		this.failWhenTrue(loopContext.forLoopConstHasInitializer && loopContext.isConstDecl, "const variables in for loops must have initializers.");

		if(!this.match(jsc.Token.Kind.SEMICOLON))
		{
			condition = this.parseExpression(context);
			this.failWhenNull(condition, "Cannot parse for loop condition expression.");
		}

		this.consumeOrFail(jsc.Token.Kind.SEMICOLON);

		if(!this.match(jsc.Token.Kind.CLOSE_PAREN))
		{
			increment = this.parseExpression(context);
			this.failWhenNull(increment, "Cannot parse for loop iteration expression.");
		}

		endLine = this.tokenLine;
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();

		this.failWhenNull(statement);

		loopContext.gatherLexicalVariablesIfNeeded();
		result = context.createForStatement(location, beginLine, endLine, loopContext.decls, condition, increment, statement, loopContext.lexicalVariables);
		loopContext.popLexicalScopeIfNeeded();

		return result;
	},

	parseEnumerationForLoop: function(context, loopContext, location, beginLine) {
		var isOfEnumeration = false;
		var statement = null;
		var expr = null;
		var endLine = 0;
		var result = null;

		this.failWhenFalse(loopContext.nonLHSCount === this.state.nonLHSCount);

		if(!this.consume(jsc.Token.Kind.IN))
		{
			this.failWhenFalse(this.match(jsc.Token.Kind.IDENTIFIER) && this.tok.value === "of", "Expected either 'in' or 'of' in enumeration syntax.");
			isOfEnumeration = true;
			this.next();
		}

		expr = this.parseExpression(context);
		this.failWhenNull(expr);

		endLine = this.tokenLine;

		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();

		this.failWhenNull(statement);

		loopContext.gatherLexicalVariablesIfNeeded();

		if(loopContext.pattern)
		{
			var patternExpr = context.createDestructuringAssignmentExpression(location, loopContext.pattern, null);

			if(isOfEnumeration)
				result = context.createForOfStatement(location, beginLine, endLine, patternExpr, expr, statement, loopContext.lexicalVariables);
			else
				result = context.createForInStatement(location, beginLine, endLine, patternExpr, expr, statement, loopContext.lexicalVariables);

			loopContext.popLexicalScopeIfNeeded();
			return result;
		}

		if(isOfEnumeration)
			result = context.createForOfStatement(location, beginLine, endLine, loopContext.decls, expr, statement, loopContext.lexicalVariables);
		else
			result = context.createForInStatement(location, beginLine, endLine, loopContext.decls, expr, statement, loopContext.lexicalVariables);

		loopContext.popLexicalScopeIfNeeded();
		return result;
	},

	parseContinue: function(context) {
		var location = this.tokenLocation;
		var begin = this.tokenBeginPosition;
		var end = this.tokenEndPosition;
		var name = null;
		var label = null;
		
		this.matchOrFail(jsc.Token.Kind.CONTINUE);
		this.next();
		
		if(this.insertSemicolon())
		{
			this.failWhenFalse(this.canContinue, "The 'continue' keyword can only be used inside a loop statement.");
			return context.createContinueStatement(location, begin, end, null);
		}
		
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		
		name = this.tok.value;
		label = this.findLabel(name);
		
		this.failWhenNull(label, "The label '" + name + "' is not defined");
		this.failWhenFalse(label.isLoop, "The 'continue' keyword can only be used inside a loop statement.");
		
		end = this.tokenEndPosition;
		
		this.next();
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createContinueStatement(location, begin, end, name);
	},
	
	parseBreak: function(context) {
		var location = this.tokenLocation;
		var begin = this.tokenBeginPosition;
		var end = this.tokenEndPosition;
		var name = null;
		
		this.matchOrFail(jsc.Token.Kind.BREAK);
		this.next();
		
		if(this.insertSemicolon())
		{
			this.failWhenFalse(this.canBreak, "The 'break' keyword can only be used inside a switch or loop statement.");
			return context.createBreakStatement(location, begin, end, null);
		}
		
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		name = this.tok.value;
		this.failWhenNull(this.findLabel(name), "The label '" + name + "' is not defined.");
		
		end = this.tokenEndPosition;
		
		this.next();
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createBreakStatement(location, begin, end, name);
	},
	
	parseReturn: function(context) {
		var location = this.tokenLocation;
		var begin = this.tokenBeginPosition;
		var end = this.tokenEndPosition;
		var scope = this.currentScope;
		var expr = null;

		this.matchOrFail(jsc.Token.Kind.RETURN);
		this.failWhenFalse(scope.isFunction);
		this.next();
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			end = this.tokenEndPosition;
			
		if(this.insertSemicolon())
			return context.createReturnStatement(location, begin, end, null);

		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		end = this.lastTokenEndPosition;
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			end = this.tokenEndPosition;
			
		this.failWhenFalse(this.insertSemicolon());
		
		scope.doesFunctionReturn = true;
		return context.createReturnStatement(location, begin, end, expr);
	},
	
	parseWith: function(context) {
		var location = this.tokenLocation;
		var begin = 0;
		var beginLine = this.tokenLine;
		var end = null;
		var endLine = 0;
		var expr = null;
		var statement = null;
		
		this.matchOrFail(jsc.Token.Kind.WITH);
		this.failWhenTrue(this.inStrictMode, "The 'with' keyword is not allowed while in strict mode.");

		this.currentScope.needsFullActivation = true;
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		begin = this.tokenBegin;
		expr = this.parseExpression(context);
		this.failWhenNull(expr);

		end = this.lastTokenEndPosition;
		endLine = this.tokenLine;
		
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		statement = this.parseStatement(context);
		this.failWhenNull(statement);

		return context.createWithStatement(location, beginLine, endLine, expr, end.begin - begin, statement);
	},
	
	parseSwitch: function(context) {
		var location = this.tokenLocation;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var expr = null;
		var scope = null;
		var firstClauses = null;
		var secondClauses = null;
		var defaultClause = null;
		var result = null;

		this.matchOrFail(jsc.Token.Kind.SWITCH);		
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		expr = this.parseExpression(context);
		this.failWhenNull(expr, "Cannot parse switch condition expression.");

		endLine = this.tokenLine;

		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACE);

		try
		{
			scope = this.pushScope();
			scope.enterLexicalScope();
			scope.allowsVarDeclarations = false;
			scope.beginSwitch();

			firstClauses = this.parseSwitchClauses(context);
			this.failWhenError();

			defaultClause = this.parseSwitchDefaultClause(context);
			this.failWhenError();

			secondClauses = this.parseSwitchClauses(context);
			this.failWhenError();

			scope.endSwitch();

			this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACE);

			result = context.createSwitchStatement(location, beginLine, endLine, expr, defaultClause, firstClauses, secondClauses, scope.finishLexicalEnvironment());
		}
		finally
		{
			this.popScope(true);
		}

		return result;
	},
	
	parseSwitchClauses: function(context) {
		if(!this.match(jsc.Token.Kind.CASE))
			return null;

		var condition = null;
		var statements = null;
		var clauses = null;
		var next = null;

		this.next();

		condition = this.parseExpression(context);
		this.failWhenNull(condition, "Cannot parse switch case expression.");
		
		this.consumeOrFail(jsc.Token.Kind.COLON);

		statements = this.parseStatementList(context, false);
		this.failWhenNull(statements, "Cannot parse the body of a switch clause.");

		clauses = context.createSwitchClauseList(condition, statements);
		next = clauses;

		while(this.match(jsc.Token.Kind.CASE))
		{
			this.next();

			condition = this.parseExpression(context);
			this.failWhenNull(condition, "Cannot parse switch case expression.");

			this.consumeOrFail(jsc.Token.Kind.COLON);

			statements = this.parseStatementList(context, false);
			this.failWhenNull(statements, "Cannot parse the body of a switch clause.");

			next = context.createSwitchClauseList(condition, statements, next);
		}

		return clauses;
	},
	
	parseSwitchDefaultClause: function(context) {
		if(!this.match(jsc.Token.Kind.DEFAULT))
			return null;

		var statements = null;
			
		this.next();
		this.consumeOrFail(jsc.Token.Kind.COLON);

		statements = this.parseStatementList(context, false);
		this.failWhenNull(statements);

		return context.createSwitchClauseList(null, statements);
	},
	
	parseThrow: function(context) {
		var location = this.tokenLocation;
		var begin = this.tokenBeginPosition;
		var end = null;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.THROW);
		this.next();
		this.failWhenTrue(this.insertSemicolon());
		
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		end = this.lastTokenEndPosition;
		
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createThrowStatement(location, begin, end, expr);
	},
	
	parseTry: function(context) {
		var location = this.tokenLocation;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var tryBlock = null;
		var finallyBlock = null;
		var catchBlock = null;
		var catchVariables = jsc.VariableEnvironment.Empty;
		var catchScope = null;
		var name = null;

		this.matchOrFail(jsc.Token.Kind.TRY);
		this.next();
		this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);

		tryBlock = this.parseBlock(context);
		this.failWhenNull(tryBlock, "Cannot parse the body of the try block.");

		endLine = this.state.lastTokenEndPosition.line;

		if(this.match(jsc.Token.Kind.CATCH))
		{
			this.next();
			this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

			if(!this.match(jsc.Token.Kind.IDENTIFIER) || this.isLetMaskedAsIdentifier())
			{
				this.failForUsingKeyword("catch variable name");
				this.fail("Expected an identifer name as the catch target.");
			}

			name = this.tok.value;
			this.next();

			try
			{
				catchScope = this.pushScope();
				catchScope.enterLexicalScope();
				catchScope.allowsVarDeclarations = false;

				this.failWhenTrueInStrictMode(!!(catchScope.declareLexicalVariable(name, false) & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE), "Cannot declare a catch variable named '" + name + "' in strict mode.");
				this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
				this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);

				catchBlock = this.parseBlock(context);
				this.failWhenNull(catchBlock, "Unable to parse catch block.");

				catchVariables = catchScope.finishLexicalEnvironment();
			}
			finally
			{
				this.popScope(true);
			}
		}

		if(this.match(jsc.Token.Kind.FINALLY))
		{
			this.next();
			this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);

			finallyBlock = this.parseBlock(context);
			this.failWhenNull(finallyBlock, "Unable to parse finally block.");
		}

		this.failWhenFalse(catchBlock || finallyBlock, "A try statement must have at least a catch or a finally block.");

		return context.createTryStatement(location, beginLine, endLine, name, tryBlock, catchBlock, finallyBlock, catchVariables);
	},
	
	parseDebugger: function(context) {
		var location = this.tokenLocation;
		var beginLine = this.tokenLine;
		var endLine = beginLine;
		
		this.matchOrFail(jsc.Token.Kind.DEBUGGER);
		this.next();
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			beginLine = this.tokenLine;
			
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createDebuggerStatement(location, beginLine, endLine);
	},
	
	parseExpressionStatement: function(context) {
		switch(this.tok.kind)
		{
			case jsc.Token.Kind.CLASS:
				this.fail("The 'class' declaration is not directly within a block statement.");
				break;
		}

		var begin = this.tokenBeginPosition;
		var location = this.tokenLocation;
		var expr = this.parseExpression(context);
		
		this.failWhenNull(expr);
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createExpressionStatement(location, begin, this.state.lastTokenEndPosition.line, expr);
	},
	
	parseExpression: function(context) {
		var location = this.tokenLocation;
		var lhs = null;
		var rhs = null;
		var commaExpr = null;

		lhs = this.parseAssignment(context);
		this.failWhenNull(lhs, "Cannot parse expression.");
		lhs.end = this.state.lastTokenEndPosition.begin;

		if(!this.match(jsc.Token.Kind.COMMA))
			return lhs;
			
		this.next();
		
		this.state.nonTrivialExprCount++;
		this.state.nonLHSCount++;
		
		rhs = this.parseAssignment(context);
		this.failWhenNull(rhs, "Cannot parse expression in a comma expression.");
		rhs.end = this.state.lastTokenEndPosition.begin;
		
		commaExpr = context.createCommaExpression(location, lhs);
		commaExpr.append(rhs);

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();
			
			rhs = this.parseAssignment(context);
			this.failWhenNull(rhs);
			rhs.end = this.state.lastTokenEndPosition.begin;
			
			commaExpr.append(rhs);
		}

		commaExpr.end = this.state.lastTokenEndPosition.begin;
		return commaExpr;
	},
	
	parseExpressionOrLabel: function(context) {
		var labels = [];
		var i = 0;
		var location = null;

		do {
			var begin = this.tokenBeginPosition;
			var end = null;
			var name = null;

			location = this.tokenLocation;
			
			if(!this.lexer.isNextTokenColon)
			{
				var expr = this.parseExpression(context);
				
				this.failWhenNull(expr);
				this.failWhenFalse(this.insertSemicolon());
				
				return context.createExpressionStatement(location, begin, this.lastTokenEndPosition.line, expr);
			}
			
			name = this.tok.value;
			end = this.tokenEndPosition;
			
			this.next();
			this.consumeOrFail(jsc.Token.Kind.COLON);

			for(i = 0; i < labels.length; i++)
				this.failWhenTrue(name === labels[i].name);
					
			this.failWhenTrue(this.findLabel(name) !== null);
			labels.push(new jsc.AST.LabelInfo(name, begin, end));

		} while(this.match(jsc.Token.Kind.IDENTIFIER) || this.isLetMaskedAsIdentifier());
		
		var isLoop = false;
		var statement = null;
		
		switch(this.tok.kind)
		{
			case jsc.Token.Kind.FOR:
			case jsc.Token.Kind.WHILE:
			case jsc.Token.Kind.DO:
				isLoop = true;
				break;
			default:
				break;
		}
		
		// push the labels onto the current scopes label stack so they
		// can be validated while parsing the next statement(s)
		for(i = 0; i < labels.length; i++)
			this.pushLabel(labels[i].name, isLoop);
		
		statement = this.parseStatement(context);

		// pop off the previous labels
		for(i = 0; i < labels.length; i++)
			this.popLabel();
		
		this.failWhenNull(statement);

		// create a chain of statements for each label
		for(i = 0; i < labels.length; i++)
		{
			var info = labels[labels.length - i - 1];
			statement = context.createLabelStatement(location, info.begin, info.end, info.name, statement);
		}
		
		return statement;
	},
	
	parseAssignment: function(context) {
		var location = this.tokenLocation;
		var initialAssignmentCount = this.state.assignmentCount;
		var initialNonLHSCount = this.state.nonLHSCount;
		var assignmentDepth = 0;
		var hadAssignment = false;
		var op = null;
		var lhs = null;

		// parse an destructuring pattern assignment
		if(this.match(jsc.Token.Kind.OPEN_BRACE) || this.match(jsc.Token.Kind.OPEN_BRACKET))
		{
			var lastState = this.createRestorePoint();
			var pattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.EXPRESSIONS, false, jsc.AST.AssignmentContextKind.ASSIGNMENT);
			var rhs = null;

			if(jsc.Utils.isNotNull(pattern) && this.consume(jsc.Token.Kind.EQUAL))
			{
				rhs = this.parseAssignment(context);

				if(jsc.Utils.isNotNull(rhs))
					return context.createDestructuringAssignmentExpression(location, pattern, rhs);
			}

			lastState.restore(this);
		}

		// parse an arrow function expression
		if(this.isArrowFunctionParameters())
			return this.parseArrowFunctionExpression(context);


		lhs = this.parseConditional(context);
		this.failWhenNull(lhs);
		
		if(initialNonLHSCount !== this.state.nonLHSCount)
		{
			if(this.tok.kind >= jsc.Token.Kind.EQUAL && this.tok.kind <= jsc.Token.Kind.OR_EQUAL)
				this.fail("Left hand side of operator '" + this.tokenString + "' must be a reference.");

			return lhs;
		}

		loop:
		while(true)
		{
			switch(this.tok.kind)
			{
				case jsc.Token.Kind.EQUAL:
					op = jsc.AST.AssignmentOperatorKind.EQUAL;
					break;
				case jsc.Token.Kind.PLUS_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.PLUS_EQUAL;
					break;
				case jsc.Token.Kind.MINUS_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.MINUS_EQUAL;
					break;
				case jsc.Token.Kind.MULTIPLY_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.MULTIPLY_EQUAL;
					break;
				case jsc.Token.Kind.DIVIDE_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.DIVIDE_EQUAL;
					break;
				case jsc.Token.Kind.LSHIFT_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.LSHIFT_EQUAL;
					break;
				case jsc.Token.Kind.RSHIFT_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.RSHIFT_EQUAL;
					break;
				case jsc.Token.Kind.RSHIFT_EQUAL_UNSIGNED:
					op = jsc.AST.AssignmentOperatorKind.RSHIFT_EQUAL_UNSIGNED;
					break;
				case jsc.Token.Kind.AND_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.AND_EQUAL;
					break;
				case jsc.Token.Kind.OR_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.OR_EQUAL;
					break;
				case jsc.Token.Kind.XOR_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.XOR_EQUAL;
					break;
				case jsc.Token.Kind.MOD_EQUAL:
					op = jsc.AST.AssignmentOperatorKind.MOD_EQUAL;
					break;
				default:
					break loop;
			}

			this.state.nonTrivialExprCount++;
			hadAssignment = true;
			assignmentDepth++;

			context.appendAssignment(lhs, this.state.assignmentCount, op);

			this.state.assignmentCount++;
			this.next();
			
			if(this.inStrictMode && this.state.lastIdentifier !== null && lhs.isResolve)
			{
				this.failWhenTrueInStrictMode(jsc.Parser.KnownIdentifiers.isEval(this.state.lastIdentifier), "'eval' cannot be modified in strict mode.");
				this.failWhenTrueInStrictMode(jsc.Parser.KnownIdentifiers.isArguments(this.state.lastIdentifier), "'arguments' cannot be modified in strict mode.");
				
				this.declareWrite(this.state.lastIdentifier);
				this.state.lastIdentifier = null;
			}
			
			lhs = this.parseAssignment(context);
			this.failWhenNull(lhs);
			
			if(initialNonLHSCount !== this.state.nonLHSCount)
			{
				if(this.tok.kind >= jsc.Token.Kind.EQUAL && this.tok.kind <= jsc.Token.Kind.OR_EQUAL)
					this.fail("Left hand side of operator '" + this.tokenString + "' must be a reference.");

				break;
			}
		}
		
		if(hadAssignment)
			this.state.nonLHSCount++;

		while(assignmentDepth > 0)
		{
			lhs = context.createAssignmentExpression(location, lhs, initialAssignmentCount, this.state.assignmentCount);
			assignmentDepth--;
		}

		return lhs;
	},
	
	parseConditional: function(context) {
		var location = this.tokenLocation;
		var lhs = null;
		var rhs = null;
		var cond = this.parseBinary(context);
		
		this.failWhenNull(cond, "Cannot parse expression.");
		
		if(!this.match(jsc.Token.Kind.QUESTION))
			return cond;
			
		this.state.nonTrivialExprCount++;
		this.state.nonLHSCount++;
		
		this.next();
		
		lhs = this.parseAssignment(context);
		this.failWhenNull(lhs, "Cannot parse left hand side of ternary operator.");
		lhs.end = this.lastTokenEndPosition.begin;

		this.consumeOrFail(jsc.Token.Kind.COLON);
		
		rhs = this.parseAssignment(context);
		this.failWhenNull(rhs, "Cannot parse right hand side of ternary operator.");
		rhs.end = this.lastTokenEndPosition.begin;
		
		return context.createConditionalExpression(location, cond, lhs, rhs);
	},
	
	parseBinary: function(context) {
		var location = this.tokenLocation;
		var operationState = {
			operandDepth: 0,
			operatorDepth: 0
		};
		
		while(true)
		{
			var column = this.tokenColumn;
			var beginColumn = this.tokenBegin;
			var initialAssignmentCount = this.state.assignmentCount;
			var precedence = 0;
			var operatorToken = jsc.Token.Kind.UNKNOWN;
			var currentExpr = this.parseUnary(context);

			this.failWhenNull(currentExpr);
			
			context.pushBinaryOperand(operationState, currentExpr, initialAssignmentCount !== this.state.assignmentCount);
			
			precedence = this.getBinaryOperatorPrecedence(this.tok.kind);

			if(precedence === 0)
				break;
				
			operatorToken = this.tok.kind;
			
			this.state.nonTrivialExprCount++;
			this.state.nonLHSCount++;

			this.next();

			while(operationState.operatorDepth > 0 && context.precedenceIsLowerThanOperatorStack(precedence))
			{
				context.popBinaryOperation(location, operationState);
			}

			context.pushBinaryOperation(operationState, operatorToken, precedence);
		}

		while(operationState.operatorDepth > 0)
		{
			context.popBinaryOperation(location, operationState);
		}
		
		return context.popBinaryOperand();
	},
	
	parseUnary: function(context) {
		var lastAllowsIn = this.state.allowsIn;
		var lastTokenKind = jsc.Token.Kind.UNKNOWN;
		var tokenStackDepth = 0;
		var modifiesExpression = false;
		var requiresLExpression = false;
		var isEvalOrArguments = false;
		var expr = null;
		var location = null;
		
		this.state.allowsIn = true;
		
		while(this.isUnaryOp(this.tok.kind))
		{
			if(this.inStrictMode)
			{
				switch(this.tok.kind)
				{
					case jsc.Token.Kind.PLUSPLUS:
					case jsc.Token.Kind.PLUSPLUS_AUTO:
					case jsc.Token.Kind.MINUSMINUS:
					case jsc.Token.Kind.MINUSMINUS_AUTO:
						this.failWhenTrue(requiresLExpression, "The '" + jsc.Token.getOperatorDescription(lastTokenKind, true) + "' operator requires a reference expression.");
						modifiesExpression = true;
						requiresLExpression = true;
						break;
					case jsc.Token.Kind.DELETE:
						this.failWhenTrue(requiresLExpression, "The '" + jsc.Token.getOperatorDescription(lastTokenKind, true) + "' operator requires a reference expression.");
						requiresLExpression = true;
						break;
					default:
						this.failWhenTrue(requiresLExpression, "The '" + jsc.Token.getOperatorDescription(lastTokenKind, true) + "' operator requires a reference expression.");
						break;
				}
			}

			context.pushUnaryToken(this.tok.kind, this.tokenBeginPosition);
			tokenStackDepth++;

			lastTokenKind = this.tok.kind;
			
			this.state.nonLHSCount++;
			this.state.nonTrivialExprCount++;
			
			this.next();
		}
		
		location = this.tokenLocation;
		expr = this.parseMember(context);

		if(jsc.Utils.isNull(expr))
		{
			if(lastTokenKind !== jsc.Token.Kind.UNKNOWN)
				this.fail("Cannot parse the sub-expression of '" + jsc.Token.getOperatorDescription(lastTokenKind, true) + "' operator.");

			this.fail("Cannot parse member expression.");
		}
		
		if(this.inStrictMode && expr.kind === jsc.AST.NodeKind.RESOLVE)
			isEvalOrArguments = jsc.Parser.KnownIdentifiers.isEvalOrArguments(this.state.lastIdentifier);
		
		this.failWhenTrueInStrictMode(isEvalOrArguments && modifiesExpression, "'" + this.state.lastIdentifier + "' cannot be modified in strict mode.");
		
		switch(this.tok.kind)
		{
			case jsc.Token.Kind.PLUSPLUS:
			case jsc.Token.Kind.MINUSMINUS:
				this.state.nonLHSCount++;
				this.state.nonTrivialExprCount++;
				
				expr = context.createPostfixExpression(location, expr, (this.tok.kind === jsc.Token.Kind.PLUSPLUS ? jsc.AST.AssignmentOperatorKind.PLUS_PLUS : jsc.AST.AssignmentOperatorKind.MINUS_MINUS));
				
				this.state.assignmentCount++;
				
				this.failWhenTrueInStrictMode(isEvalOrArguments, "'" + this.state.lastIdentifier + "' cannot be modified in strict mode.");
				this.failWhenTrue(requiresLExpression, "The '" + jsc.Token.getOperatorDescription(lastTokenKind, false) + "' operator requires a reference expression.");

				this.next();
				break;
			default:
				break;
		}
		
		location = this.tokenLocation;
		location.line = this.lexer.lastLineNumber;

		while(tokenStackDepth > 0)
		{
			switch(context.lastUnaryTokenKind)
			{
				case jsc.Token.Kind.EXCLAMATION:
					expr = context.createLogicalNotExpression(location, expr);
					break;
				case jsc.Token.Kind.TILDE:
					expr = context.createBitwiseNotExpression(location, expr);
					break;
				case jsc.Token.Kind.MINUS:
					expr = context.createNegateExpression(location, expr);
					break;
				case jsc.Token.Kind.PLUS:
					expr = context.createUnaryPlusExpression(location, expr);
					break;
				case jsc.Token.Kind.PLUSPLUS:
				case jsc.Token.Kind.PLUSPLUS_AUTO:
					expr = context.createPrefixExpression(location, expr, jsc.AST.AssignmentOperatorKind.PLUS_PLUS);
					this.state.assignmentCount++;
					break;
				case jsc.Token.Kind.MINUSMINUS:
				case jsc.Token.Kind.MINUSMINUS_AUTO:
					expr = context.createPrefixExpression(location, expr, jsc.AST.AssignmentOperatorKind.MINUS_MINUS);
					this.state.assignmentCount++;
					break;
				case jsc.Token.Kind.TYPEOF:
					expr = context.createTypeOfExpression(location, expr);
					break;
				case jsc.Token.Kind.VOID:
					expr = context.createVoidExpression(location, expr);
					break;
				case jsc.Token.Kind.DELETE:
					this.failWhenTrueInStrictMode(expr.isResolve, "Cannot delete unqualified property '" + this.state.lastIdentifier + "' in strict mode.");
					expr = context.createDeleteExpression(location, expr);
					break;
				default:
					this.throwUnreachableError();
					break;
			}

			tokenStackDepth--;
			context.popUnaryToken();
		}
		
		this.state.allowsIn = lastAllowsIn;
		
		return expr;
	},
	
	parseMember: function(context) {
		var location = this.tokenLocation;
		var beginLocation = this.tokenLocation;
		var baseExpr = null;
		var baseIsSuper = false;
		var baseIsNewTarget = false;
		var expr = null;
		var newCount = 0;
		var nonLHSCount = 0;
		var initialAssignmentCount = 0;
		
		while(this.match(jsc.Token.Kind.NEW))
		{
			this.next();
			newCount++;
		}

		baseIsSuper = this.match(jsc.Token.Kind.SUPER);
		this.failWhenTrue(baseIsSuper && (newCount > 0), "Cannot use 'new' with 'super'.");

		if((newCount > 0) && this.match(jsc.Token.Kind.DOT))
		{
			this.next();

			if(!this.match(jsc.Token.Kind.IDENTIFIER))
				this.fail();
			else
			{
				if(this.tok.value !== jsc.Parser.KnownIdentifiers.Target)
					this.fail("Using 'new.' can only be followed with 'target'.");
				else
				{
					this.failWhenFalse(this.currentScope.isFunction, "Using 'new.target' is only valid inside functions.");

					baseIsNewTarget = true;
					baseExpr = context.createNewTargetExpression(location);

					newCount--;
					this.next();
				}
			}
		}

		if(baseIsSuper)
		{
			this.failWhenFalse(this.currentScope.isFunction, "Using 'super' is only valid inside functions.");

			baseExpr = context.createSuperExpression(location);

			this.next();
			this.currentScope.needsSuperBinding = true;
		}
		else if(!baseIsNewTarget)
		{
			baseExpr = this.parsePrimary(context);
		}

		this.failWhenNull(baseExpr, "Cannot parse base expression.");

		loop:
		while(true)
		{
			location = this.tokenLocation;

			switch(this.tok.kind)
			{
				case jsc.Token.Kind.OPEN_BRACKET:
				{
					nonLHSCount = this.state.nonLHSCount;
					initialAssignmentCount = this.state.assignmentCount;
					
					this.state.nonTrivialExprCount++;
					this.next();
					
					expr = this.parseExpression(context);
					this.failWhenNull(expr);
					
					baseExpr = context.createBracketAccessorExpression(location, baseExpr, expr, initialAssignmentCount !== this.state.assignmentCount);
					
					this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACKET);
					this.state.nonLHSCount = nonLHSCount;
					break;
				}
				case jsc.Token.Kind.OPEN_PAREN:
				{
					this.state.nonTrivialExprCount++;

					nonLHSCount = this.state.nonLHSCount;
					
					if(newCount > 0)
					{
						newCount--;

						expr = this.parseArguments(context, true);
						this.failWhenNull(expr);
						
						baseExpr = context.createNewExpressionWithArguments(location, baseExpr, expr);
					}
					else
					{
						expr = this.parseArguments(context, true);
						this.failWhenNull(expr);

						if(baseIsSuper)
							this.currentScope.hasDirectSuper = true;
						
						baseExpr = context.createFunctionCallExpression(beginLocation, baseExpr, expr);
					}
					
					this.state.nonLHSCount = nonLHSCount;
					break;
				}
				case jsc.Token.Kind.DOT:
				{
					this.state.nonTrivialExprCount++;

					this.nextIdentifier();
					this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
					
					baseExpr = context.createDotAccessorExpression(location, this.tok.value, baseExpr);
					
					this.next();
					break;
				}
				case jsc.Token.Kind.TEMPLATE:
				{
					this.fail("NOT IMPLEMENTED");
					break;
				}
				default:
					break loop;
			}

			baseIsSuper = false;
		}

		this.failWhenTrue(baseIsSuper, "Cannot reference super.");

		while(newCount-- > 0)
			baseExpr = context.createNewExpression(location, baseExpr);
			
		return baseExpr;
	},
	
	parsePrimary: function(context) {
		var name = null;
		var value = null;
		var expr = null;
		var begin = null;
		var location = this.tokenLocation;

		switch(this.tok.kind)
		{
			case jsc.Token.Kind.FUNCTION:
			{
				var funcKeywordBegin = this.tokenBegin;
				var functionInfo = null;

				this.next();

				functionInfo = this.parseFunction(context, jsc.Parser.Mode.FUNCTION, false, false, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.NORMAL, false, funcKeywordBegin);
				this.failWhenNull(functionInfo, "Cannot parse function expression.");

				return context.createFunctionExpression(location, functionInfo);
			}
			case jsc.Token.Kind.CLASS:
			{
				var classInfo = this.parseClass(context, false);

				return classInfo.expression;
			}
			case jsc.Token.Kind.OPEN_BRACE:
				return this.parseObjectLiteral(context, this.inStrictMode);
			case jsc.Token.Kind.OPEN_BRACKET:
				return this.parseArrayLiteral(context);
			case jsc.Token.Kind.OPEN_PAREN:
			{
				var nonLHSCount = this.state.nonLHSCount;

				this.next();
				
				expr = this.parseExpression(context);
				
				this.state.nonLHSCount = nonLHSCount;
				this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

				return expr;
			}
			case jsc.Token.Kind.THIS:
			{
				this.next();
				return context.createThisExpression(location);
			}
			case jsc.Token.Kind.IDENTIFIER:
			case jsc.Token.Kind.LET:
			{
				if(this.tok.kind === jsc.Token.Kind.LET && this.inStrictMode)
				{
					this.fail();
					break;
				}

				begin = this.tokenBeginPosition;
				name = this.tok.value;
				
				this.next();
				
				this.currentScope.useVariable(name);
				this.state.lastIdentifier = name;
				
				return context.createResolveExpression(location, name, begin);
			}
			case jsc.Token.Kind.STRING:
			{
				value = this.tok.value;
				this.next();
				
				return context.createStringExpression(location, value);
			}
			case jsc.Token.Kind.DOUBLE:
			{
				value = this.tok.value;
				this.next();
				
				return context.createDoubleExpression(location, value);
			}
			case jsc.Token.Kind.INTEGER:
			{
				value = this.tok.value;
				this.next();

				return context.createIntegerExpression(location, value);
			}
			case jsc.Token.Kind.NULL:
			{
				this.next();
				return context.createNullExpression(location);
			}
			case jsc.Token.Kind.TRUE:
			case jsc.Token.Kind.FALSE:
			{
				value = (this.tok.kind === jsc.Token.Kind.TRUE);

				this.next();
				return context.createBooleanExpression(location, value);
			}
			case jsc.Token.Kind.DIVIDE_EQUAL:
			case jsc.Token.Kind.DIV:
			{
				// regular expression
				var patternPrefix = (this.match(jsc.Token.Kind.DIVIDE_EQUAL) ? '=' : null);
				var props = this.lexer.scanRegEx(patternPrefix);

				location = this.tokenLocation;

				this.failWhenNull(props);
				this.next();
				
				expr = context.createRegExpExpression(location, props.pattern, props.flags);
				
				// TODO: check the syntax of the pattern
				
				if(jsc.Utils.isNull(expr))
					this.fail("Regular expression syntax is invalid.");
				
				return expr;
			}
			case jsc.Token.Kind.TEMPLATE:
				return this.parseTemplateLiteral(context);
			default:
				this.fail();
				break;
		}

		return null;
	},
	
	parseFunctionDeclaration: function(context, isExported) {
		var location = this.tokenLocation;
		var begin = this.tokenBegin;
		var functionInfo = null;

		this.matchOrFail(jsc.Token.Kind.FUNCTION);
		this.next();

		functionInfo = this.parseFunction(context, jsc.Parser.Mode.FUNCTION, true, true, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.NORMAL, false, begin);
		
		this.failWhenNull(functionInfo, "Unable to parse this function.");
		this.failWhenNull(functionInfo.name, "Function statements must have a name.");
		this.failWhenTrueInStrictMode((this.declareVariable(functionInfo.name) & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE), "Cannot declare a function with the name '" + functionInfo.name + "' in strict mode.");

		if(isExported)
		{
			this.failWhenFalse(this.currentScope.exportName(functionInfo.name), "Cannot export a duplicate function name: '" + functionInfo.name + "'.");
			this.currentScope.exportBinding(functionInfo.name);
		}

		return context.createFunctionDeclarationStatement(location, functionInfo);
	},
	
	parseFunction: function(context, mode, needsName, isNameInContainingScope, constructorKind, parseKind, isSuperBindingNeeded, functionKeywordBegin) {
		var name = null;
		var location = null;
		var begin = null;
		var beginColumn = 0;
		var nameBegin = this.tokenBegin;
		var parametersBegin = 0;
		var lastName = null;
		var bodyKind = jsc.Parser.FunctionBodyKind.NORMAL;
		var functionScope = null;
		var functionInfo = new jsc.ParserFunctionInfo();

		try
		{
			functionScope = this.pushScope();
			functionScope.enterFunction();

			switch(parseKind)
			{
				case jsc.Parser.FunctionParseKind.NORMAL:
				{
					if(mode === jsc.Parser.Mode.ARROW_FUNCTION)
						this.fail("Invalid parse mode for current function.");

					if(this.match(jsc.Token.Kind.IDENTIFIER) || this.isLetMaskedAsIdentifier())
					{
						functionInfo.name = this.tok.value;
						lastName = functionInfo.name;

						this.next();

						if(!isNameInContainingScope)
							this.failWhenTrueInStrictMode((functionScope.declareVariable(functionInfo.name) & jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE), "The function '" + functionInfo.name + "' is not a valid " + this.getFunctionModeDescription(mode) + " name in strict mode.");
					}
					else if(needsName)
					{
						if(this.match(jsc.Token.Kind.OPEN_PAREN) && mode === jsc.Parser.Mode.FUNCTION)
							this.fail("Function statements must have a name.");

						this.failForUsingKeyword(this.getFunctionModeDescription(mode) + " name");
						this.fail();

						return null;
					}

					begin = this.tokenLocation;
					beginColumn = this.tokenColumn;
					functionInfo.beginLine = this.tokenLine;

					parametersBegin = this.parseFunctionParameters(context, mode, functionInfo);
					this.failWhenError();

					this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);

					if(this.state.defaultConstructorKind !== jsc.Parser.ConstructorKind.NONE)
					{
						constructorKind = this.state.defaultConstructorKind;
						isSuperBindingNeeded = (constructorKind === jsc.Parser.ConstructorKind.DERIVED);
					}

					bodyKind = jsc.Parser.FunctionBodyKind.NORMAL;
					break;
				}
				case jsc.Parser.FunctionParseKind.ARROW:
				{
					if(mode !== jsc.Parser.Mode.ARROW_FUNCTION)
						this.fail("Invalid parse mode for current function.");

					begin = this.tokenLocation;
					beginColumn = this.tokenColumn;
					functionInfo.beginLine = this.tokenLine;

					parametersBegin = this.parseFunctionParameters(context, mode, functionInfo);
					this.failWhenError();

					this.matchOrFail(jsc.Token.Kind.ARROW_FUNC);

					if(this.lexer.hasLineTerminator)
						this.fail();

					this.next();
					bodyKind = (this.match(jsc.Token.Kind.OPEN_BRACE) ? jsc.Parser.FunctionBodyKind.ARROW_BLOCK : jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION);

					break;
				}
			}

			var isClassConstructor = (constructorKind !== jsc.Parser.ConstructorKind.NONE);
			var lastState = this.saveState();

			functionInfo.bodyBeginColumn = beginColumn;
			this.state.lastFunctionName = lastName;

			functionInfo.body = this.parseFunctionBody(context, begin, beginColumn, functionKeywordBegin, nameBegin, parametersBegin, constructorKind, bodyKind, functionInfo.parameterCount, mode);
			this.restoreState(lastState);

			this.failWhenNull(functionInfo.body, "Unable to parse the body of this " + this.getFunctionModeDescription(mode));
			functionInfo.body.end = this.lexer.position;

			if(functionScope.strictMode && !jsc.Utils.isStringNullOrEmpty(functionInfo.name))
				this.failWhenTrue(jsc.Parser.KnownIdentifiers.isEvalOrArguments(functionInfo.name), "The function name '" + functionInfo.name + "' is not valid in strict mode.");

			if(functionScope.hasDirectSuper)
			{
				this.failWhenTrue(!isClassConstructor, "Cannot call super() outside of a class constructor.");
				this.failWhenTrue(constructorKind !== jsc.Parser.ConstructorKind.DERIVED, "Cannot call super() in a base class constructor.");
			}

			if(functionScope.needsSuperBinding)
				this.failWhenFalse(isSuperBindingNeeded, "Can only use 'super' in a method of a derived class.");

			location = this.tokenLocation;
			functionInfo.end = this.tok.valueInfo.begin;

			if(bodyKind === jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION)
			{
				location = this.lastTokenLocation;
				functionInfo.end = location.end;
			}
		}
		finally
		{
			this.popScope(true);
		}

		if(bodyKind === jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION)
			this.failWhenFalse(this.isEndOfArrowFunction(), "Expected the closing ';'  ','  ']'  ')'  '}', line terminator or EOF after arrow function.");
		else
		{
			this.matchOrFail(jsc.Token.Kind.CLOSE_BRACE);
			this.next();
		}

		functionInfo.endLine = this.state.lastTokenEndPosition.line;

		return functionInfo;
	},

	parseFunctionBody: function(context, begin, beginColumn, functionKeywordBegin, nameBegin, parametersBegin, constructorKind, bodyKind, parameterCount, mode) {
		var isArrowFunction = (bodyKind !== jsc.Parser.FunctionBodyKind.NORMAL);
		var isArrowFunctionExpression = (bodyKind === jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION);
		var endColumn = 0;

		if(!isArrowFunctionExpression)
		{
			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
			{
				endColumn = this.tokenColumn;
				return context.createFunctionMetadata(begin, this.tokenLocation, beginColumn, endColumn, functionKeywordBegin, nameBegin, parametersBegin, parameterCount, this.inStrictMode, isArrowFunction, isArrowFunctionExpression);
			}
		}

		var lastStatementDepth = this.state.statementDepth;

		try
		{
			this.state.statementDepth = 0;

			if(bodyKind === jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION)
				this.failWhenNull(this.parseArrowFunctionSingleExpressionBodyStatementList(context), "Cannot parse body of this arrow function.");
			else
				this.failWhenTrue((this.parseStatementList(context, true).length === 0), (bodyKind === jsc.Parser.FunctionBodyKind.NORMAL ? "Cannot parse body of this function." : "Cannot parse body of this arrow function."));
		}
		finally
		{
			this.state.statementDepth = lastStatementDepth;
		}

		endColumn = this.tokenColumn;
		return context.createFunctionMetadata(begin, this.tokenLocation, beginColumn, endColumn, functionKeywordBegin, nameBegin, parametersBegin, parameterCount, this.inStrictMode, isArrowFunction, isArrowFunctionExpression);
	},

	parseFunctionParameters: function(context, mode, functionInfoRef) {
		this.failWhenTrue((mode === jsc.Parser.Mode.PROGRAM || mode === jsc.Parser.Mode.MODULE), "Invalid parser mode for parsing function.");

		var parameterPattern = null;
		var parametersBegin = this.tokenBegin;
		var parameterList = context.createFunctionParameterList();
		var patternParseContext = null;
		var patternDefaultValue = null;

		functionInfoRef.parameters = parameterList;
		functionInfoRef.begin = parametersBegin;

		if(mode === jsc.Parser.Mode.ARROW_FUNCTION)
		{
			if(!this.match(jsc.Token.Kind.IDENTIFIER) && !this.match(jsc.Token.Kind.OPEN_PAREN))
			{
				this.failForUsingKeyword(this.getFunctionModeDescription(mode) + " name");
				this.fail("Expected an arrow function input parameter.");
			}
			else
			{
				if(this.match(jsc.Token.Kind.OPEN_PAREN))
				{
					this.next();
					this.failWhenFalse(this.parseParameters(context, functionInfoRef), "Cannot parse parameters for this " + this.getFunctionModeDescription(mode) + ".");
				}
				else
				{
					functionInfoRef.parameterCount = 1;

					parameterPattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.PARAMETERS, false);
					this.failWhenNull(parameterPattern, "Cannot parse the parameter pattern.");
					parameterList.append(jsc.AST.FunctionParameterKind.NORMAL, parameterPattern, null);
				}
			}

			return parametersBegin;
		}

		if(!this.consume(jsc.Token.Kind.OPEN_PAREN))
		{
			this.failForUsingKeyword(this.getFunctionModeDescription(mode) + " name");
			this.fail("Expected an opening '(' before a " + this.getFunctionModeDescription(mode) + "'s parameter list.");
		}

		if(mode === jsc.Parser.Mode.GETTER)
		{
			this.failWhenFalse(this.consume(jsc.Token.Kind.CLOSE_PAREN), "Getter functions must have no parameters.");
			functionInfoRef.parameterCount = 0;
		}
		else if(mode === jsc.Parser.Mode.SETTER)
		{
			this.failWhenTrue(this.match(jsc.Token.Kind.CLOSE_PAREN), "Setter functions must have a single parameter.");

			patternParseContext = new jsc.ParserDestructuringContext();
			parameterPattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.PARAMETERS, false, null, null, patternParseContext);
			this.failWhenNull(parameterPattern, "Setter functions must have a single parameter.");

			patternDefaultValue = this.parseDefaultValueForDestructuringPattern(context);
			this.failWhenError();

			if(!jsc.Utils.isStringNullOrEmpty(patternParseContext.duplicateName) && !jsc.Utils.isNull(patternDefaultValue))
				this.fail("Duplicate parameter '" + patternParseContext.duplicateName + "' is not allowed in function with default parameter values.");

			parameterList.append(jsc.AST.FunctionParameterKind.NORMAL, parameterPattern, patternDefaultValue);
			functionInfoRef.parameterCount = 1;

			this.failWhenTrue(this.match(jsc.Token.Kind.COMMA), "Setter functions must have a single parameter.");
			this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		}
		else
		{
			this.failWhenFalse(this.parseParameters(context, functionInfoRef), "Cannot parse parameters for this " + this.getFunctionModeDescription(mode) + ".");
		}

		return parametersBegin;
	},

	parseParameters: function(context, functionInfoRef) {
		var parameterPattern = null;
		var patternDefaultValue = null;
		var patternParseContext = null;
		var restElementWasFound = false;

		if(this.match(jsc.Token.Kind.CLOSE_PAREN))
		{
			this.next();
			functionInfoRef.parameterCount = 0;
			return true;
		}

		patternParseContext = new jsc.ParserDestructuringContext();

		do
		{
			if(this.hasError)
				return false;

			if(this.match(jsc.Token.Kind.CLOSE_PAREN))
				break;

			if(this.match(jsc.Token.Kind.DOTDOTDOT))
			{
				this.next();

				parameterPattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.PARAMETERS, false, null, null, patternParseContext);

				this.failWhenNull(parameterPattern, "Unable to parse rest parameter pattern.");
				this.failWhenError();
				this.failWhenDuplicateParameter(patternParseContext, false);

				functionInfoRef.parameters.append(jsc.AST.FunctionParameterKind.REST, parameterPattern);
				functionInfoRef.parameterCount++;
				restElementWasFound = true;
				break;
			}

			parameterPattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.PARAMETERS, false, null, null, patternParseContext);
			this.failWhenNull(parameterPattern, "Unable to parse parameter pattern.");

			patternDefaultValue = this.parseDefaultValueForDestructuringPattern(context);
			this.failWhenError();
			this.failWhenDuplicateParameter(patternParseContext, !jsc.Utils.isNull(patternDefaultValue));

			functionInfoRef.parameters.append(jsc.AST.FunctionParameterKind.NORMAL, parameterPattern, patternDefaultValue);
			functionInfoRef.parameterCount++;

		} while(this.consume(jsc.Token.Kind.COMMA));

		if(!this.consume(jsc.Token.Kind.CLOSE_PAREN))
			this.fail(restElementWasFound ? "Expected a closing ')' following a rest parameter" : "Expected either a closing ')' or a ',' following a parameter.");

		return true;
	},
	
	parseArguments: function(context, allowSpread) {
		var location = this.tokenLocation;
		var argument = null;

		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		if(this.match(jsc.Token.Kind.CLOSE_PAREN))
		{
			this.next();
			return context.createArgumentsList(location);
		}

		argument = this.parseArgument(context, allowSpread);
		this.failWhenNull(argument);

		var args = context.createArgumentsList(location, argument, null);
		var next = args;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			location = this.tokenLocation;
			this.next();

			argument = this.parseArgument(context, allowSpread);
			this.failWhenNull(argument);

			next = context.createArgumentsList(location, argument, next);
		}

		this.failWhenTrue(this.match(jsc.Token.Kind.DOTDOTDOT), "The '...' operator must come before a target expression.");
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		return args;
	},

	parseArgument: function(context, allowSpread) {
		var location = this.tokenLocation;
		var argument = null;

		if(this.match(jsc.Token.Kind.DOTDOTDOT) && allowSpread)
		{
			this.next();
			argument = this.parseAssignment(context);
			this.failWhenNull(argument, "Unable to parse spread expression.");

			return context.createSpreadExpression(location, argument);
		}

		return this.parseAssignment(context);
	},

	parseArrowFunctionExpression: function(context) {
		var functionInfo = null;
		var location = this.tokenLocation;
		var begin = this.tokenBegin;

		functionInfo = this.parseFunction(context, jsc.Parser.Mode.ARROW_FUNCTION, false, true, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.ARROW, false, begin);
		this.failWhenNull(functionInfo, "Unable to parse arrow function expression.");

		return context.createArrowFunctionExpression(location, functionInfo);
	},

	parseArrowFunctionSingleExpressionBodyStatementList: function(context) {
		if(this.match(jsc.Token.Kind.OPEN_BRACE))
		{
			this.fail();
			return null;
		}

		var location = this.tokenLocation;
		var begin = this.tokenBeginPosition;
		var end = null;
		var expr = null;
		var bodyStatement = null;

		expr = this.parseAssignment(context);
		this.failWhenNull(expr, "Cannot parse the arrow function expression.");

		expr.end = this.lastTokenEndPosition.begin;

		this.failWhenFalse(this.isEndOfArrowFunction(), "Expected a ';'  ']'  '}'  ')'  ',' a line terminator or EOF following a arrow function statement");

		end = this.tokenEndPosition;

		if(!this.lexer.hasLineTerminator)
		{
			this.tok.valueInfo.line = this.lexer.lineNumber;
			this.tok.valueInfo.lineBegin = this.lexer.lineBegin;
			this.tok.valueInfo.begin = this.lexer.position;
		}

		bodyStatement = context.createReturnStatement(location, begin, end, expr);
		bodyStatement.end = this.lastTokenEndPosition.begin;

		return [bodyStatement];
	},

	parseObjectLiteral: function(context, asStrict) {
		var location = null;
		var nonLHSCount = 0;
		var restorePoint = null;

		if(!asStrict)
			restorePoint = this.createRestorePoint();

		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACE);

		location = this.tokenLocation;
		nonLHSCount = this.state.nonLHSCount;

		if(this.match(jsc.Token.Kind.CLOSE_BRACE))
		{
			this.next();
			return context.createObjectLiteralExpression(location);
		}

		var prop = this.parseProperty(context);
		this.failWhenNull(prop, "Cannot parse object literal property.");

		if(!asStrict)
		{
			if(prop.isGetter || prop.isSetter)
			{
				restorePoint.restore(this);
				return this.parseObjectLiteral(context, true);
			}
		}

		var hasUnderscoreProto = (this.needsDuplicateUnderscoreProtoCheck(context, prop) && prop.name === jsc.Parser.KnownIdentifiers.Proto);
		var properties = context.createPropertyList(location, prop);
		var next = properties;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
				break;

			location = this.tokenLocation;
			prop = this.parseProperty(context);
			this.failWhenNull(prop, "Cannot parse object literal property.");

			if(!asStrict)
			{
				if(prop.isGetter || prop.isSetter)
				{
					restorePoint.restore(this);
					return this.parseObjectLiteral(context, true);
				}
			}

			if(this.needsDuplicateUnderscoreProtoCheck(context, prop))
			{
				if(prop.name === jsc.Parser.KnownIdentifiers.Proto)
				{
					this.failWhenTrue(hasUnderscoreProto, "Cannot redefine '__proto__' property.");
					hasUnderscoreProto = true;
				}
			}

			next = context.createPropertyList(location, prop, next);
		}

		location = this.tokenLocation;

		this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACE);
		this.state.nonLHSCount = nonLHSCount;

		return context.createObjectLiteralExpression(location, properties);
	},
	
	parseProperty: function(context) {
		var wasIdentifier = false;
		var node = null;
		var id = null;
		var propertyName = null;
		var propertyMethod = null;

		while(true)
		{
			switch(this.tok.kind)
			{
				case jsc.Token.Kind.IDENTIFIER:
					wasIdentifier = true;
				case jsc.Token.Kind.STRING:
				{
					var getterOrSetterBegin = this.tokenBegin;

					id = this.tok.value;
					this.nextIdentifier();
					
					if(this.match(jsc.Token.Kind.COLON))
					{
						this.next();

						node = this.parseAssignment(context);
						this.failWhenNull(node, "Cannot parse expression for property declaration.");
						node.end = this.lexer.position;

						return context.createProperty(id, node, jsc.AST.PropertyKindFlags.CONSTANT, jsc.AST.PropertyPutKind.UNKNOWN);
					}


					if(this.match(jsc.Token.Kind.OPEN_PAREN))
					{
						propertyMethod = this.parsePropertyMethod(context, id);
						this.failWhenError();

						return context.createProperty(id, propertyMethod, jsc.AST.PropertyKindFlags.CONSTANT, jsc.AST.PropertyPutKind.DIRECT);
					}


					this.failWhenFalse(wasIdentifier, "Expected an identifier as the property name.");

					if(this.match(jsc.Token.Kind.COMMA) || this.match(jsc.Token.Kind.CLOSE_BRACE))
					{
						var begin = this.tokenBegin;

						this.currentScope.useVariable(id);

						node = context.createResolveExpression(name, begin, this.tokenColumn);
						return context.createProperty(id, node, (jsc.AST.PropertyKindFlags.CONSTANT | jsc.AST.PropertyKindFlags.SHORTHAND), jsc.AST.PropertyPutKind.DIRECT);
					}


					var type = jsc.AST.PropertyKindFlags.UNKNOWN;

					if(id === jsc.Parser.KnownIdentifiers.Get)
						type = jsc.AST.PropertyKindFlags.GETTER;
					else if(id === jsc.Parser.KnownIdentifiers.Set)
						type = jsc.AST.PropertyKindFlags.SETTER;
					else
						this.fail("Expected a ':' following the property name '" + id + "'.");

					return this.parseGetterSetter(context, type, getterOrSetterBegin);
				}
				case jsc.Token.Kind.DOUBLE:
				case jsc.Token.Kind.INTEGER:
				{
					propertyName = this.tok.value;
					id = propertyName.toString();

					this.next();

					if(this.match(jsc.Token.Kind.OPEN_PAREN))
					{
						propertyMethod = this.parsePropertyMethod(context, id);
						this.failWhenError();

						return context.createProperty(id, propertyMethod, jsc.AST.PropertyKindFlags.CONSTANT, jsc.AST.PropertyPutKind.UNKNOWN);
					}

					this.consumeOrFail(jsc.Token.Kind.COLON);
					
					node = this.parseAssignment(context);
					this.failWhenNull(node, "Cannot parse expression for property declaration.");
					node.end = this.lexer.position;

					return context.createProperty(id, node, jsc.AST.PropertyKindFlags.CONSTANT, jsc.AST.PropertyPutKind.UNKNOWN);
				}
				case jsc.Token.Kind.OPEN_BRACKET:
				{
					this.next();

					propertyName = this.parseAssignment(context);
					this.failWhenNull(propertyName, "Cannot parse computed property name.");

					this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACKET);

					if(this.match(jsc.Token.Kind.OPEN_PAREN))
					{
						propertyMethod = this.parsePropertyMethod(context);
						this.failWhenError();

						return context.createProperty(propertyName, propertyMethod, (jsc.AST.PropertyKindFlags.CONSTANT | jsc.AST.PropertyKindFlags.COMPUTED), jsc.AST.PropertyPutKind.DIRECT);
					}

					this.consumeOrFail(jsc.Token.Kind.COLON);

					node = this.parseAssignment(context);
					this.failWhenNull(node, "Cannot parse expression for property declaration.");
					node.end = this.lexer.position;

					return context.createProperty(propertyName, node, (jsc.AST.PropertyKindFlags.CONSTANT | jsc.AST.PropertyKindFlags.COMPUTED), jsc.AST.PropertyPutKind.UNKNOWN);
				}
				default:
					this.failWhenFalse(this.tok.kind & jsc.Token.KEYWORD);
					break;
			}
		}
	},

	parsePropertyMethod: function(context, methodName) {
		var location = this.tokenLocation;
		var begin = this.tokenBegin;
		var methodInfo = this.parseFunction(context, jsc.Parser.Mode.METHOD, false, false, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.NORMAL, false, begin);

		this.failWhenNull(methodInfo, "Unable to parse property method.");

		methodInfo.name = methodName;
		return context.createFunctionExpression(location, methodInfo);
	},

	parseGetterSetter: function(context, kind, begin, constructorKind, needsSuperBinding) {
		constructorKind = jsc.Utils.valueOrDefault(constructorKind, jsc.Parser.ConstructorKind.NONE);
		needsSuperBinding = jsc.Utils.valueOrDefault(needsSuperBinding, false);

		var location = this.tokenLocation;
		var propertyName = this.tok.value;
		var functionInfo = null;

		if(this.tok.kind === jsc.Token.Kind.IDENTIFIER || this.tok.kind === jsc.Token.Kind.STRING || this.isLetMaskedAsIdentifier())
		{
			this.failWhenTrue((needsSuperBinding && propertyName === jsc.Parser.KnownIdentifiers.Prototype), "Cannot declare a getter or setter named 'prototype'.");
			this.failWhenTrue((needsSuperBinding && propertyName === jsc.Parser.KnownIdentifiers.Constructor), "Cannot declare a getter or setter named 'constructor'.");
		}
		else if(this.tok.kind !== jsc.Token.Kind.DOUBLE && this.tok.kind !== jsc.Token.Kind.INTEGER)
		{
			this.fail();
		}

		this.next();

		if(!!(kind & jsc.AST.PropertyKindFlags.GETTER))
		{
			this.failWhenFalse(this.match(jsc.Token.Kind.OPEN_PAREN), "Expected a parameter list for getter definition.");

			functionInfo = this.parseFunction(context, jsc.Parser.Mode.GETTER, false, false, constructorKind, jsc.Parser.FunctionParseKind.NORMAL, needsSuperBinding, begin);
			this.failWhenNull(functionInfo, "Unable to parse getter definition.");
		}
		else
		{
			this.failWhenFalse(this.match(jsc.Token.Kind.OPEN_PAREN), "Expected a parameter list for setter definition.");

			functionInfo = this.parseFunction(context, jsc.Parser.Mode.SETTER, false, false, constructorKind, jsc.Parser.FunctionParseKind.NORMAL, needsSuperBinding, begin);
			this.failWhenNull(functionInfo, "Unable to parse setter definition.");
		}

		return context.createGetterOrSetterProperty(location, propertyName, kind, needsSuperBinding, functionInfo);
	},

	parseArrayLiteral: function(context) {
		var location = null;
		var nonLHSCount = this.state.nonLHSCount;
		var elisions = 0;
		var elem = null;
		
		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACKET);

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();
			elisions++;
		}

		if(this.match(jsc.Token.Kind.CLOSE_BRACKET))
		{
			location = this.tokenLocation;
			this.next();
			return context.createArrayExpression(location, null, elisions);
		}

		if(!this.match(jsc.Token.Kind.DOTDOTDOT))
			elem = this.parseAssignment(context);
		else
		{
			location = this.tokenLocation;

			this.next();

			elem = this.parseAssignment(context);
			this.failWhenNull(elem, "Unable to parse the subject of a spread operation.");

			elem = context.createSpreadExpression(location, elem);
		}

		this.failWhenNull(elem, "Cannot parse element in array literal.");

		var elements = context.createArrayElementList(elem, elisions);
		var next = elements;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			elisions = 0;

			this.next();

			while(this.match(jsc.Token.Kind.COMMA))
			{
				this.next();
				elisions++;
			}

			if(this.match(jsc.Token.Kind.CLOSE_BRACKET))
			{
				location = this.tokenLocation;

				this.next();
				return context.createArrayExpression(location, elements, elisions);
			}

			if(this.match(jsc.Token.Kind.DOTDOTDOT))
			{
				location = this.tokenLocation;

				this.next();

				elem = this.parseAssignment(context);
				this.failWhenNull(elem, "Unable to parse the subject of a spread operation.");

				elem = context.createSpreadExpression(location, elem);
				next = context.createArrayElementList(elem, elisions, next);
				continue;
			}

			elem = this.parseAssignment(context);
			this.failWhenNull(elem, "Cannot parse element in array literal.");
			
			next = context.createArrayElementList(elem, elisions, next);
		}

		location = this.tokenLocation;

		if(!this.consume(jsc.Token.Kind.CLOSE_BRACKET))
		{
			this.failWhenFalse(this.match(jsc.Token.Kind.DOTDOTDOT), "Expected either a closing ']' or a ',' following an array element.");
			this.fail("The '...' operator must come before a target expression.");
		}

		this.state.nonLHSCount = nonLHSCount;

		return context.createArrayExpression(location, elements);
	},

	parseTemplateLiteral: function(context) {
		this.fail("NOT IMPLEMENTED");
	},

	insertSemicolon: function() {
		if(this.tok.kind === jsc.Token.Kind.SEMICOLON)
		{
			this.next();
			return true;
		}

		return this.allowAutomaticSemicolon();
	},
	
	allowAutomaticSemicolon: function() {
		return (this.match(jsc.Token.Kind.CLOSE_BRACE) || this.match(jsc.Token.Kind.EOF) || this.lexer.hasLineTerminator);
	},

	needsDuplicateUnderscoreProtoCheck: function(context, prop) {
		if(jsc.Utils.isStringNullOrEmpty(prop.name))
			return false;

		return prop.isConstant;
	},

	isUnaryOp: function(tokenKind) {
		return ((tokenKind & jsc.Token.UNARY) !== 0);
	},
	
	getBinaryOperatorPrecedence: function(tokenKind) {

		if(this.state.allowsIn)
			return (tokenKind & (jsc.Token.PRECEDENCE_MASK << jsc.Token.IN_PRECEDENCE));

		return (tokenKind & jsc.Token.PRECEDENCE_MASK);
	},

	getAssignmentContextKindFromDeclarationKind: function(declarationKind) {
		switch(declarationKind)
		{
			case jsc.Parser.DeclarationKind.CONST:
				return jsc.AST.AssignmentContextKind.CONSTANT_DECLARATION;
			default:
				return jsc.AST.AssignmentContextKind.DECLARATION;
		}
	},

	getDestructuringKindFromDeclarationKind: function(declarationKind) {
		switch(declarationKind)
		{
			case jsc.Parser.DeclarationKind.VAR:
				return jsc.Parser.DestructuringKind.VARIABLES;
			case jsc.Parser.DeclarationKind.LET:
				return jsc.Parser.DestructuringKind.LET;
			case jsc.Parser.DeclarationKind.CONST:
				return jsc.Parser.DestructuringKind.CONST;
		}

		this.throwUnreachableError();
	},

	getFunctionModeDescription: function(mode) {
		switch(mode)
		{
			case jsc.Parser.Mode.FUNCTION:
				return "function";
			case jsc.Parser.Mode.GETTER:
				return "getter";
			case jsc.Parser.Mode.SETTER:
				return "setter";
			case jsc.Parser.Mode.METHOD:
				return "method";
			case jsc.Parser.Mode.ARROW_FUNCTION:
				return "arrow function";
		}

		return "";
	},

	next: function() {
		var lastTokenLine = this.tokenLine;
		var lastTokenLineBegin = this.tokenLineBegin;
		var lastTokenEnd = this.tok.location.end;

		this.state.lastTokenEndPosition = new jsc.TextPosition(lastTokenLine, lastTokenEnd, lastTokenLineBegin);
		this.lexer.lastLineNumber = lastTokenLine;

		this.tok.kind = this.lexer.nextToken(this.tok, this.inStrictMode);
	},
	
	nextIdentifier: function() {
		var lastTokenLine = this.tokenLine;
		var lastTokenLineBegin = this.tokenLineBegin;
		var lastTokenEnd = this.tok.location.end;

		this.state.lastTokenEndPosition = new jsc.TextPosition(lastTokenLine, lastTokenEnd, lastTokenLineBegin);
		this.lexer.lastLineNumber = lastTokenLine;

		this.tok.kind = this.lexer.nextIdentifier(this.tok, this.inStrictMode);
	},
	
	consume: function(expectedKind) {
		var tokenMatches = this.match(expectedKind);
		
		if(tokenMatches)
			this.next();

		return tokenMatches;
	},
	
	consumeOrFail: function(expectedKind) {
		if(!this.consume(expectedKind))
			this.fail(expectedKind);
	},
	
	match: function(expectedKind) {
		return (this.tok.kind === expectedKind);
	},
	
	matchOrFail: function(expectedKind) {
		if(!this.match(expectedKind))
			this.fail(expectedKind);
	},

	createRestorePoint: function() {
		var restorePoint = new jsc.ParserRestorePoint();
		restorePoint.save(this);

		return restorePoint;
	},

	saveState: function() {
		var state = new jsc.ParserState();
		state.save(this);

		return state;
	},

	restoreState: function(state) {
		state.restore(this);
	},

	pushScope: function() {
		var isFunction = false;
		var isStrict = false;

		if(this.scopeStack.length)
		{
			isFunction = this.currentScope.isFunction;
			isStrict = this.currentScope.strictMode;
		}

		this.scopeStack.push(new jsc.ParserScope(isFunction, isStrict));

		return this.currentScope;
	},

	popScope: function(shouldTrackClosedVariables) {
		if(this.scopeStack.length <= 1)
			this.fail("Unable to leave the current scope.");

		this.scopeStack[this.scopeStack.length-2].collectFreeVariables(this.currentScope, shouldTrackClosedVariables);
		this.scopeStack.pop();
	},
	
	declareVariable: function(name, declarationKind, declarationImportKind) {
		declarationKind = jsc.Utils.valueOrDefault(declarationKind, jsc.Parser.DeclarationKind.VAR);
		declarationImportKind = jsc.Utils.valueOrDefault(declarationImportKind, jsc.Parser.DeclarationImportKind.NOT_IMPORTED);

		var i = this.scopeStack.length-1;

		if(declarationKind === jsc.Parser.DeclarationKind.VAR)
		{
			while(!this.scopeStack[i].allowsVarDeclarations) { i--; }

			return this.scopeStack[i].declareVariable(name);
		}
		
		if(this.state.statementDepth === 1 && (this.hasDeclaredParameter(name) || this.hasDeclaredVariable(name)))
			return jsc.Parser.DeclarationResultFlags.INVALID_DUPLICATED;

		while(!this.scopeStack[i].allowsLexicalDeclarations) { i--; }

		return this.scopeStack[i].declareLexicalVariable(name, declarationKind === jsc.Parser.DeclarationKind.CONST, declarationImportKind);
	},
	
	declareParameter: function(name) {
		this.currentScope.declareParameter(name);
	},
	
	declareWrite: function(name) {
		if(this.inStrictMode)
			this.currentScope.declareWrite(name);
	},

	hasDeclaredVariable: function(name) {
		var i = this.scopeStack.length-1;

		while(!this.scopeStack[i].allowsVarDeclarations) { i--; }

		return this.scopeStack[i].hasDeclaredVariable(name);
	},

	hasDeclaredParameter: function(name) {
		var i = this.scopeStack.length-1;

		while(!this.scopeStack[i].allowsVarDeclarations) { i--; }

		return this.scopeStack[i].hasDeclaredParameter(name);
	},

	pushLabel: function(name, isLoop) {
		this.currentScope.pushLabel(name, isLoop);
	},
	
	popLabel: function() {
		this.currentScope.popLabel();
	},
	
	findLabel: function(name) {
		var scope = new jsc.ParserScopeRef(this, this.scopeStack.length-1);
		var result = null;
		
		while(!(result = scope.current.findLabel(name)))
		{
			if(!scope.hasContainingScope)
				return null;
				
			scope = scope.containingScope;
		}

		return result;
	},

	isLetMaskedAsIdentifier: function() {
		return (this.match(jsc.Token.Kind.LET) && !this.inStrictMode);
	},

	isArrowFunctionParameters: function() {
		var isArrowFunction = false;
		var isArrowFunctionParams = false;
		var lastState = null;

		if(this.match(jsc.Token.Kind.EOF))
			return isArrowFunction;

		lastState = this.createRestorePoint();

		if(this.consume(jsc.Token.Kind.IDENTIFIER))
		{
			isArrowFunctionParams = true;

			while(this.consume(jsc.Token.Kind.IDENTIFIER))
			{
				if(this.consume(jsc.Token.Kind.COMMA))
				{
					if(!this.match(jsc.Token.Kind.IDENTIFIER))
					{
						isArrowFunctionParams = false;
						break;
					}

					continue;
				}

				break;
			}

			if(isArrowFunctionParams)
			{
				if(this.consume(jsc.Token.Kind.CLOSE_PAREN) && this.match(jsc.Token.Kind.ARROW_FUNC))
					isArrowFunction = true;
			}
		}
		else if(this.consume(jsc.Token.Kind.IDENTIFIER) && this.match(jsc.Token.Kind.ARROW_FUNC))
			isArrowFunction = true;

		lastState.restore(this);

		return isArrowFunction;
	},

	isEndOfArrowFunction: function() {
		return (
			this.match(jsc.Token.Kind.SEMICOLON) ||
			this.match(jsc.Token.Kind.COMMA) ||
			this.match(jsc.Token.Kind.CLOSE_BRACE) ||
			this.match(jsc.Token.Kind.CLOSE_BRACKET) ||
			this.match(jsc.Token.Kind.CLOSE_PAREN) ||
			this.match(jsc.Token.Kind.EOF) ||
			this.lexer.hasLineTerminator);
	},

	fail: function(tokKindOrMessage) {
		if(!this.hasError)
			this.setError(tokKindOrMessage, true);
	},

	failForUsingKeyword: function(usedAsMessage) {
		if(this.inStrictMode && this.tok.kind === jsc.Token.Kind.RESERVED_STRICT)
			this.fail(jsc.Utils.format("The reserved keyword '%s' cannot be used as a %s in strict mode.", this.tokenString, usedAsMessage));

		if(this.tok.kind === jsc.Token.Kind.RESERVED || this.tok.kind === jsc.Token.Kind.RESERVED_STRICT)
			this.fail(jsc.Utils.format("The reserved keyword '%s' cannot be used as a %s.", this.tokenString, usedAsMessage));

		if(this.tok.isKeyword)
			this.fail(jsc.Utils.format("The keyword '%s' cannot be used as a %s.", this.tokenString, usedAsMessage));
	},

	failWhenError: function() {
		this.throwOnError(true);
	},

	failWhenNull: function(obj, message) {
		if(jsc.Utils.isNull(obj))
			this.fail(message);
	},
	
	failWhenFalse: function(value, message) {
		if(!value)
			this.fail(message);
	},
	
	failWhenTrue: function(value, message) {
		if(value)
			this.fail(message);
	},
	
	failWhenFalseInStrictMode: function(value, message) {
		if(!value && this.inStrictMode)
			this.fail(message);
	},
	
	failWhenTrueInStrictMode: function(value, message) {
		if(value && this.inStrictMode)
			this.fail(message);
	},

	failWhenNullInStrictMode: function(obj, message) {
		if(jsc.Utils.isNull(obj) && this.inStrictMode)
			this.fail(message);
	},

	failWhenDuplicateParameter: function(patternParseContext, hasDefaultValue) {
		if(jsc.Utils.isStringNullOrEmpty(patternParseContext.duplicateName))
			return;

		this.failWhenTrue(hasDefaultValue, "Duplicate parameter '" + patternParseContext.duplicateName + "' is not allowed in function with default parameter values.");
		this.failWhenTrue(patternParseContext.hasPattern, "Duplicate parameter '" + patternParseContext.duplicateName + "' is not allowed in function with destructuring parameters.");
	},

	getErrorMessageForExpectedToken: function(tokenKind) {
		switch(tokenKind)
		{
			case jsc.Token.Kind.RESERVED_STRICT:
				return jsc.Utils.format("The keyword '%s' is reserved and cannot be used in strict mode.", this.tokenString);
			case jsc.Token.Kind.RESERVED:
				return jsc.Utils.format("The keyword '%s' is reserved and cannot be used.", this.tokenString);
			case jsc.Token.Kind.DOUBLE:
				return jsc.Utils.format("Unexpected number '%s'.", this.tokenString);
			case jsc.Token.Kind.IDENTIFIER:
				return jsc.Utils.format("Identifier expected, but found '%s' instead.", this.tokenString);
			case jsc.Token.Kind.STRING:
				return jsc.Utils.format("Unexpected string %s.", this.tokenString);
			case jsc.Token.Kind.ERROR:
				return jsc.Utils.format("The token '%s' was not recognized.", this.tokenString);
			case jsc.Token.Kind.EOF:
				return "Unexpected end of file.";
			case jsc.Token.Kind.RETURN:
				return "Return statements are only valid inside a function.";
			default:
				return "Internal Error";
		}

		return "";
	},

	setError: function(tokKindOrMessage, throwError) {
		throwError = jsc.Utils.valueOrDefault(throwError, false);
		
		var msg = null;

		if(jsc.Utils.isNull(tokKindOrMessage))
		{
			msg = jsc.Token.getName(this.tok.kind);
			msg = (!jsc.Utils.isStringNullOrEmpty(msg) ? "Unexpected token: [" + msg + "]." : this.getErrorMessageForExpectedToken(this.tok.kind));
		}
		else if(jsc.Utils.isString(tokKindOrMessage))
		{
			msg = tokKindOrMessage;
		}
		else
		{
			msg = jsc.Token.getName(tokKindOrMessage);

			if(msg.length)
				msg = "Expected token: " + msg;
			else
			{
				if(jsc.Utils.isStringNullOrEmpty(jsc.Token.getName(this.tok.kind)))
					msg = this.getErrorMessageForExpectedToken(this.tok.kind);
				else
					msg = this.getErrorMessageForExpectedToken(tokKindOrMessage);
			}
		}

		this.setErrorImpl(msg, throwError);
	},

	setErrorImpl: function(message, throwError) {
		var location = this.lastTokenLocation;

		this.state.errorFileName = this.sourceCode.url;
		this.state.errorLine = location.line;
		this.state.errorColumn = (location.begin - location.lineBegin) + 1;
		this.state.error = message;

		if(throwError)
			this.throwOnError(true);
	},

	clearError: function() {
		this.state.error = null;
		this.state.errorColumn = 0;
		this.state.errorLine = 0;
		this.state.errorFileName = null;
	},
	
	throwUnreachableError: function() {
		this.fail("UNREACHABLE CODE SHOULD NOT HAVE BEEN REACHED", false);
	},

	throwOnError: function(reportSourceInfo) {
		reportSourceInfo = jsc.Utils.valueOrDefault(reportSourceInfo, true);

		// only throw when an error exists
		if(this.hasError)
		{
			if(!reportSourceInfo)
				throw new Error(this.state.error);
			else
			{
				var errMsg = this.state.error + "\n\tat " + this.state.errorFileName + ":" + this.state.errorLine + ":" + this.state.errorColumn;
				var errName = "Parse Error (" + this.state.errorLine + ":" + this.state.errorColumn + ")";
				var err = new Error(errMsg);

				err.name = errName;

				throw err;
			}

		}
	},

	debugLog: function(msg /*, ... */) {
		if(this.debugMode)
			console.log(jsc.Utils.format.apply(null, arguments));
	}
});

Object.extend(jsc.Parser, {
	Mode: {
		PROGRAM: 1,
		MODULE: 2,
		FUNCTION: 3,
		GETTER: 4,
		SETTER: 5,
		METHOD: 6,
		ARROW_FUNCTION: 7
	},

	DestructuringKind: {
		VARIABLES: 1,
		LET: 2,
		CONST: 3,
		PARAMETERS: 4,
		EXPRESSIONS: 5
	},

	DeclarationKind: {
		VAR: 1,
		CONST: 2,
		LET: 3
	},

	DeclarationListKind: {
		VAR: 1,
		FORLOOP: 2
	},

	DeclarationImportKind: {
		IMPORTED: 1,
		IMPORTED_NS: 2,
		NOT_IMPORTED: 3
	},

	DeclarationResultFlags: {
		VALID: 0,
		INVALID_STRICT_MODE: 1,
		INVALID_DUPLICATED: 2
	},

	FunctionParseKind: {
		NORMAL: 0,
		ARROW: 1
	},

	FunctionBodyKind: {
		NORMAL: 0,
		ARROW_EXPRESSION: 1,
		ARROW_BLOCK: 2
	},

	FunctionValidationKind: {
		NONE: 0,
		NEEDS_NAME: 1
	},

	ConstructorKind: {
		NONE: 		0,
		BASE: 		1,
		DERIVED:	2
	},

	BindingResult: {
		FAIL: 0,
		FAIL_STRICT: 1,
		OK: 2
	},

	isFunctionParseMode: function(mode) {
		switch(mode)
		{
			case jsc.Parser.Mode.FUNCTION:
			case jsc.Parser.Mode.GETTER:
			case jsc.Parser.Mode.SETTER:
			case jsc.Parser.Mode.METHOD:
			case jsc.Parser.Mode.ARROW_FUNCTION:
				return true;
			case jsc.Parser.Mode.PROGRAM:
			case jsc.Parser.Mode.MODULE:
				return false;
		}

		return false;
	},

	isModuleParseMode: function(mode) {
		switch(mode)
		{
			case jsc.Parser.Mode.MODULE:
				return true;
			case jsc.Parser.Mode.PROGRAM:
			case jsc.Parser.Mode.FUNCTION:
			case jsc.Parser.Mode.GETTER:
			case jsc.Parser.Mode.SETTER:
			case jsc.Parser.Mode.METHOD:
			case jsc.Parser.Mode.ARROW_FUNCTION:
				return false;
		}

		return false;
	},

	isProgramParseMode: function(mode) {
		switch(mode)
		{
			case jsc.Parser.Mode.PROGRAM:
				return true;
			case jsc.Parser.Mode.MODULE:
			case jsc.Parser.Mode.FUNCTION:
			case jsc.Parser.Mode.GETTER:
			case jsc.Parser.Mode.SETTER:
			case jsc.Parser.Mode.METHOD:
			case jsc.Parser.Mode.ARROW_FUNCTION:
				return false;
		}

		return false;
	}
});

/** @class */
jsc.ParserState = Object.define({
	initialize: function() {
		this.assignmentCount = 0;
		this.nonLHSCount = 0;
		this.nonTrivialExprCount = 0;
	},

	save: function(parser) {
		this.assignmentCount = parser.state.assignmentCount;
		this.nonLHSCount = parser.state.nonLHSCount;
		this.nonTrivialExprCount = parser.state.nonTrivialExprCount;
	},

	restore: function(parser) {
		parser.state.assignmentCount = this.assignmentCount;
		parser.state.nonLHSCount = this.nonLHSCount;
		parser.state.nonTrivialExprCount = this.nonTrivialExprCount;
	}
});

/** @class */
jsc.ParserRestorePoint = Object.define({
	initialize: function() {
		this.begin = 0;
		this.lineBegin = 0;
		this.lineNumber = 0;
		this.lastLineNumber = 0;
	},

	save: function(parser) {
		this.begin = parser.tokenBegin;
		this.lineBegin = parser.tokenLineBegin;
		this.lineNumber = parser.lexer.lineNumber;
		this.lastLineNumber = parser.lexer.lastLineNumber;
	},

	restore: function(parser) {
		parser.clearError();
		parser.lexer.resetPosition(this.begin, this.lineBegin);

		parser.next();

		parser.lexer.lastLineNumber = this.lastLineNumber;
		parser.lexer.lineNumber = this.lineNumber;
	}
});

/** @class */
jsc.ParserForLoopContext = Object.define({
	initialize: function(parser) {
		this.parser = parser;
		this.isConstDecl = false;
		this.isVarDecl = false;
		this.isLetDecl = false;
		this.forLoopConstHasInitializer = false;
		this.nonLHSCount = 0;
		this.decls = null;
		this.pattern = null;
		this.lexicalVariables = null;
		this.lexicalScopeRef = null;
	},

	gatherLexicalVariablesIfNeeded: function() {
		if(this.isLetDecl || this.isConstDecl)
			this.lexicalVariables = this.lexicalScopeRef.current.finishLexicalEnvironment();
		else
			this.lexicalVariables = jsc.VariableEnvironment.Empty;
	},

	popLexicalScopeIfNeeded: function() {
		if(this.isLetDecl || this.isConstDecl)
		{
			parser.popScope(true);
			this.lexicalScopeRef = null;
		}
	}
});

/** @class */
jsc.ParserFunctionInfo = Object.define({
	initialize: function() {
		this.name = null;
		this.parameterCount = 0;
		this.parameters = null;
		this.body = null;
		this.begin = 0;
		this.beginLine = 0;
		this.end = 0;
		this.endLine = 0;
		this.bodyBeginColumn = 0;
	}
});

/** @class */
jsc.ParserClassInfo = Object.define({
	initialize: function() {
		this.className = null;
	}
});

/** @class */
jsc.ParserDestructuringContext = Object.define({
	initialize: function(duplicateName, hasPattern) {
		this.duplicateName = jsc.Utils.valueOrDefault(duplicateName, null);
		this.hasPattern = jsc.Utils.valueOrDefault(hasPattern, false);
	}
});


/**
 * Represents an environment scope while parsing.
 *
 * @class
 */
jsc.ParserScope = Object.define({
	initialize: function(isFunction, inStrictMode) {
		this.labels = [];
		this.lexicalVariables = new jsc.VariableEnvironment();
		this.declaredVariables = new jsc.VariableEnvironment();
		this.declaredParameters = new jsc.Utils.HashMap();
		this.usedVariables = new jsc.Utils.HashMap();
		this.closedVariables = new jsc.Utils.HashMap();
		this.writtenVariables = new jsc.Utils.HashMap();
		this.shadowsArguments = false;
		this.usesEval = false;
		this.needsFullActivation = false;
		this.needsSuperBinding = false;
		this.hasDirectSuper = false;
		this.allowsVarDeclarations = true;
		this.allowsLexicalDeclarations = true;
		this.strictMode = inStrictMode;
		this.isFunction = isFunction;
		this.isFunctionBoundary = false;
		this.isModule = false;
		this.isLexicalScope = false;
		this.doesFunctionReturn = false;
		this.isValidStrictMode = true;
		this.loopDepth = 0;
		this.switchDepth = 0;
		this.moduleExportedNames = new jsc.Utils.HashMap();
		this.moduleExportedBindings = new jsc.Utils.HashMap();
	},

	get isInLoop() {
		return (this.loopDepth > 0);
	},

	get canBreak() {
		return (this.isInLoop || this.switchDepth > 0);
	},

	get canContinue() {
		return this.isInLoop;
	},

	beginSwitch: function() {
		this.switchDepth++;
	},

	endSwitch: function() {
		this.switchDepth--;
	},

	beginLoop: function() {
		this.loopDepth++;
	},

	endLoop: function() {
		this.loopDepth--;
	},

	enterFunction: function() {
		this.isFunction = true;
		this.isFunctionBoundary = true;

		this.enterLexicalScope();
	},

	enterModule: function() {
		this.isModule = true;
	},

	enterLexicalScope: function() {
		this.isLexicalScope = true;
		this.allowsLexicalDeclarations = true;
	},

	pushLabel: function(name, isLoop) {
		this.labels.push({
			name: name,
			isLoop: isLoop
		});
	},

	popLabel: function() {
		if(!this.labels.length)
			throw new Error("Cannot pop label. There are no labels on the stack.");

		this.labels.pop();
	},

	findLabel: function(name) {
		if(!this.labels.length)
			return null;

		for(var i = this.labels.length; i > 0; i--)
		{
			if(this.labels[i-1].name === name)
				return this.labels[i-1];
		}

		return null;
	},

	useVariable: function(name) {
		this.usesEval = (this.usesEval || jsc.Parser.KnownIdentifiers.isEval(name));
		this.usedVariables.set(name);
	},

	declareVariable: function(name) {
		if(!this.allowsLexicalDeclarations)
			throw new Error("Variable declarations are not allowed.");

		var result = jsc.Parser.DeclarationResultFlags.VALID;

		this.isValidStrictMode = (this.isValidStrictMode && !jsc.Parser.KnownIdentifiers.isEvalOrArguments(name));

		this.declaredVariables.add(name);
		this.declaredVariables.get(name).isVar = true;

		if(!this.isValidStrictMode)
			result |= jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE;

		return result;
	},

	declareLexicalVariable: function(name, isConstant, importKind) {
		importKind = jsc.Utils.valueOrDefault(importKind, jsc.Parser.DeclarationImportKind.NOT_IMPORTED);

		if(!this.allowsLexicalDeclarations)
			throw new Error("Lexical declarations are not allowed.");

		var result = jsc.Parser.DeclarationResultFlags.VALID;
		var isNew = this.lexicalVariables.add(name);
		var e = this.lexicalVariables.get(name);

		this.isValidStrictMode = (this.isValidStrictMode && !jsc.Parser.KnownIdentifiers.isEvalOrArguments(name));

		if(isConstant)
			e.isConst = true;
		else
			e.isLet = true;

		if(importKind === jsc.Parser.DeclarationImportKind.IMPORTED)
			e.isImported = true;
		else if(importKind === jsc.Parser.DeclarationImportKind.IMPORTED_NS)
		{
			e.isImported = true;
			e.isImportedNamespace = true;
		}

		if(!isNew)
			result |= jsc.Parser.DeclarationResultFlags.INVALID_DUPLICATED;

		if(!this.isValidStrictMode)
			result |= jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE;

		return result;
	},
	
	declareParameter: function(name) {
		var result = jsc.Parser.DeclarationResultFlags.VALID;
		var isNew = this.declaredVariables.add(name);
		var isArguments = (name === jsc.Parser.KnownIdentifiers.Arguments);
		var isEval = (name === jsc.Parser.KnownIdentifiers.Eval);

		this.isValidStrictMode = (this.isValidStrictMode && (isNew && !isEval && !isArguments));

		this.declaredVariables.get(name).isVar = false;
		this.declaredParameters.set(name);

		if(!this.isValidStrictMode)
			result |= jsc.Parser.DeclarationResultFlags.INVALID_STRICT_MODE;

		if(!isNew)
			result |= jsc.Parser.DeclarationResultFlags.INVALID_DUPLICATED;

		if(isArguments)
			this.shadowsArguments = true;

		return result;
	},

	declareBoundParameter: function(name) {
		var isNew = this.declaredVariables.add(name);
		var isArguments = (name === jsc.Parser.KnownIdentifiers.Arguments);
		var isEval = (name === jsc.Parser.KnownIdentifiers.Eval);

		this.isValidStrictMode = (this.isValidStrictMode && (isNew && !isEval && !isArguments));

		this.declaredVariables.get(name).isVar = true;

		if(isArguments)
			this.shadowsArguments = true;

		if(!isNew)
			return jsc.Parser.BindingResult.FAIL;

		return (this.isValidStrictMode ? jsc.Parser.BindingResult.OK : jsc.Parser.BindingResult.FAIL_STRICT);
	},
	
	declareWrite: function(name) {
		this.writtenVariables.set(name);
	},

	exportName: function(exportedName) {
		return this.moduleExportedNames.set(exportedName);
	},

	exportBinding: function(localName) {
		return this.moduleExportedBindings.set(localName);
	},

	hasDeclaredVariable: function(name) {
		return this.declaredVariables.contains(name);
	},

	hasDeclaredLexicalVariable: function(name) {
		return this.lexicalVariables.contains(name);
	},

	hasDeclaredParameter: function(name) {
		return (this.declaredParameters.exists(name) || this.hasDeclaredVariable(name));
	},

	collectFreeVariables: function(nestedScope, shouldTrackClosedVariables) {
		if(nestedScope.usesEval)
			this.usesEval = true;
			
		var keys = nestedScope.usedVariables.keys;

		keys.forEach(function(k) {
			if(nestedScope.declaredVariables.contains(k) || nestedScope.lexicalVariables.contains(k))
				return;

			this.usedVariables.set(k);

			if(shouldTrackClosedVariables && (nestedScope.isFunctionBoundary || !nestedScope.isLexicalScope))
				this.closedVariables.set(k);
		}, this);

		if(shouldTrackClosedVariables && !nestedScope.isFunctionBoundary && nestedScope.closedVariables.length)
			nestedScope.closedVariables.copyTo(this.closedVariables);

		if(nestedScope.writtenVariables.length)
		{
			keys = nestedScope.writtenVariables.keys;
			keys.forEach(function(k) {
				if(nestedScope.declaredVariables.contains(k) || nestedScope.lexicalVariables.contains(k))
					return;

				this.writtenVariables.set(k);
			}, this);
		}
	},

	getCapturedVariables: function() {
		var result = {
			variables: [],
			modifiedParameter: false,
			modifiedArguments: false
		};

		if(this.needsFullActivation || this.usesEval)
		{
			result.modifiedParameter = true;

			this.declaredVariables.forEach(function(key, entry) {
				result.variables.push(key);
			}, this);

			return result;
		}

		var keys = this.closedVariables.keys;

		keys.forEach(function(k) {
			if(!this.declaredVariables.contains(k))
				return;

			result.variables.push(k);
		}, this);

		result.modifiedParameter = false;

		if(this.shadowsArguments)
			result.modifiedArguments = true;

		if(this.declaredParameters.length)
		{
			keys = this.writtenVariables.keys;
			keys.forEach(function(k) {
				if(k === jsc.Parser.KnownIdentifiers.Arguments)
					result.modifiedArguments = true;

				if(!this.declaredVariables.contains(k))
					return;

				result.modifiedParameter = true;
			}, this);
		}

		return result;
	},

	finishLexicalEnvironment: function() {
		if(this.usesEval || this.needsFullActivation)
			this.lexicalVariables.setIsCapturedAll();
		else
		{
			if(this.lexicalVariables.count > 0 && this.closedVariables.length > 0)
			{
				var keys = this.closedVariables.keys;

				keys.forEach(function(k) {
					this.lexicalVariables.setIsCapturedIfDefined(k);
				}, this);
			}

			this.lexicalVariables.forEach(function(k, e) {

				if(e.isCaptured)
					this.closedVariables.remove(k);

			}, this);
		}

		return this.lexicalVariables;
	}
});

/** @class */
jsc.ParserScopeRef = Object.define({
	initialize: function(parser, index) {
		this.parser = parser;
		this.index = index;
	},
	
	get hasContainingScope() {
		return ((this.index > 0) && (!this.parser.scopeStack[this.index].isFunctionBoundary));
	},

	get containingScope() {
		return new jsc.ParserScopeRef(this.parser, this.index - 1);
	},

	get current() {
		return this.parser.scopeStack[this.index];
	}
});


/**
 * Common list of known identifiers.
 */
jsc.Parser.KnownIdentifiers = {
	UseStrict: "use strict",
	Proto: "__proto__",
	Prototype: "prototype",
	Constructor: "constructor",
	Target: "target",
	This: "this",
	Get: "get",
	Set: "set",
	Of: "of",
	As: "as",
	From: "from",
	Arguments: "arguments",
	Eval: "eval",

	isEval: function(name) {
		return (name === jsc.Parser.KnownIdentifiers.Eval);
	},

	isArguments: function(name) {
		return (name === jsc.Parser.KnownIdentifiers.Arguments);
	},

	isEvalOrArguments: function(name) {
		return (jsc.Parser.KnownIdentifiers.isEval(name) || jsc.Parser.KnownIdentifiers.isArguments(name));
	}
};


module.exports = {
	Parser: jsc.Parser,
	ParserScope: jsc.ParserScope
};