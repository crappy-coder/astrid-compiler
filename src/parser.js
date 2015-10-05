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
			lastLine: 1,
			lastColumn: 1,
			lastTokenBegin: 0,
			lastTokenEnd: 0,
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
		return this.sourceCode.toString(this.tok.begin, this.tok.end);
	},
	
	get tokenBegin() {
		return this.tok.begin;
	},
	
	get tokenEnd() {
		return this.tok.end;
	},

	get tokenBeginLine() {
		return this.tok.beginLine;
	},

	get tokenEndLine() {
		return this.tok.endLine;
	},

	get tokenColumn() {
		return this.tok.column;
	},
	
	get lastTokenBegin() {
		return this.state.lastTokenBegin;
	},
	
	get lastTokenEnd() {
		return this.state.lastTokenEnd;
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

		this.next();

		this.lexer.lastLineNumber = this.tokenEndLine;
		this.lexer.lastColumnNumber = this.tokenColumn;
	},

	parse: function() {
		var program = null;
		var errorLine = 0;
		var errorColumn = 0;
		var errorMessage = "";

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

				throw new Error(jsc.Utils.format("[%d, %d] - %s", errorLine, errorColumn, errorMessage));
			}

			program = new jsc.AST.ScriptNode(this.sourceCode, this.lexer.lastLineNumber, this.lexer.lastColumnNumber, this.inStrictMode);
			program.startLine = this.sourceCode.startLine;
			program.endLine = this.state.lastLine;
			program.constantCount = this.state.constantCount;
			program.features = this.features;
			program.statements = this.statements;
			program.functions = this.functions;
			program.variableDeclarations = this.variableDecls.clone();
			program.variables = this.currentScope.finishLexicalEnvironment().clone();
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
		var context = new jsc.AST.Context(this.sourceCode, this.lexer);
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
			if(!this.hasError);
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
				statement.endOffset = this.lastTokenEnd;
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
		var column = this.tokenColumn;
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
					statement = context.createEmptyStatement(column);
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
				statement.endOffset = this.lastTokenEnd;
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
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
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
				this.next();

				result = context.createBlockStatement(null, (lexicalScope ? lexicalScope.finishLexicalEnvironment() : jsc.VariableEnvironment.Empty), beginLine, this.state.lastLine, column);
			}
			else
			{
				statements = this.parseStatementList(context, false);
				this.failWhenNull(statements, "Cannot parse the body of the block statement.");

				this.matchOrFail(jsc.Token.Kind.CLOSE_BRACE);
				this.next();

				result = context.createBlockStatement(statements, (lexicalScope ? lexicalScope.finishLexicalEnvironment() : jsc.VariableEnvironment.Empty), beginLine, this.state.lastLine, column);
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

		var nonLHSCount = this.state.nonLHSCount;
		var innerPattern = null;
		var pattern = null;
		var defaultValue = null;
		var column = this.tokenColumn;
		var restElementWasFound = false;

		switch(this.tok.kind)
		{
			case jsc.Token.Kind.OPEN_BRACKET:
			{
				var arrayPattern = context.createArrayPattern(column);

				if(patternParseContext)
					patternParseContext.hasPattern = true;

				this.next();

				restElementWasFound = false;

				do
				{
					while(this.match(jsc.Token.Kind.COMMA))
					{
						arrayPattern.append(jsc.AST.ArrayPatternBindingKind.ELISION);
						this.next();
					}

					if(this.hasError)
						return null;

					if(this.match(jsc.Token.Kind.CLOSE_BRACKET))
						break;

					if(this.match(jsc.Token.Kind.DOTDOTDOT))
					{
						this.next();

						innerPattern = this.parseDestructuringPattern(context, kind, isExported, bindingContextKind, depth + 1, patternParseContext);

						if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && jsc.Utils.isNull(innerPattern))
							return null;

						this.failWhenNull(innerPattern, "Unable to parse destructuring pattern.");
						this.failWhenTrue((kind !== jsc.Parser.DestructuringKind.EXPRESSIONS && !innerPattern.isBindingPattern), "Expected an identifier for a rest element destructuring pattern.");

						arrayPattern.append(jsc.AST.ArrayPatternBindingKind.REST_ELEMENT, innerPattern);
						restElementWasFound = true;
						break;
					}

					innerPattern = this.parseDestructuringPattern(context, kind, isExported, bindingContextKind, depth + 1, patternParseContext);

					if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && jsc.Utils.isNull(innerPattern))
						return null;

					this.failWhenNull(innerPattern, "Unable to parse destructuring pattern.");

					defaultValue = this.parseDefaultValueForDestructuringPattern(context);
					arrayPattern.append(jsc.AST.ArrayPatternBindingKind.ELEMENT, innerPattern, defaultValue);

				} while(this.consume(jsc.Token.Kind.COMMA));

				if(kind === jsc.Parser.DestructuringKind.EXPRESSIONS && !this.match(jsc.Token.Kind.CLOSE_BRACKET))
					return null;

				this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACKET, restElementWasFound ? "Expected a closing ']' following a rest element destructuring pattern" : "Expected either a closing ']' or a ',' following an element destructuring pattern.");
				pattern = arrayPattern;
				break;
			}
			case jsc.Token.Kind.OPEN_BRACE:
			{
				var objectPattern = context.createObjectPattern(column);

				if(patternParseContext)
					patternParseContext.hasPattern = true;

				this.next();

				do
				{
					var wasString = false;
					var propertyName = null;
					var identifierColumn = this.tokenColumn;

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
							innerPattern = this.createBindingPattern(context, kind, isExported, bindingContextKind, propertyName, depth + 1, identifierColumn, patternParseContext);
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

					objectPattern.append(propertyName, wasString, innerPattern, defaultValue);

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

				pattern = this.createBindingPattern(context, kind, isExported, bindingContextKind, this.tok.value, depth, this.tokenColumn, patternParseContext);
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

	createBindingPattern: function(context, kind, isExported, bindingContextKind, name, depth, tokenColumn, patternParseContext) {
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

		return context.createBindingPattern(name, bindingContextKind, tokenColumn);
	},

	parseVarDeclaration: function(context, declarationKind, isExported) {
		isExported = jsc.Utils.valueOrDefault(isExported, false);

		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
		var result = null;

		if(!this.match(jsc.Token.Kind.VAR) && !this.match(jsc.Token.Kind.LET) && !this.match(jsc.Token.Kind.CONST))
			this.fail(jsc.Utils.format("The token '%s' was not recognized. Expected a 'var', 'let' or 'const'.", this.tokenString));

		result = this.parseVarDeclarationList(context, jsc.Parser.DeclarationListKind.VAR, declarationKind, isExported);

		this.failWhenError();
		this.failWhenFalse(this.insertSemicolon(), "Expected ';' after variable declaration.");

		return context.createDeclarationStatement(result.expr, beginLine, this.state.lastLine, column);
	},
	
	parseVarDeclarationList: function(context, declarationListKind, declarationKind, isExported) {
		var declExpr = null;
		var assignmentContextKind = this.getAssignmentContextKindFromDeclarationKind(declarationKind);
		var result = {
			expr: null,
			count: 0,
			lastName: null,
			lastInitializer: null,
			lastPattern: null,
			nameBegin: 0,
			initBegin: 0,
			initEnd: 0,
			initColumn: 0,
			forLoopConstHasInitializer: true
		};

		do
		{
			var varBegin = 0;
			var varDivot = 0;
			var initialAssignmentCount = 0;
			var hasInitializer = false;
			var name = null;
			var initializer = null;
			var node = null;
			var declarationResult = 0;

			result.lastPattern = null;
			result.lastName = null;
			result.count++;
			
			this.next();

			if(this.match(jsc.Token.Kind.IDENTIFIER) || this.isLetMaskedAsIdentifier())
			{
				this.failWhenTrue(this.match(jsc.Token.Kind.LET) && (declarationKind === jsc.Parser.DeclarationKind.LET || declarationKind === jsc.Parser.DeclarationKind.CONST), "Cannot use 'let' as an identifier name for a Lxical Declaration.");

				varBegin = this.tokenBegin;
				name = this.tok.value;

				result.initColumn = this.tokenColumn;
				result.nameBegin = varBegin;
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
					varDivot = this.tokenBegin + 1;
					result.initColumn = this.tokenColumn;
					result.initBegin = this.tokenBegin;

					this.next();

					initialAssignmentCount = this.state.assignmentCount;
					initializer = this.parseAssignment(context);
					result.initEnd = this.lastTokenEnd;

					result.lastInitializer = initializer;

					this.failWhenNull(initializer, "Expected expression as the initializer for the variable '" + name + "'");

					node = context.createAssignResolveExpression(name, initializer, initialAssignmentCount !== this.state.assignmentCount, assignmentContextKind, varBegin, varDivot, this.lastTokenEnd, result.initColumn);
				}
				else
				{
					if(declarationListKind === jsc.Parser.DeclarationListKind.FORLOOP && declarationKind === jsc.Parser.DeclarationKind.CONST)
						result.forLoopConstHasInitializer = false;

					this.failWhenTrue(declarationListKind !== jsc.Parser.DeclarationListKind.FORLOOP && declarationKind === jsc.Parser.DeclarationKind.CONST, "The const declared variable '" + name + "' must have an initializer.");

					switch(declarationKind)
					{
						case jsc.Parser.DeclarationKind.VAR:
							node = context.createEmptyDeclarationExpression(name, jsc.AST.DeclarationKind.VAR, varBegin, result.initColumn);
							break;
						case jsc.Parser.DeclarationKind.LET:
							node = context.createEmptyDeclarationExpression(name, jsc.AST.DeclarationKind.LET, varBegin, result.initColumn);
							break;
						case jsc.Parser.DeclarationKind.CONST:
							node = context.createEmptyDeclarationExpression(name, jsc.AST.DeclarationKind.CONST, varBegin, result.initColumn);
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
					node = context.createDestructuringAssignmentExpression(pattern, initializer, result.initColumn);

					result.lastInitializer = initializer;
				}
			}

			declExpr = context.combineCommaExpressions(declExpr, node, result.initColumn);
		}
		while(this.match(jsc.Token.Kind.COMMA));

		if(!jsc.Utils.isStringNullOrEmpty(result.lastName))
			result.lastPattern = context.createBindingPattern(result.lastName, assignmentContextKind, result.initColumn);

		result.expr = declExpr;

		return result;
	},

	parseIf: function(context) {
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
		var endLine = 0;
		var hasTrailingElse = false;
		var condition = null;
		var trueBlock = null;
		
		this.matchOrFail(jsc.Token.Kind.IF);
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		condition = this.parseExpression(context);
		this.failWhenNull(condition);
		
		endLine = this.tokenEndLine;
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		
		trueBlock = this.parseStatement(context);
		this.failWhenNull(trueBlock);
		
		if(!this.match(jsc.Token.Kind.ELSE))
			return context.createIfStatement(condition, trueBlock, null, beginLine, endLine, column);
			
		var expressions = [];
		var statements = [];
		var positions = [];
		
		do
		{
			this.next();
			
			if(!this.match(jsc.Token.Kind.IF))
			{
				var statement = this.parseStatement(context);
				this.failWhenNull(statement);
				
				statements.push(statement);
				hasTrailingElse = true;
				break;
			}

			var innerColumn = this.tokenColumn;
			var innerBeginLine = this.tokenEndLine;
			var innerEndLine = 0;
			var innerCondition = null;
			var innerTrueBlock = null;
			
			this.next();
			this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
			
			innerCondition = this.parseExpression(context);
			this.failWhenNull(innerCondition);
			
			innerEndLine = this.tokenEndLine;
			this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
			
			innerTrueBlock = this.parseStatement(context);
			this.failWhenNull(innerTrueBlock);
			
			expressions.push(innerCondition);
			positions.push([innerBeginLine, innerEndLine, innerColumn]);
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
			
			statements.push(context.createIfStatement(expr, block, null, pos[0], pos[1], pos[2]));
		}
		
		while(expressions.length)
		{
			expr = expressions.pop();
			block = statements.pop();
			pos = positions.pop();
			
			statements.push(context.createIfStatement(expr, statements.pop(), block, pos[0], pos[1], pos[2]));
		}
		
		return context.createIfStatement(condition, trueBlock, statements[statements.length-1], beginLine, endLine, column);
	},
	
	parseDoWhile: function(context) {
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
		var endLine = 0;
		var statement = null;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.DO);
		this.next();
		this.currentScope.beginLoop();
		
		statement = this.parseStatement(context);
		
		this.currentScope.endLoop();
		
		this.failWhenNull(statement);
		
		endLine = this.tokenEndLine;
		
		this.consumeOrFail(jsc.Token.Kind.WHILE);
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		expr = this.parseExpression(context);
		
		this.failWhenNull(expr);
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		
		// skip semicolon, will always perform an automatic semicolon insertion
		if(this.match(jsc.Token.Kind.SEMICOLON))
			this.next();
			
		return context.createDoWhileStatement(expr, statement, beginLine, endLine, column);
	},
	
	parseWhile: function(context) {
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
		var endLine = 0;
		var statement = null;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.WHILE);
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		endLine = this.tokenEndLine;
		
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		
		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();

		this.failWhenNull(statement);
			
		return context.createWhileStatement(expr, statement, beginLine, endLine, column);
	},
	
	parseFor: function(context) {
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
		var endLine = 0;
		var expr = null;
		var exprEnd = 0;
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
				loopContext.declsBegin = declListResult.nameBegin;
				loopContext.forLoopConstHasInitializer = declListResult.forLoopConstHasInitializer;

				this.state.allowsIn = true;
				this.failWhenError();

				if(this.match(jsc.Token.Kind.SEMICOLON))
					return this.parseForLoop(context, loopContext, beginLine, column);

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

				exprEnd = this.lastTokenEnd;
				endLine = this.tokenEndLine;

				this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

				this.currentScope.beginLoop();
				statement = this.parseStatement(context);
				this.currentScope.endLoop();

				this.failWhenNull(statement);

				loopContext.gatherLexicalVariablesIfNeeded();

				if(isOfEnumeration)
					result = context.createForOfStatement(declListResult.lastInitializer, expr, statement, loopContext.lexicalVariables, beginLine, endLine, column);
				else
					result = context.createForInStatement(declListResult.lastInitializer, expr, statement, loopContext.lexicalVariables, beginLine, endLine, column);

				loopContext.popLexicalScopeIfNeeded();

				return result;
			}

			if(!this.match(jsc.Token.Kind.SEMICOLON))
			{
				if(this.match(jsc.Token.Kind.OPEN_BRACE) || this.match(jsc.Token.Kind.OPEN_BRACKET))
				{
					var lastState = this.createRestorePoint();

					loopContext.declsBegin = this.tokenBegin;
					loopContext.pattern = this.parseDestructuringPattern(context, jsc.Parser.DestructuringKind.EXPRESSIONS, false, jsc.AST.AssignmentContextKind.DECLARATION);
					loopContext.declsEnd = this.lastTokenEnd;

					if(loopContext.pattern && (this.match(jsc.Token.Kind.IN) || (this.match(jsc.Token.Kind.IDENTIFIER) && this.tok.value === "of")))
						return this.parseEnumerationForLoop(context, loopContext, beginLine, column);

					loopContext.pattern = null;
					lastState.restore(this);
				}

				this.state.allowsIn = false;

				loopContext.declsBegin = this.tokenBegin;
				loopContext.decls = this.parseExpression(context);
				loopContext.declsEnd = this.lastTokenEnd;

				this.state.allowsIn = true;

				this.failWhenNull(loopContext.decls);
			}

			// parse standard for loop
			if(this.match(jsc.Token.Kind.SEMICOLON))
				return this.parseForLoop(context, loopContext, beginLine, column);

			return this.parseEnumerationForLoop(context, loopContext, beginLine, column);
		}
		finally
		{
			if(loopContext.lexicalScopeRef)
				this.popScope(false);
		}
	},

	parseForLoop: function(context, loopContext, beginLine, column) {
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

		endLine = this.tokenEndLine;
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();

		this.failWhenNull(statement);

		loopContext.gatherLexicalVariablesIfNeeded();
		result = context.createForStatement(loopContext.decls, condition, increment, statement, loopContext.lexicalVariables, beginLine, endLine, column);
		loopContext.popLexicalScopeIfNeeded();

		return result;
	},

	parseEnumerationForLoop: function(context, loopContext, beginLine, column) {
		var isOfEnumeration = false;
		var statement = null;
		var expr = null;
		var exprEnd = 0;
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

		exprEnd = this.lastTokenEnd;
		endLine = this.tokenEndLine;

		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();

		this.failWhenNull(statement);

		loopContext.gatherLexicalVariablesIfNeeded();

		if(loopContext.pattern)
		{
			var patternExpr = context.createDestructuringAssignmentExpression(loopContext.pattern, null, column);

			if(isOfEnumeration)
				result = context.createForOfStatement(patternExpr, expr, statement, loopContext.lexicalVariables, beginLine, endLine, column);
			else
				result = context.createForInStatement(patternExpr, expr, statement, loopContext.lexicalVariables, beginLine, endLine, column);

			loopContext.popLexicalScopeIfNeeded();
			return result;
		}

		if(isOfEnumeration)
			result = context.createForOfStatement(loopContext.decls, expr, statement, loopContext.lexicalVariables, beginLine, endLine, column);
		else
			result = context.createForInStatement(loopContext.decls, expr, statement, loopContext.lexicalVariables, beginLine, endLine, column);

		loopContext.popLexicalScopeIfNeeded();
		return result;
	},

	parseContinue: function(context) {
		var column = this.tokenColumn;
		var beginColumn = this.tokenBegin;
		var endColumn = this.tokenEnd;
		var beginLine = this.tokenEndLine;
		var endLine = this.tokenEndLine;
		var name = null;
		var label = null;
		
		this.matchOrFail(jsc.Token.Kind.CONTINUE);
		this.next();
		
		if(this.insertSemicolon())
		{
			this.failWhenFalse(this.canContinue, "The 'continue' keyword can only be used inside a loop statement.");
			return context.createContinueStatement(null, beginColumn, endColumn, beginLine, endLine, column);
		}
		
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		
		name = this.tok.value;
		label = this.findLabel(name);
		
		this.failWhenNull(label, "The label '" + name + "' is not defined");
		this.failWhenFalse(label.isLoop, "The 'continue' keyword can only be used inside a loop statement.");
		
		endColumn = this.tokenEnd;
		endLine = this.tokenEndLine;
		
		this.next();
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createContinueStatement(name, beginColumn, endColumn, beginLine, endLine, column);
	},
	
	parseBreak: function(context) {
		var column = this.tokenColumn;
		var beginColumn = this.tokenBegin;
		var endColumn = this.tokenEnd;
		var beginLine = this.tokenEndLine;
		var endLine = this.tokenEndLine;
		var name = null;
		
		this.matchOrFail(jsc.Token.Kind.BREAK);
		this.next();
		
		if(this.insertSemicolon())
		{
			this.failWhenFalse(this.canBreak, "The 'break' keyword can only be used inside a switch or loop statement.");
			return context.createBreakStatement(null, beginColumn, endColumn, beginLine, endLine, column);
		}
		
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		name = this.tok.value;
		this.failWhenNull(this.findLabel(name), "The label '" + name + "' is not defined.");
		
		endColumn = this.tokenEnd;
		endLine = this.tokenEndLine;
		
		this.next();
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createBreakStatement(name, beginColumn, endColumn, beginLine, endLine, column);
	},
	
	parseReturn: function(context) {
		var scope = this.currentScope;
		var expr = null;
		var column = this.tokenColumn;
		var beginColumn = this.tokenBegin;
		var endColumn = this.tokenEnd;
		var beginLine = this.tokenEndLine;
		var endLine = this.tokenEndLine;
		
		this.matchOrFail(jsc.Token.Kind.RETURN);
		this.failWhenFalse(scope.isFunction);
		this.next();
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			endLine = this.tokenEndLine;
			
		if(this.insertSemicolon())
			return context.createReturnStatement(null, beginColumn, endColumn, beginLine, endLine, column);
			
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		endColumn = this.lastTokenEnd;
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			endLine = this.tokenEndLine;
			
		this.failWhenFalse(this.insertSemicolon());
		
		scope.doesFunctionReturn = true;
		return context.createReturnStatement(expr, beginColumn, endColumn, beginLine, endLine, column);
	},
	
	parseWith: function(context) {
		var column = this.tokenColumn;
		var beginColumn = 0;
		var endColumn = 0;
		var beginLine = 0;
		var endLine = 0;
		var expr = null;
		var statement = null;
		
		this.matchOrFail(jsc.Token.Kind.WITH);
		
		this.failWhenTrue(this.inStrictMode, "The 'with' keyword is not allowed while in strict mode.");

		this.currentScope.needsFullActivation = true;
		
		beginLine = this.tokenEndLine;
		
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		beginColumn = this.tokenBegin;
		expr = this.parseExpression(context);
		this.failWhenNull(expr);

		endColumn = this.lastTokenEnd;
		endLine = this.tokenEndLine;
		
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		statement = this.parseStatement(context);
		this.failWhenNull(statement);

		return context.createWithStatement(expr, statement, beginColumn, endColumn, beginLine, endLine, column);
	},
	
	parseSwitch: function(context) {
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
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

		endLine = this.tokenEndLine;

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

			result = context.createSwitchStatement(expr, defaultClause, firstClauses, secondClauses, scope.finishLexicalEnvironment(), beginLine, endLine, column);
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
		var column = this.tokenColumn;
		var beginColumn = this.tokenBegin;
		var endColumn = 0;
		var beginLine = this.tokenEndLine;
		var endLine = 0;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.THROW);
		this.next();
		this.failWhenTrue(this.insertSemicolon());
		
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		endColumn = this.lastTokenEnd;
		endLine = this.tokenEndLine;
		
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createThrowStatement(expr, beginColumn, endColumn, beginLine, endLine, column);
	},
	
	parseTry: function(context) {
		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
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

		endLine = this.state.lastLine;

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

		return context.createTryStatement(name, tryBlock, catchBlock, finallyBlock, catchVariables, beginLine, endLine, column);
	},
	
	parseDebugger: function(context) {
		var column = this.tokenColumn;
		var begin = this.tokenEndLine;
		var end = begin;
		
		this.matchOrFail(jsc.Token.Kind.DEBUGGER);
		this.next();
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			begin = this.tokenEndLine;
			
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createDebuggerStatement(begin, end, column);
	},
	
	parseExpressionStatement: function(context) {
		switch(this.tok.kind)
		{
			case jsc.Token.Kind.CLASS:
				this.fail("The 'class' declaration is not directly within a block statement.");
				break;
		}

		var column = this.tokenColumn;
		var beginLine = this.tokenEndLine;
		var expr = this.parseExpression(context);
		
		this.failWhenNull(expr);
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createExpressionStatement(expr, beginLine, this.state.lastLine, column);
	},
	
	parseExpression: function(context) {
		var column = this.tokenColumn;
		var lhs = null;
		var rhs = null;
		var commaExpr = null;

		lhs = this.parseAssignment(context);
		this.failWhenNull(lhs);
		lhs.endOffset = this.lastTokenEnd;

		if(!this.match(jsc.Token.Kind.COMMA))
			return lhs;
			
		this.next();
		
		this.state.nonTrivialExprCount++;
		this.state.nonLHSCount++;
		
		rhs = this.parseAssignment(context);
		this.failWhenNull(rhs);
		rhs.endOffset = this.lastTokenEnd;
		
		commaExpr = context.createCommaExpression(lhs, column);
		commaExpr.append(rhs);

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();
			
			rhs = this.parseAssignment(context);
			this.failWhenNull(rhs);
			rhs.endOffset = this.lastTokenEnd;
			
			commaExpr.append(rhs);
		}

		commaExpr.endOffset = this.lastTokenEnd;
		return commaExpr;
	},
	
	parseExpressionOrLabel: function(context) {
		var labels = [];
		var i = 0;

		do {
			var column = this.tokenColumn;
			var beginLine = this.tokenEndLine;
			var beginColumn = this.tokenBegin;
			var endColumn = 0;
			var name = null;
			
			if(!this.lexer.isNextTokenColon)
			{
				var expr = this.parseExpression(context);
				
				this.failWhenNull(expr);
				this.failWhenFalse(this.insertSemicolon());
				
				return context.createExpressionStatement(expr, beginLine, this.state.lastLine, column);
			}
			
			name = this.tok.value;
			endColumn = this.tokenEnd;
			
			this.next();
			this.consumeOrFail(jsc.Token.Kind.COLON);

			for(i = 0; i < labels.length; i++)
				this.failWhenTrue(name === labels[i].name);
					
			this.failWhenTrue(this.findLabel(name) !== null);
			labels.push(new jsc.AST.LabelInfo(name, beginColumn, endColumn, column));

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
			statement = context.createLabelStatement(info, statement);
		}
		
		return statement;
	},
	
	parseAssignment: function(context) {
		var column = this.tokenColumn;
		var beginColumn = this.tokenBegin;
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
					return context.createDestructuringAssignmentExpression(pattern, rhs, column);
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
			context.appendAssignment(lhs, beginColumn, this.tokenBegin, column, this.state.assignmentCount, op);
			
			beginColumn = this.tokenBegin;
			
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
			lhs = context.createAssignmentExpression(lhs, initialAssignmentCount, this.state.assignmentCount);
			assignmentDepth--;
		}

		return lhs;
	},
	
	parseConditional: function(context) {
		var column = this.tokenColumn;
		var lhs = null;
		var rhs = null;
		var cond = this.parseBinary(context);
		
		this.failWhenNull(cond);
		
		if(!this.match(jsc.Token.Kind.QUESTION))
			return cond;
			
		this.state.nonTrivialExprCount++;
		this.state.nonLHSCount++;
		
		this.next();
		
		lhs = this.parseAssignment(context);
		this.consumeOrFail(jsc.Token.Kind.COLON);
		
		rhs = this.parseAssignment(context);
		this.failWhenNull(rhs);
		
		return context.createConditionalExpression(cond, lhs, rhs, column);
	},
	
	parseBinary: function(context) {
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
			
			context.pushBinaryOperand(operationState, currentExpr, beginColumn, this.lastTokenEnd, this.lastTokenEnd, column, initialAssignmentCount !== this.state.assignmentCount);
			
			precedence = this.getBinaryOperatorPrecedence(this.tok.kind);

			if(precedence === 0)
				break;
				
			operatorToken = this.tok.kind;
			
			this.state.nonTrivialExprCount++;
			this.state.nonLHSCount++;

			this.next();

			while(operationState.operatorDepth > 0 && context.precedenceIsLowerThanOperatorStack(precedence))
			{
				context.popBinaryOperation(operationState);
			}

			context.pushBinaryOperation(operationState, operatorToken, precedence);
		}

		while(operationState.operatorDepth > 0)
		{
			context.popBinaryOperation(operationState);
		}
		
		return context.popBinaryOperand();
	},
	
	parseUnary: function(context) {
		var lastAllowsIn = this.state.allowsIn;
		var lastTokenKind = jsc.Token.Kind.UNKNOWN;
		var tokenStackDepth = 0;
		var column = this.tokenColumn;
		var beginColumn = 0;
		var endColumn = 0;
		var modifiesExpression = false;
		var requiresLExpression = false;
		var isEvalOrArguments = false;
		var expr = null;
		
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

			context.pushUnaryToken(this.tok.kind, this.tokenBegin, this.tokenColumn);
			tokenStackDepth++;

			lastTokenKind = this.tok.kind;
			
			this.state.nonLHSCount++;
			this.state.nonTrivialExprCount++;
			
			this.next();
		}
		
		beginColumn = this.tokenBegin;
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
				
				expr = context.createPostfixExpression(expr, (this.tok.kind === jsc.Token.Kind.PLUSPLUS ? jsc.AST.AssignmentOperatorKind.PLUS_PLUS : jsc.AST.AssignmentOperatorKind.MINUS_MINUS), column);
				
				this.state.assignmentCount++;
				
				this.failWhenTrueInStrictMode(isEvalOrArguments, "'" + this.state.lastIdentifier + "' cannot be modified in strict mode.");
				this.failWhenTrue(requiresLExpression, "The '" + jsc.Token.getOperatorDescription(lastTokenKind, false) + "' operator requires a reference expression.");

				this.next();
				break;
			default:
				break;
		}
		
		endColumn = this.lastTokenEnd;

		while(tokenStackDepth > 0)
		{
			var unaryTokenColumn = context.lastUnaryTokenColumn;

			switch(context.lastUnaryTokenKind)
			{
				case jsc.Token.Kind.EXCLAMATION:
					expr = context.createLogicalNotExpression(expr, unaryTokenColumn);
					break;
				case jsc.Token.Kind.TILDE:
					expr = context.createBitwiseNotExpression(expr, unaryTokenColumn);
					break;
				case jsc.Token.Kind.MINUS:
					expr = context.createNegateExpression(expr, unaryTokenColumn);
					break;
				case jsc.Token.Kind.PLUS:
					expr = context.createUnaryPlusExpression(expr, unaryTokenColumn);
					break;
				case jsc.Token.Kind.PLUSPLUS:
				case jsc.Token.Kind.PLUSPLUS_AUTO:
					expr = context.createPrefixExpression(expr, jsc.AST.AssignmentOperatorKind.PLUS_PLUS, unaryTokenColumn);
					this.state.assignmentCount++;
					break;
				case jsc.Token.Kind.MINUSMINUS:
				case jsc.Token.Kind.MINUSMINUS_AUTO:
					expr = context.createPrefixExpression(expr, jsc.AST.AssignmentOperatorKind.MINUS_MINUS, unaryTokenColumn);
					this.state.assignmentCount++;
					break;
				case jsc.Token.Kind.TYPEOF:
					expr = context.createTypeOfExpression(expr, unaryTokenColumn);
					break;
				case jsc.Token.Kind.VOID:
					expr = context.createVoidExpression(expr, unaryTokenColumn);
					break;
				case jsc.Token.Kind.DELETE:
					this.failWhenTrueInStrictMode(expr.isResolve, "Cannot delete unqualified property '" + this.state.lastIdentifier + "' in strict mode.");
					expr = context.createDeleteExpression(expr, context.lastUnaryTokenBegin, endColumn, endColumn, unaryTokenColumn);
					break;
				default:
					this.throwUnreachableError();
					break;
			}
			
			beginColumn = context.lastUnaryTokenBegin;
			
			tokenStackDepth--;
			context.popUnaryToken();
		}
		
		this.state.allowsIn = lastAllowsIn;
		
		return expr;
	},
	
	parseMember: function(context) {
		var column = this.tokenColumn;
		var baseExpr = null;
		var baseIsSuper = false;
		var baseIsNewTarget = false;
		var expr = null;
		var beginColumn = this.tokenBegin;
		var endColumn = 0;
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
					baseExpr = context.createNewTargetExpression(column);

					newCount--;
					this.next();
				}
			}
		}

		if(baseIsSuper)
		{
			this.failWhenFalse(this.currentScope.isFunction, "Using 'super' is only valid inside functions.");

			baseExpr = context.createSuperExpression(column);

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
			column = this.tokenColumn;

			switch(this.tok.kind)
			{
				case jsc.Token.Kind.OPEN_BRACKET:
				{
					endColumn = this.lastTokenEnd;
					nonLHSCount = this.state.nonLHSCount;
					initialAssignmentCount = this.state.assignmentCount;
					
					this.state.nonTrivialExprCount++;
					this.next();
					
					expr = this.parseExpression(context);
					this.failWhenNull(expr);
					
					baseExpr = context.createBracketAccessorExpression(baseExpr, expr, initialAssignmentCount !== this.state.assignmentCount, column);
					
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
						endColumn = this.lastTokenEnd;
						
						expr = this.parseArguments(context, true);
						this.failWhenNull(expr);
						
						baseExpr = context.createNewExpressionWithArguments(baseExpr, expr, column);
					}
					else
					{
						endColumn = this.lastTokenEnd;
						expr = this.parseArguments(context, true);
						this.failWhenNull(expr);

						if(baseIsSuper)
							this.currentScope.hasDirectSuper = true;
						
						baseExpr = context.createFunctionCallExpression(baseExpr, expr, column);
					}
					
					this.state.nonLHSCount = nonLHSCount;
					break;
				}
				case jsc.Token.Kind.DOT:
				{
					this.state.nonTrivialExprCount++;
					
					endColumn = this.lastTokenEnd;
					
					this.nextIdentifier();
					this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
					
					baseExpr = context.createDotAccessorExpression(this.tok.value, baseExpr, column);
					
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
			baseExpr = context.createNewExpression(baseExpr, column);
			
		return baseExpr;
	},
	
	parsePrimary: function(context) {
		var name = null;
		var value = null;
		var expr = null;
		var beginColumn = null;
		var column = this.tokenColumn;

		switch(this.tok.kind)
		{
			case jsc.Token.Kind.FUNCTION:
			{
				var funcKeywordBegin = this.tokenBegin;
				var functionInfo = null;

				this.next();

				functionInfo = this.parseFunction(context, jsc.Parser.Mode.FUNCTION, false, false, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.NORMAL, false, funcKeywordBegin);
				this.failWhenNull(functionInfo, "Cannot parse function expression.");

				return context.createFunctionExpression(functionInfo.name, functionInfo.body, functionInfo.parameters, functionInfo.begin, functionInfo.end, functionInfo.beginLine, functionInfo.endLine, functionInfo.bodyBeginColumn, column);
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
				return context.createThisExpression(column);
			}
			case jsc.Token.Kind.IDENTIFIER:
			case jsc.Token.Kind.LET:
			{
				if(this.tok.kind === jsc.Token.Kind.LET && this.inStrictMode)
				{
					this.fail();
					break;
				}

				beginColumn = this.tokenBegin;
				name = this.tok.value;
				
				this.next();
				
				this.currentScope.useVariable(name);
				this.state.lastIdentifier = name;
				
				return context.createResolveExpression(name, beginColumn, column);
			}
			case jsc.Token.Kind.STRING:
			{
				value = this.tok.value;
				this.next();
				
				return context.createStringExpression(value, column);
			}
			case jsc.Token.Kind.DOUBLE:
			{
				value = this.tok.value;
				this.next();
				
				return context.createDoubleExpression(value, column);
			}
			case jsc.Token.Kind.INTEGER:
			{
				value = this.tok.value;
				this.next();

				return context.createIntegerExpression(value, column);
			}
			case jsc.Token.Kind.NULL:
			{
				this.next();
				return context.createNullExpression(column);
			}
			case jsc.Token.Kind.TRUE:
			case jsc.Token.Kind.FALSE:
			{
				value = (this.tok.kind === jsc.Token.Kind.TRUE);

				this.next();
				return context.createBooleanExpression(value, column);
			}
			case jsc.Token.Kind.DIVIDE_EQUAL:
			case jsc.Token.Kind.DIV:
			{
				// regular expression
				var patternPrefix = (this.match(jsc.Token.Kind.DIVIDE_EQUAL) ? '=' : null);
				var props = this.lexer.scanRegEx(patternPrefix);

				beginColumn = this.tokenBegin;
				expr = null;
				
				this.failWhenNull(props);
				this.next();
				
				expr = context.createRegExpExpression(props.pattern, props.flags, beginColumn, column);
				
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
		var functionInfo = null;
		var column = this.tokenColumn;
		var begin = this.tokenBegin;

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

		return context.createFunctionDeclarationStatement(
			functionInfo.name,
			functionInfo.body,
			functionInfo.parameters,
			functionInfo.begin,
			functionInfo.end,
			functionInfo.beginLine,
			functionInfo.endLine,
			functionInfo.bodyBeginColumn,
			column);
	},
	
	parseFunction: function(context, mode, needsName, isNameInContainingScope, constructorKind, parseKind, isSuperBindingNeeded, functionKeywordBegin) {
		var name = null;
		var begin = 0;
		var nameBegin = this.tokenBegin;
		var parametersBegin = 0;
		var beginColumn = 0;
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

					begin = this.tokenBegin;
					beginColumn = this.tokenColumn;
					functionInfo.beginLine = this.tokenBeginLine;

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

					begin = this.tokenBegin;
					beginColumn = this.tokenColumn;
					functionInfo.beginLine = this.tokenBeginLine;

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
			functionInfo.body.endOffset = this.lexer.position;

			if(functionScope.strictMode && !jsc.Utils.isStringNullOrEmpty(functionInfo.name))
				this.failWhenTrue(jsc.Parser.KnownIdentifiers.isEvalOrArguments(functionInfo.name), "The function name '" + functionInfo.name + "' is not valid in strict mode.");

			if(functionScope.hasDirectSuper)
			{
				this.failWhenTrue(!isClassConstructor, "Cannot call super() outside of a class constructor.");
				this.failWhenTrue(constructorKind !== jsc.Parser.ConstructorKind.DERIVED, "Cannot call super() in a base class constructor.");
			}

			if(functionScope.needsSuperBinding)
				this.failWhenFalse(isSuperBindingNeeded, "Can only use 'super' in a method of a derived class.");

			functionInfo.end = this.tokenEnd;

			if(bodyKind === jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION)
				functionInfo.end = this.lastTokenEnd;
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

		functionInfo.endLine = this.state.lastLine;

		return functionInfo;
	},

	parseFunctionBody: function(context, begin, beginColumn, functionKeywordBegin, nameBegin, parametersBegin, constructorKind, bodyKind, parameterCount, mode) {
		var isArrowFunction = (bodyKind !== jsc.Parser.FunctionBodyKind.NORMAL);
		var isArrowFunctionExpression = (bodyKind === jsc.Parser.FunctionBodyKind.ARROW_EXPRESSION);

		if(!isArrowFunctionExpression)
		{
			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
				return context.createFunctionMetadata(begin, this.tokenEnd, beginColumn, this.tokenColumn, functionKeywordBegin, nameBegin, parametersBegin, parameterCount, this.inStrictMode, isArrowFunction, isArrowFunctionExpression);
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

		return context.createFunctionMetadata(begin, this.tokenEnd, beginColumn, this.tokenColumn, functionKeywordBegin, nameBegin, parametersBegin, parameterCount, this.inStrictMode, isArrowFunction, isArrowFunctionExpression);
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
		var column = this.tokenColumn;
		var argument = null;

		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		if(this.match(jsc.Token.Kind.CLOSE_PAREN))
		{
			this.next();
			return context.createArgumentsList(column);
		}

		argument = this.parseArgument(context, allowSpread);
		this.failWhenNull(argument);

		var args = context.createArgumentsList(column, argument, null);
		var next = args;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();

			argument = this.parseArgument(context, allowSpread);
			this.failWhenNull(argument);

			next = context.createArgumentsList(column, argument, next);
		}

		this.failWhenTrue(this.match(jsc.Token.Kind.DOTDOTDOT), "The '...' operator must come before a target expression.");
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		return args;
	},

	parseArgument: function(context, allowSpread) {
		var column = this.tokenColumn;
		var argument = null;

		if(this.match(jsc.Token.Kind.DOTDOTDOT) && allowSpread)
		{
			this.next();
			argument = this.parseAssignment(context);
			this.failWhenNull(argument, "Unable to parse spread expression.");

			return context.createSpreadExpression(argument, column);
		}

		return this.parseAssignment(context);
	},

	parseArrowFunctionExpression: function(context) {
		var functionInfo = null;
		var column = this.tokenColumn;
		var begin = this.tokenBegin;

		functionInfo = this.parseFunction(context, jsc.Parser.Mode.ARROW_FUNCTION, false, true, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.ARROW, false, begin);

		this.failWhenNull(functionInfo, "Unable to parse arrow function expression.");

		return context.createArrowFunctionExpression(functionInfo.name, functionInfo.body, functionInfo.begin, functionInfo.end, functionInfo.beginLine, functionInfo.endLine, functionInfo.bodyBeginColumn, column);
	},

	parseArrowFunctionSingleExpressionBodyStatementList: function(context) {
		if(this.match(jsc.Token.Kind.OPEN_BRACE))
		{
			this.fail();
			return null;
		}

		var begin = this.tokenBegin;
		var end = 0;
		var expr = null;
		var bodyStatement = null;

		expr = this.parseAssignment(context);
		this.failWhenNull(expr, "Cannot parse the arrow function expression.");

		expr.endOffset = this.lastTokenEnd;

		this.failWhenFalse(this.isEndOfArrowFunction(), "Expected a ';'  ']'  '}'  ')'  ',' a line terminator or EOF following a arrow function statement");

		end = this.tokenEnd;

		if(!this.lexer.hasLineTerminator)
		{
			this.tok.begin = this.lexer.position;
			this.tok.beginLine = this.lexer.lineNumber;
			this.tok.column = this.lexer.columnNumber;
		}

		bodyStatement = context.createReturnStatement(expr, begin, end, this.tokenBeginLine, this.tokenEndLine, this.tokenColumn);
		bodyStatement.endOffset = this.lastTokenEnd;

		return [bodyStatement];
	},

	parseObjectLiteral: function(context, asStrict) {
		var column = this.tokenColumn;
		var nonLHSCount = 0;
		var restorePoint = null;

		if(!asStrict)
			restorePoint = this.createRestorePoint();

		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACE);

		nonLHSCount = this.state.nonLHSCount;

		if(this.match(jsc.Token.Kind.CLOSE_BRACE))
		{
			this.next();
			return context.createObjectLiteralExpression(column);
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
		var properties = context.createPropertyList(column, prop);
		var next = properties;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			var propColumn = this.tokenColumn;

			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
				break;

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

			next = context.createPropertyList(propColumn, prop, next);
		}

		this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACE);
		this.state.nonLHSCount = nonLHSCount;

		return context.createObjectLiteralExpression(column, properties);
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

					return context.createProperty(propertyName, node, (jsc.AST.PropertyKindFlags.CONSTANT | jsc.AST.PropertyKindFlags.COMPUTED), jsc.AST.PropertyPutKind.UNKNOWN);
				}
				default:
					this.failWhenFalse(this.tok.kind & jsc.Token.KEYWORD);
					break;
			}
		}
	},

	parsePropertyMethod: function(context, methodName) {
		var begin = this.tokenBegin;
		var column = this.tokenColumn;
		var methodInfo = this.parseFunction(context, jsc.Parser.Mode.METHOD, false, false, jsc.Parser.ConstructorKind.NONE, jsc.Parser.FunctionParseKind.NORMAL, false, begin);

		this.failWhenNull(methodInfo, "Unable to parse property method.");

		methodInfo.name = methodName;
		return context.createFunctionExpression(
			methodInfo.name,
			methodInfo.body,
			methodInfo.parameters,
			methodInfo.begin,
			methodInfo.end,
			methodInfo.beginLine,
			methodInfo.endLine,
			methodInfo.bodyBeginColumn,
			column);
	},

	parseGetterSetter: function(context, kind, begin, constructorKind, needsSuperBinding) {
		constructorKind = jsc.Utils.valueOrDefault(constructorKind, jsc.Parser.ConstructorKind.NONE);
		needsSuperBinding = jsc.Utils.valueOrDefault(needsSuperBinding, false);

		var column = this.tokenColumn;
		var propertyName = this.tok.value;
		var functionInfo = null;

		if(this.tok.kind === jsc.Token.Kind.IDENTIFIER || this.tok.kind === jsc.Token.Kind.STRING || this.isLetMaskedAsIdentifier())
		{
			this.failWhenTrue((needsSuperBinding && propertyName === jsc.Parser.KnownIdentifiers.Prototype), "Cannot declare a getter or setter named 'prototype'.");
			this.failWhenTrue((needsSuperBinding && propertyName === jsc.Parser.KnownIdentifiers.Constructor), "Cannot declare a getter or setter named 'constructor'.");
		}
		else if(this.tok.kind === jsc.Token.Kind.DOUBLE || this.tok.kind === jsc.Token.Kind.INTEGER)
		{
			propertyName = propertyName.toString();
		}
		else
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

		return context.createGetterOrSetterProperty(
			propertyName,
			kind,
			needsSuperBinding,
			functionInfo.body,
			functionInfo.begin,
			functionInfo.end,
			functionInfo.beginLine,
			functionInfo.endLine,
			functionInfo.bodyBeginColumn,
			column);
	},

	parseArrayLiteral: function(context) {
		var column = this.tokenColumn;
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
			this.next();
			return context.createArrayExpression(column, null, elisions);
		}

		if(!this.match(jsc.Token.Kind.DOTDOTDOT))
			elem = this.parseAssignment(context);
		else
		{
			this.next();

			elem = this.parseAssignment(context);
			this.failWhenNull(elem, "Unable to parse the subject of a spread operation.");

			elem = context.createSpreadExpression(elem, column);
		}

		this.failWhenNull(elem);

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
				this.next();
				return context.createArrayExpression(column, elements, elisions);
			}

			if(this.match(jsc.Token.Kind.DOTDOTDOT))
			{
				var spreadColumn = this.tokenColumn;

				this.next();

				elem = this.parseAssignment(context);
				this.failWhenNull(elem, "Unable to parse the subject of a spread operation.");

				elem = context.createSpreadExpression(elem, spreadColumn);
				next = context.createArrayElementList(elem, elisions, next);
				continue;
			}

			elem = this.parseAssignment(context);
			this.failWhenNull(elem);
			
			next = context.createArrayElementList(elem, elisions, next);
		}

		if(!this.consume(jsc.Token.Kind.CLOSE_BRACKET))
		{
			this.failWhenFalse(this.match(jsc.Token.Kind.DOTDOTDOT), "Expected either a closing ']' or a ',' following an array element.");
			this.fail("The '...' operator must come before a target expression.");
		}

		this.state.nonLHSCount = nonLHSCount;

		return context.createArrayExpression(column, elements);
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
		this.state.lastLine = this.tokenEndLine;
		this.state.lastColumn = this.tokenColumn;
		this.state.lastTokenBegin = this.tokenBegin;
		this.state.lastTokenEnd = this.tokenEnd;

		this.lexer.lastLineNumber = this.state.lastLine;
		this.lexer.lastColumnNumber = this.state.lastColumn;

		this.tok.kind = this.lexer.nextToken(this.tok, this.inStrictMode);
	},
	
	nextIdentifier: function() {
		this.state.lastLine = this.tokenEndLine;
		this.state.lastColumn = this.tokenColumn;
		this.state.lastTokenBegin = this.tokenBegin;
		this.state.lastTokenEnd = this.tokenEnd;

		this.lexer.lastLineNumber = this.state.lastLine;
		this.lexer.lastColumnNumber = this.state.lastColumn;

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
		this.state.errorFileName = this.sourceCode.url;
		this.state.errorLine = this.state.lastLine;
		this.state.errorColumn = this.state.lastTokenBegin - this.lexer.lastLinePosition - 1;
		this.state.error = message;

		if(throwError)
			this.throwOnError(true);
	},

	clearError: function() {
		this.state.error = null;
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
		this.position = 0;
		this.lineNumber = 0;
		this.lastLineNumber = 0;
		this.columnNumber = 0;
		this.lastColumnNumber = 0;
	},

	save: function(parser) {
		this.position = parser.tokenBegin;
		this.lineNumber = parser.lexer.lineNumber;
		this.lastLineNumber = parser.lexer.lastLineNumber;
		this.columnNumber = parser.lexer.columnNumber;
		this.lastColumnNumber = parser.lexer.lastColumnNumber;
	},

	restore: function(parser) {
		parser.lexer.position = this.position;
		parser.next();

		parser.lexer.lastLineNumber = this.lastLineNumber;
		parser.lexer.lineNumber = this.lineNumber;
		parser.lexer.lastColumnNumber = this.lastColumnNumber;
		parser.lexer.columnNumber = this.columnNumber;
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
		this.declsBegin = 0;
		this.declsEnd = 0;
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