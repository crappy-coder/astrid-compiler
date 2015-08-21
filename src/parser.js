var jsc = require("./jsc");
require("./ast");
require("./lexer");
require("./token");
require("./utils");

/*
	Parser parser(globalContext, sourceCode, parameters, Parser::ParserStrictnessNormal, Parser::ParserModeProgram);
	ProgramNode* program = parser.Parse<ProgramNode>();
*/

/**
 * The JavaScript source parser.
 *
 * @class
 */
jsc.Parser = Object.define({
	initialize: function(sourceCode, parameters, inStrictMode, parserMode) {
		if(jsc.Utils.isNull(sourceCode))
			throw new Error("The sourceCode argument must not be null.");

		this.state = {
			mode: jsc.Utils.valueOrDefault(parserMode, jsc.Parser.Mode.PROGRAM),
			lastIdentifier: null,
			lastLine: 0,
			lastTokenBegin: 0,
			lastTokenEnd: 0,
			assignmentCount: 0,
			constantCount: 0,
			nonLHSCount: 0,
			nonTrivialExprCount: 0,
			statementDepth: 0,
			allowsIn: true,
			debugMode: false,
			hasSyntaxBeenValidated: true,
			error: null
		};

		this.sourceCode = sourceCode;
		this.lexer = new jsc.Lexer(sourceCode);
		this.tok = new jsc.Token();
		this.scopeStack = [];
		this.features = jsc.AST.CodeFeatureFlags.NONE;
		this.statements = null;
		this.variableDecls = null;
		this.functions = null;
		this.capturedVariables = null;
		
		this.prepare(parameters, inStrictMode);
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

	get error() {
		return this.state.error;
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
	
	get tokenLine() {
		return this.tok.line;
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
	
	prepare: function(parameters, inStrictMode) {
		var scope = this.pushScope();
		
		if(this.mode === jsc.Parser.Mode.FUNCTION)
			scope.enterFunction();
			
		if(inStrictMode)
			scope.strictMode = true;
			
		if(parameters && parameters.length)
		{
			for(var i = 0; i < parameters.length; i++)
				scope.declareParameter(parameters[i]);
		}
		
		this.next();
		this.lexer.lastLineNumber = this.tokenLine;
	},

	parse: function(asFunction) {
		asFunction = jsc.Utils.valueOrDefault(asFunction, false);

		var program = null;
		var errorLine = 0;
		var errorColumn = 0;
		var errorMessage = "";
			
		try
		{
			if(asFunction)
				this.lexer.isReparsing = true;

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

			program = new jsc.AST.Script(this.sourceCode, this.lexer.lastLineNumber);
			program.startLine = this.sourceCode.startLine;
			program.endLine = this.state.lastLine;
			program.constantCount = this.state.constantCount;
			program.features = this.features;
			program.statements = this.statements;
			program.functions = this.functions;
			program.variables = this.variableDecls;
			program.capturedVariables = this.capturedVariables;
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
		
		if(this.lexer.isReparsing)
			this.state.statementDepth--;
			
		this.statements = this.parseStatements(context, true);
		this.consume(jsc.Token.Kind.EOF);

		this.capturedVariables = scope.capturedVariables;
		this.features = context.features;
		this.variableDecls = context.variableDecls;
		this.functions = context.functions;
		this.state.constantCount = context.constantCount;
		
		if(scope.strictMode)
			this.features |= jsc.AST.CodeFeatureFlags.STRICT_MODE;
		
		if(scope.shadowsArguments)
			this.features |= jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS;
	},
	
	parseStatements: function(context, checkForStrictMode) {
		var statements = [];
		var hasDirective = false;
		var hasSetStrict = false;
		var start = this.tokenBegin;
		var lexLastLineNumber = this.lexer.lastLineNumber;
		var lexLineNumber = this.lexer.lineNumber;
		
		while(true)
		{
			var statement = this.parseStatement(context);
			
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
						
						this.failWhenFalse(this.currentScope.isStrictModeValid);
						
						this.lexer.position = start;
						this.next();
						this.lexer.lastLineNumber = lexLastLineNumber;
						this.lexer.lineNumber = lexLineNumber;
						
						this.failWhenTrue(this.hasError);
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
		
		if(this.hasError)
			this.fail();

		return statements;
	},
	
	parseStatement: function(context) {
		var nonTrivialExprCount = 0;
		var directive = null;
		var lastStatementDepth = this.state.statementDepth;
		var lastError = null;
		
		try
		{
			this.state.statementDepth++;
			
			switch(this.tok.kind)
			{
				case jsc.Token.Kind.OPEN_BRACE:
					return this.parseBlock(context);
					
				case jsc.Token.Kind.VAR:
					return this.parseVarDeclaration(context);
					
				case jsc.Token.Kind.CONST:
					return this.parseConstDeclaration(context);
					
				case jsc.Token.Kind.FUNCTION:
					this.failWhenFalseInStrictMode(this.state.statementDepth === 1, "Functions cannot be declared in a nested block in strict mode.");
					return this.parseFunctionDeclaration(context);
					
				case jsc.Token.Kind.SEMICOLON:
					this.next();
					return context.createEmptyStatement();
					
				case jsc.Token.Kind.IF:
					return this.parseIf(context);
					
				case jsc.Token.Kind.DO:
					return this.parseDoWhile(context);
					
				case jsc.Token.Kind.WHILE:
					return this.parseWhile(context);
					
				case jsc.Token.Kind.FOR:
					return this.parseFor(context);
					
				case jsc.Token.Kind.CONTINUE:
					return this.parseContinue(context);
					
				case jsc.Token.Kind.BREAK:
					return this.parseBreak(context);
					
				case jsc.Token.Kind.RETURN:
					return this.parseReturn(context);
					
				case jsc.Token.Kind.WITH:
					return this.parseWith(context);
					
				case jsc.Token.Kind.SWITCH:
					return this.parseSwitch(context);
					
				case jsc.Token.Kind.THROW:
					return this.parseThrow(context);
					
				case jsc.Token.Kind.TRY:
					return this.parseTry(context);
					
				case jsc.Token.Kind.DEBUGGER:
					return this.parseDebugger(context);

				// end of statement tokens
				case jsc.Token.Kind.EOF:
				case jsc.Token.Kind.CASE:
				case jsc.Token.Kind.CLOSE_BRACE:
				case jsc.Token.Kind.DEFAULT:
					return null;
					
				case jsc.Token.Kind.IDENTIFIER:
					return this.parseExpressionOrLabel(context);
					
				case jsc.Token.Kind.STRING:
					directive = this.tok.value;
					nonTrivialExprCount = this.state.nonTrivialExprCount;
				default:
					var statement = this.parseExpressionStatement(context);
					
					if(!jsc.Utils.isNull(directive) && nonTrivialExprCount !== this.state.nonTrivialExprCount)
						directive = null;
						
					if(!jsc.Utils.isNull(directive) && statement.expression instanceof jsc.AST.StringExpression)
						statement.expression.isDirective = true;
						
					return statement;
			}
		}
		finally
		{
			this.state.statementDepth = lastStatementDepth;
		}
	},
	
	parseBlock: function(context) {
		var beginLine = this.tokenLine;
		var statements = null;
		
		this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);
		this.next();
		
		if(this.match(jsc.Token.Kind.CLOSE_BRACE))
		{
			this.next();
			
			return context.createBlockStatement(null, beginLine, this.state.lastLine);
		}
		
		statements = this.parseStatements(context, false);
		
		this.failWhenNull(statements);
		
		this.matchOrFail(jsc.Token.Kind.CLOSE_BRACE);
		this.next();
		
		return context.createBlockStatement(statements, beginLine, this.state.lastLine);
	},
	
	parseVarDeclaration: function(context) {
		var beginLine = this.tokenLine;
		var result = null;
		
		this.matchOrFail(jsc.Token.Kind.VAR);
		
		result = this.parseVarDeclarationList(context);

		this.failWhenError();
		this.failWhenFalse(this.insertSemicolon());

		return context.createVarStatement(result.expr, beginLine, this.state.lastLine);
	},
	
	parseVarDeclarationList: function(context) {
		var varDeclExpr = null;
		var varDeclCount = 0;
		var lastName = null;
		var lastInitializer = null;
		var nameBegin = 0;
		var initBegin = 0;
		var initEnd = 0;
		
		do
		{
			var varBegin = 0;
			var varDivot = 0;
			var initialAssignmentCount = 0;
			var hasInitializer = false;
			var name = null;
			var initializer = null;
			var node = null;
			
			varDeclCount++
			
			this.next();
			this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
			
			varBegin = this.tokenBegin;
			nameBegin = varBegin;
			name = this.tok.value;
			lastName = name;
			
			this.next();
			
			hasInitializer = this.match(jsc.Token.Kind.EQUAL);
			
			this.failWhenFalseInStrictMode(this.declareVariable(name), "Cannot declare a variable named '" + name + "' in strict mode.");
			
			context.addVariable(name, (hasInitializer || (!this.state.allowsIn && this.match(jsc.Token.Kind.IN))) ? jsc.AST.VariableFlags.HAS_INITIALIZER : jsc.AST.VariableFlags.NONE);
			
			if(hasInitializer)
			{
				initBegin = this.tokenBegin;
				varDivot = this.tokenBegin + 1;
				
				this.next();
				
				initialAssignmentCount = this.state.assignmentCount;
				initializer = this.parseAssignment(context);
				initEnd = this.lastTokenEnd;
				
				lastInitializer = initializer;
				
				this.failWhenNull(initializer);
				
				node = context.createAssignResolveExpression(name, initializer, initialAssignmentCount !== this.state.assignmentCount, varBegin, varDivot, this.lastTokenEnd);
				
				if(varDeclExpr === null)
					varDeclExpr = node;
				else
					varDeclExpr = context.combineCommaExpressions(varDeclExpr, node);
			}
		}
		while(this.match(jsc.Token.Kind.COMMA));

		return {
			expr: varDeclExpr,
			count: varDeclCount,
			lastName: lastName,
			lastInitializer: lastInitializer,
			nameBegin: nameBegin,
			initBegin: initBegin,
			initEnd: initEnd
		};
	},
	
	parseConstDeclaration: function(context) {
		var beginLine = this.tokenLine;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.CONST);
		
		expr = this.parseConstDeclarationList(context);

		this.failWhenError();
		this.failWhenFalse(this.insertSemicolon());

		return context.createConstStatement(expr, beginLine, this.state.lastLine);
	},
	
	parseConstDeclarationList: function(context) {
		this.failWhenTrue(this.inStrictMode);
		
		var decls = null;
		var next = null;
		
		do
		{
			var name = null;
			var hasInitializer = false;
			var initializer = null;
			
			this.next();
			this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
			
			name = this.tok.value;
			this.next();
			
			hasInitializer = this.match(jsc.Token.Kind.EQUAL);
			this.declareVariable(name);
			
			context.addVariable(name, jsc.AST.VariableFlags.CONSTANT | (hasInitializer ? jsc.AST.VariableFlags.HAS_INITIALIZER : jsc.AST.VariableFlags.NONE));
			
			if(hasInitializer)
			{
				this.next();
				initializer = this.parseAssignment(context);
			}
			
			next = context.createConstDeclarationExpression(name, initializer, next);
			
			if(decls === null)
				decls = next;
		}
		while(this.match(jsc.Token.Kind.COMMA));
		
		return decls;
	},
	
	parseIf: function(context) {
		var beginLine = this.tokenLine;
		var endLine = 0;
		var hasTrailingElse = false;
		var condition = null;
		var trueBlock = null;
		var falseBlock = null;
		
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
			return context.createIfStatement(condition, trueBlock, null, beginLine, endLine);
			
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
			
			statements.push(context.createIfStatement(expr, block, null, pos[0], pos[1]));
		}
		
		while(expressions.length)
		{
			expr = expressions.pop();
			falseBlock = statements.pop();
			trueBlock = statements.pop();
			pos = positions.pop();
			
			statements.push(context.createIfStatement(expr, trueBlock, falseBlock, pos[0], pos[1]));
		}
		
		return context.createIfStatement(condition, trueBlock, statements[statements.length-1], beginLine, endLine);
	},
	
	parseDoWhile: function(context) {
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
		
		this.consumeOrFail(jsc.Token.Kind.WHILE);
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);
		
		expr = this.parseExpression(context);
		
		this.failWhenNull(expr);
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		
		// skip semicolon, will always perform an automatic semicolon insertion
		if(this.match(jsc.Token.Kind.SEMICOLON))
			this.next();
			
		return context.createDoWhileStatement(expr, statement, beginLine, endLine);
	},
	
	parseWhile: function(context) {
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
			
		return context.createWhileStatement(expr, statement, beginLine, endLine);
	},
	
	parseFor: function(context) {
		var hasDecl = false;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var nonLHSCount = this.state.nonLHSCount;
		var declsBegin = 0;
		var declsEnd = 0;
		var exprEnd = 0;
		var decls = null;
		var expr = null;
		var statement = null;

		this.matchOrFail(jsc.Token.Kind.FOR);
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		if(this.match(jsc.Token.Kind.VAR))
		{
			/*
				for(var <ID> in <EXPRESSION>) <STATEMENT>
				for(var <ID> = <EXPRESSION> in <EXPRESSION>) <STATEMENT>
				for(var <VAR-DECL-LIST>; <EXPRESSION-opt>; <EXPRESSION-opt>)
			*/

			var initBegin = 0;
			var initEnd = 0;
			var inLocation = 0;
			var declListResult = null;
			
			this.state.allowsIn = false;
			
			hasDecl = true;

			declListResult = this.parseVarDeclarationList(context);
			decls = declListResult.expr;
			declsBegin = declListResult.nameBegin;

			this.state.allowsIn = true;
			this.failWhenError();

			if(this.match(jsc.Token.Kind.SEMICOLON))
				return this.parseForLoop(context, decls, hasDecl, beginLine);

			this.failWhenFalse(declListResult.count === 1);

			// handle for-in with var declaration
			inLocation = this.tokenBegin;

			this.consumeOrFail(jsc.Token.Kind.IN);

			expr = this.parseExpression(context);
			this.failWhenNull(expr);

			exprEnd = this.lastTokenEnd;
			endLine = this.tokenLine;
			
			this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
			
			this.currentScope.beginLoop();
			statement = this.parseStatement(context);
			this.currentScope.endLoop();
			
			this.failWhenNull(statement);

			return context.createForInStatementWithVarDecl(
				declListResult.lastName, declListResult.lastInitializer, expr, statement, declsBegin, inLocation, exprEnd, declListResult.initBegin, declListResult.initEnd, beginLine, endLine);
		}

		if(!this.match(jsc.Token.Kind.SEMICOLON))
		{
			this.state.allowsIn = false;
			
			declsBegin = this.tokenBegin;
			decls = this.parseExpression(context);
			declsEnd = this.lastTokenEnd;
			
			this.state.allowsIn = true;
			
			this.failWhenNull(decls);
		}

		// parse standard for loop
		if(this.match(jsc.Token.Kind.SEMICOLON))
			return this.parseForLoop(context, decls, hasDecl, beginLine);
		
		this.failWhenFalse(nonLHSCount === this.state.nonLHSCount);
		this.consumeOrFail(jsc.Token.Kind.IN);
		
		expr = this.parseExpression(context);
		this.failWhenNull(expr);

		exprEnd = this.lastTokenEnd;
		endLine = this.tokenLine;

		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();
		
		this.failWhenNull(statement);

		return context.createForInStatement(decls, expr, statement, declsBegin, declsEnd, exprEnd, beginLine, endLine);
	},
	
	parseForLoop: function(context, decls, hasDecl, beginLine) {
		/* for( <INITIALIZER>; <CONDITION>; <ITERATOR>; )
		 * for( <EXPRESSION-NO-IN-opt>; <EXPRESSION-opt>; <EXPRESSION-opt> ) */

		var statement = null;
		var condition = null;
		var increment = null;
		var endLine = 0;
		
		this.next();
		
		if(!this.match(jsc.Token.Kind.SEMICOLON))
		{
			condition = this.parseExpression(context);
			this.failWhenNull(condition);
		}

		this.consumeOrFail(jsc.Token.Kind.SEMICOLON);

		if(!this.match(jsc.Token.Kind.CLOSE_PAREN))
		{
			increment = this.parseExpression(context);
			this.failWhenNull(increment);
		}

		endLine = this.tokenLine;
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		this.currentScope.beginLoop();
		statement = this.parseStatement(context);
		this.currentScope.endLoop();
		
		this.failWhenNull(statement);

		return context.createForStatement(decls, condition, increment, statement, hasDecl, beginLine, endLine);
	},
	
	parseContinue: function(context) {
		var beginColumn = this.tokenBegin;
		var endColumn = this.tokenEnd;
		var beginLine = this.tokenLine;
		var endLine = this.tokenLine;
		var name = null;
		var label = null;
		
		this.matchOrFail(jsc.Token.Kind.CONTINUE);
		this.next();
		
		if(this.insertSemicolon())
		{
			this.failWhenFalse(this.canContinue, "The 'continue' keyword can only be used inside a loop statement.");
			return context.createContinueStatement(null, beginColumn, endColumn, beginLine, endLine);
		}
		
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		
		name = this.tok.value;
		label = this.findLabel(name);
		
		this.failWhenNull(label, "The label '" + name + "' is not defined");
		this.failWhenFalse(label.isLoop, "The 'continue' keyword can only be used inside a loop statement.");
		
		endColumn = this.tokenEnd;
		endLine = this.tokenLine;
		
		this.next();
		this.failWhenFalse(this.insertSemicolon);
		
		return context.createContinueStatement(name, beginColumn, endColumn, beginLine, endLine);
	},
	
	parseBreak: function(context) {
		var beginColumn = this.tokenBegin;
		var endColumn = this.tokenEnd;
		var beginLine = this.tokenLine;
		var endLine = this.tokenLine;
		var name = null;
		
		this.matchOrFail(jsc.Token.Kind.BREAK);
		this.next();
		
		if(this.insertSemicolon())
		{
			this.failWhenFalse(this.canBreak, "The 'break' keyword can only be used inside a switch or loop statement.");
			return context.createBreakStatement(null, beginColumn, endColumn, beginLine, endLine);
		}
		
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		name = this.tok.value;
		this.failWhenNull(this.findLabel(name), "The label '" + name + "' is not defined.");
		
		endColumn = this.tokenEnd;
		endLine = this.tokenLine;
		
		this.next();
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createBreakStatement(name, beginColumn, endColumn, beginLine, endLine);
	},
	
	parseReturn: function(context) {
		var scope = this.currentScope;
		var expr = null;
		var beginColumn = this.tokenBegin;
		var endColumn = this.tokenEnd;
		var beginLine = this.tokenLine;
		var endLine = this.tokenLine;
		
		this.matchOrFail(jsc.Token.Kind.RETURN);
		this.failWhenFalse(scope.isFunction);
		this.next();
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			endLine = this.tokenLine;
			
		if(this.insertSemicolon())
			return context.createReturnStatement(null, beginColumn, endColumn, beginLine, endLine);
			
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		endColumn = this.lastTokenEnd;
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			endLine = this.tokenLine;
			
		this.failWhenFalse(this.insertSemicolon());
		
		scope.doesFunctionReturn = true;
		return context.createReturnStatement(expr, beginColumn, endColumn, beginLine, endLine);
	},
	
	parseWith: function(context) {
		var beginColumn = 0;
		var endColumn = 0;
		var beginLine = 0;
		var endLine = 0;
		var expr = null;
		var statement = null;
		
		this.matchOrFail(jsc.Token.Kind.WITH);
		
		this.failWhenTrue(this.inStrictMode, "The 'with' keyword is not allowed while in strict mode.");

		this.currentScope.needsFullActivation = true;
		
		beginLine = this.tokenLine;
		
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		beginColumn = this.tokenBegin;
		expr = this.parseExpression(context);
		this.failWhenNull(expr);

		endColumn = this.lastTokenEnd;
		endLine = this.tokenLine;
		
		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		statement = this.parseStatement(context);
		this.failWhenNull(statement);

		return context.createWithStatement(expr, statement, beginColumn, endColumn, beginLine, endLine);
	},
	
	parseSwitch: function(context) {
		var beginLine = this.tokenLine;
		var endLine = 0;
		var expr = null;
		var firstClauses = null;
		var secondClauses = null;
		var defaultClause = null;

		this.matchOrFail(jsc.Token.Kind.SWITCH);		
		this.next();
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		expr = this.parseExpression(context);
		this.failWhenNull(expr);

		endLine = this.tokenLine;

		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACE);

		this.currentScope.beginSwitch();
		
		firstClauses = this.parseSwitchClauses(context);
		this.failWhenError();
		defaultClause = this.parseSwitchDefaultClause(context);
		this.failWhenError();
		secondClauses = this.parseSwitchClauses(context);
		this.failWhenError();
		
		this.currentScope.endSwitch();

		this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACE);

		return context.createSwitchStatement(expr, defaultClause, firstClauses, secondClauses, beginLine, endLine);
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
		this.failWhenNull(condition);
		
		this.consumeOrFail(jsc.Token.Kind.COLON);

		statements = this.parseStatements(context, false);
		this.failWhenNull(statements);

		clauses = context.createSwitchClauseList(condition, statements);
		next = clauses;

		while(this.match(jsc.Token.Kind.CASE))
		{
			this.next();

			condition = this.parseExpression(context);
			this.failWhenNull(condition);

			this.consumeOrFail(jsc.Token.Kind.COLON);

			statements = this.parseStatements(context, false);
			this.failWhenNull(statements);

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

		statements = this.parseStatements(context, false);
		this.failWhenNull(statements);

		return context.createSwitchClauseList(null, statements);
	},
	
	parseThrow: function(context) {
		var beginColumn = this.tokenBegin;
		var endColumn = 0;
		var beginLine = this.tokenLine;
		var endLine = 0;
		var expr = null;
		
		this.matchOrFail(jsc.Token.Kind.THROW);
		this.next();
		this.failWhenTrue(this.insertSemicolon());
		
		expr = this.parseExpression(context);
		this.failWhenNull(expr);
		
		endColumn = this.lastTokenEnd;
		endLine = this.tokenLine;
		
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createThrowStatement(expr, beginColumn, endColumn, beginLine, endLine);
	},
	
	parseTry: function(context) {
		var beginLine = this.tokenLine;
		var endLine = 0;
		var tryBlock = null;
		var catchBlock = null;
		var finallyBlock = null;
		var name = null;

		this.matchOrFail(jsc.Token.Kind.TRY);
		this.next();
		this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);

		tryBlock = this.parseBlock(context);
		this.failWhenNull(tryBlock);

		endLine = this.state.lastLine;

		if(this.match(jsc.Token.Kind.CATCH))
		{
			this.currentScope.needsFullActivation = true;
			
			this.next();
			this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

			this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
			name = this.tok.value;
			this.next();

			try
			{
				this.pushScope();
				this.failWhenFalseInStrictMode(this.declareVariable(name), "Cannot declare the variable '" + name + "' in strict mode.");
				
				this.currentScope.allowsNewDeclarations = false;
				this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

				this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);
				catchBlock = this.parseBlock(context);

				// FIXME: Need to test this, we don't currently know if there is a finally block, so this
				//        looks like it will fail if there is just no catch block.
				this.failWhenNull(catchBlock, "A 'try' must have a catch or finally block.");
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
			this.failWhenNull(finallyBlock);
		}

		this.failWhenFalse(catchBlock || finallyBlock, "A 'try' must have a catch and/or finally block.");

		return context.createTryStatement(name, tryBlock, catchBlock, finallyBlock, beginLine, endLine);
	},
	
	parseDebugger: function(context) {
		var begin = this.tokenLine;
		var end = begin;
		
		this.matchOrFail(jsc.Token.Kind.DEBUGGER);
		this.next();
		
		if(this.match(jsc.Token.Kind.SEMICOLON))
			begin = this.tokenLine;
			
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createDebuggerStatement(begin, end);
	},
	
	parseExpressionStatement: function(context) {
		var beginLine = this.tokenLine;
		var expr = this.parseExpression(context);
		
		this.failWhenNull(expr);
		this.failWhenFalse(this.insertSemicolon());
		
		return context.createExpressionStatement(expr, beginLine, this.state.lastLine);
	},
	
	parseExpression: function(context) {
		var lhs = null;
		var rhs = null;
		var commaExpr = null;

		lhs = this.parseAssignment(context);
		
		this.failWhenNull(lhs);

		if(!this.match(jsc.Token.Kind.COMMA))
			return lhs;
			
		this.next();
		
		this.state.nonTrivialExprCount++;
		this.state.nonLHSCount++;
		
		rhs = this.parseAssignment(context);
		this.failWhenNull(rhs);
		
		commaExpr = context.createCommaExpression(lhs, rhs);
		
		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();
			
			rhs = this.parseAssignment(context);
			this.failWhenNull(rhs);
			
			commaExpr.append(rhs);
		}
		
		return commaExpr;
	},
	
	parseExpressionOrLabel: function(context) {
		var labels = [];
		
		do {
			var beginLine = this.tokenLine;
			var beginColumn = this.tokenBegin;
			var endColumn = 0;
			var name = null;
			
			if(!this.lexer.isNextTokenColon)
			{
				var expr = this.parseExpression(context);
				
				this.failWhenNull(expr);
				this.failWhenFalse(this.insertSemicolon());
				
				return context.createExpressionStatement(expr, beginLine, this.state.lastLine);
			}
			
			name = this.tok.value;
			endColumn = this.tokenEnd;
			
			this.next();
			this.consumeOrFail(jsc.Token.Kind.COLON);
			
			if(!this.state.hasSyntaxBeenValidated)
			{
				for(var i = 0; i < labels.length; i++)
					this.failWhenTrue(name === labels[i].name);
					
				this.failWhenTrue(this.findLabel(name) !== null);
				labels.push(new jsc.AST.LabelInfo(name, beginColumn, endColumn));
			}
		} while(this.match(jsc.Token.Kind.IDENTIFIER));
		
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
		
		if(!this.state.hasSyntaxBeenValidated)
		{
			for(var i = 0; i < labels.length; i++)
				this.pushLabel(labels[i].name, isLoop);
		}
		
		statement = this.parseStatement(context);
		
		if(!this.state.hasSyntaxBeenValidated)
		{
			for(var i = 0; i < labels.length; i++)
				this.popLabel();
		}
		
		this.failWhenNull(statement);
		
		for(var i = 0; i < labels.length; i++)
		{
			var info = labels[labels.length - i - 1];
			statement = context.createLabelStatement(info, statement);
		}
		
		return statement;
	},
	
	parseAssignment: function(context) {
		var beginColumn = this.tokenBegin;
		var initialAssignmentCount = this.state.assignmentCount;
		var initialNonLHSCount = this.state.nonLHSCount;
		var assignmentDepth = 0;
		var hasAssignment = false;
		var op = null;
		var lhs = this.parseConditional(context);
		
		this.failWhenNull(lhs);
		
		if(initialNonLHSCount !== this.state.nonLHSCount)
			return lhs;
		
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
			hasAssignment = true;
			
			assignmentDepth++;
			context.appendAssignment(lhs, beginColumn, this.tokenBegin, this.state.assignmentCount, op);
			
			beginColumn = this.tokenBegin;
			
			this.state.assignmentCount++;
			this.next();
			
			if(this.inStrictMode && this.state.lastIdentifier !== null && lhs.kind === jsc.AST.NodeKind.RESOLVE)
			{
				this.failWhenTrueInStrictMode(this.state.lastIdentifier === jsc.Parser.KnownIdentifiers.Eval, "'eval' cannot be modified in strict mode.");
				this.failWhenTrueInStrictMode(this.state.lastIdentifier === jsc.Parser.KnownIdentifiers.Arguments, "'arguments' cannot be modified in strict mode.");
				
				this.declareWrite(this.state.lastIdentifier);
				this.state.lastIdentifier = null;
			}
			
			lhs = this.parseConditional(context);
			this.failWhenNull(lhs);
			
			if(initialNonLHSCount !== this.state.nonLHSCount)
				break;
		}
		
		if(hasAssignment)
			this.state.nonLHSCount++;
			
		while(assignmentDepth > 0)
		{
			lhs = context.createAssignmentExpression(lhs, initialAssignmentCount, this.state.assignmentCount, this.lastTokenEnd);
			assignmentDepth--;
		}
			
		return lhs;
	},
	
	parseConditional: function(context) {
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
		
		return context.createConditionalExpression(cond, lhs, rhs);
	},
	
	parseBinary: function(context) {
		var operationState = {
			operandDepth: 0,
			operatorDepth: 0
		};
		
		while(true)
		{
			var beginColumn = this.tokenBegin;
			var initialAssignmentCount = this.state.assignmentCount;
			var precedence = 0;
			var operatorToken = jsc.Token.Kind.UNKNOWN;
			var currentExpr = this.parseUnary(context);

			this.failWhenNull(currentExpr);
			
			context.pushBinaryOperand(operationState, currentExpr, beginColumn, this.lastTokenEnd, this.lastTokenEnd, initialAssignmentCount !== this.state.assignmentCount);
			
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
		var tokenStackDepth = 0;
		var beginColumn = 0;
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
						this.failWhenTrue(requiresLExpression);
						modifiesExpression = true;
						requiresLExpression = true;
						break;
					case jsc.Token.Kind.DELETE:
						this.failWhenTrue(requiresLExpression);
						requiresLExpression = true;
						break;
					default:
						this.failWhenTrue(requiresLExpression)
				}
			}
			
			tokenStackDepth++;
			context.pushUnaryToken(this.tok.kind, this.tokenBegin);
			
			this.state.nonLHSCount++;
			this.state.nonTrivialExprCount++;
			
			this.next();
		}
		
		beginColumn = this.tokenBegin;
		expr = this.parseMember(context);

		this.failWhenNull(expr);
		
		if(this.inStrictMode && !this.state.hasSyntaxBeenValidated)
		{
			if(expr.kind === jsc.AST.NodeKind.RESOLVE)
				isEvalOrArguments = (this.state.lastIdentifier === jsc.Parser.KnownIdentifiers.Eval || this.state.lastIdentifier === jsc.Parser.KnownIdentifiers.Arguments);
		}
		
		this.failWhenTrueInStrictMode(isEvalOrArguments && modifiesExpression, "'" + this.state.lastIdentifier + "' cannot be modified in strict mode.");
		
		switch(this.tok.kind)
		{
			case jsc.Token.Kind.PLUSPLUS:
			case jsc.Token.Kind.MINUSMINUS:
				this.state.nonLHSCount++;
				this.state.nonTrivialExprCount++;
				
				expr = context.createPostfixExpression(expr, (this.tok.kind === jsc.Token.Kind.PLUSPLUS ? jsc.AST.AssignmentOperatorKind.PLUS_PLUS : jsc.AST.AssignmentOperatorKind.MINUS_MINUS), beginColumn, this.lastTokenEnd, this.tokenEnd);
				
				this.state.assignmentCount++;
				
				this.failWhenTrueInStrictMode(isEvalOrArguments, "'" + this.state.lastIdentifier + "' cannot be modified in strict mode.");
				this.failWhenTrueInStrictMode(requiresLExpression);

				this.next();
				break;
			default:
				break;
		}
		
		endColumn = this.lastTokenEnd;

		while(tokenStackDepth > 0)
		{
			switch(context.lastUnaryTokenKind)
			{
				case jsc.Token.Kind.EXCLAMATION:
					expr = context.createLogicalNotExpression(expr);
					break;
				case jsc.Token.Kind.TILDE:
					expr = context.createBitwiseNotExpression(expr);
					break;
				case jsc.Token.Kind.MINUS:
					expr = context.createNegateExpression(expr);
					break;
				case jsc.Token.Kind.PLUS:
					expr = context.createUnaryPlusExpression(expr);
					break;
				case jsc.Token.Kind.PLUSPLUS:
				case jsc.Token.Kind.PLUSPLUS_AUTO:
					expr = context.createPrefixExpression(expr, jsc.AST.AssignmentOperatorKind.PLUS_PLUS, context.lastUnaryTokenBegin, beginColumn + 1, endColumn);
					this.state.assignmentCount++;
					break;
				case jsc.Token.Kind.MINUSMINUS:
				case jsc.Token.Kind.MINUSMINUS_AUTO:
					expr = context.createPrefixExpression(expr, jsc.AST.AssignmentOperatorKind.MINUS_MINUS, context.lastUnaryTokenBegin, beginColumn + 1, endColumn);
					this.state.assignmentCount++;
					break;
				case jsc.Token.Kind.TYPEOF:
					expr = context.createTypeOfExpression(expr);
					break;
				case jsc.Token.Kind.VOID:
					expr = context.createVoidExpression(expr);
					break;
				case jsc.Token.Kind.DELETE:
					this.failWhenTrueInStrictMode((expr.kind === jsc.Token.Kind.RESOLVE), "Cannot delete unqualified property '" + this.state.lastIdentifier + "' in strict mode");
					expr = context.createDeleteExpression(expr, context.lastUnaryTokenBegin, endColumn, endColumn);
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
		var baseExpr = null;
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
		
		if(this.match(jsc.Token.Kind.FUNCTION))
		{	
			var props = null;
			
			this.next();
			
			props = this.parseFunction(context, false);
			this.failWhenNull(props);
			
			baseExpr = context.createFunctionExpression(props.name, props.node, props.parameters, props.openBracePos, props.closeBracePos, props.bodyBeginLine, this.state.lastLine);
		}
		else
		{
			baseExpr = this.parsePrimary(context);
		}
		
		this.failWhenNull(baseExpr);
		
		loop:
		while(true)
		{
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
					
					baseExpr = context.createBracketAccessorExpression(baseExpr, expr, initialAssignmentCount != this.state.assignmentCount, beginColumn, endColumn, this.tokenEnd);
					
					this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACKET);
					this.state.nonLHSCount = nonLHSCount;
					break;
				}
				case jsc.Token.Kind.OPEN_PAREN:
				{
					nonLHSCount = this.state.nonLHSCount;
					this.state.nonTrivialExprCount++;
					
					if(newCount > 0)
					{
						newCount--;
						endColumn = this.lastTokenEnd;
						
						expr = this.parseArguments(context);
						this.failWhenNull(expr);
						
						baseExpr = context.createNewExpressionWithArguments(baseExpr, expr, beginColumn, endColumn, this.lastTokenEnd);
					}
					else
					{
						endColumn = this.lastTokenEnd;
						expr = this.parseArguments(context);
						this.failWhenNull(expr);
						
						baseExpr = context.createFunctionCallExpression(baseExpr, expr, beginColumn, endColumn, this.lastTokenEnd);
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
					
					baseExpr = context.createDotAccessorExpression(baseExpr, this.tok.value, beginColumn, endColumn, this.tokenEnd);
					
					this.next();
					break;
				}
				default:
					break loop;
			}
		}
		
		while(newCount-- > 0)
			baseExpr = context.createNewExpression(baseExpr, beginColumn, this.lastTokenEnd);
			
		return baseExpr;
	},
	
	parsePrimary: function(context) {
		switch(this.tok.kind)
		{
			case jsc.Token.Kind.OPEN_BRACE:
			{
				if(this.inStrictMode)
					return this.parseObjectLiteralStrict(context);
					
				return this.parseObjectLiteral(context);
			}
			case jsc.Token.Kind.OPEN_BRACKET:
				return this.parseArrayLiteral(context);
			case jsc.Token.Kind.OPEN_PAREN:
			{
				var nonLHSCount = this.state.nonLHSCount;
				var expr = null;
				
				this.next();
				
				expr = this.parseExpression(context);
				
				this.state.nonLHSCount = nonLHSCount;
				this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
				
				return expr;
			}
			case jsc.Token.Kind.THIS:
			{
				this.next();
				return context.createThisExpression();
			}
			case jsc.Token.Kind.IDENTIFIER:
			{
				var beginColumn = this.tokenBegin;
				var name = this.tok.value;
				
				this.next();
				
				this.currentScope.useVariable(name, name === jsc.Parser.KnownIdentifiers.Eval);
				this.state.lastIdentifier = name;
				
				return context.createResolveExpression(name, beginColumn);
			}
			case jsc.Token.Kind.STRING:
			{
				var value = this.tok.value;
				
				this.next();
				
				return context.createStringExpression(value);
			}
			case jsc.Token.Kind.NUMBER:
			{
				var value = this.tok.value;
				
				this.next();
				
				return context.createNumberExpression(value);
			}
			case jsc.Token.Kind.NULL:
			{
				this.next();
				return context.createNullExpression();
			}
			case jsc.Token.Kind.TRUE:
			case jsc.Token.Kind.FALSE:
			{
				this.next();
				return context.createBooleanExpression(this.tok.kind === jsc.Token.Kind.TRUE);
			}
			case jsc.Token.Kind.DIVIDE_EQUAL:
			case jsc.Token.Kind.DIVIDE:
			{
				// regular expression
				var patternPrefix = (this.match(jsc.Token.Kind.DIVIDE_EQUAL) ? '=' : null);
				var props = this.lexer.scanRegEx(patternPrefix);
				var beginColumn = this.tokenBegin;
				var expr = null;
				
				this.failWhenNull(props);
				this.next();
				
				expr = context.createRegExpExpression(props.pattern, props.flags, beginColumn);
				
				// TODO: check the syntax of the pattern
				
				if(jsc.Utils.isNull(expr))
					this.throwUnreachableError();
				
				return expr;
			}
			default:
				this.fail();
				break;
		}

		return null;
	},
	
	parseFunctionDeclaration: function(context) {
		var parseFunctionResult = null;
		
		this.matchOrFail(jsc.Token.Kind.FUNCTION);
		this.next();

		parseFunctionResult = this.parseFunction(context, true);
		
		this.failWhenNull(parseFunctionResult);
		this.failWhenNull(parseFunctionResult.name);
		this.failWhenFalseInStrictMode(this.declareVariable(parseFunctionResult.name));

		return context.createFunctionDeclarationStatement(
			parseFunctionResult.name, 
			parseFunctionResult.node, 
			parseFunctionResult.parameters, 
			parseFunctionResult.openBracePos, 
			parseFunctionResult.closeBracePos, 
			parseFunctionResult.bodyBeginLine, 
			this.state.lastLine);
	},
	
	parseFunction: function(context, needsName) {
		var name = null;
		var node = null;
		var parameters = null;
		var openBracePosition = 0;
		var closeBracePosition = 0;
		var bodyBeginLine = 0;
		
		try
		{
			this.pushScope();
			this.currentScope.enterFunction();

			if(this.match(jsc.Token.Kind.IDENTIFIER))
			{
				name = this.tok.value;
				this.next();

				if(!needsName)
					this.failWhenFalseInStrictMode(this.currentScope.declareVariable(name));
			}
			else
			{
				if(needsName)
					return null;
			}

			this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

			if(!this.match(jsc.Token.Kind.CLOSE_PAREN))
			{
				parameters = this.parseParameters(context);
				this.failWhenNull(parameters);
			}

			this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);
			this.matchOrFail(jsc.Token.Kind.OPEN_BRACE);

			openBracePosition = this.tok.value;
			bodyBeginLine = this.tokenLine;

			this.next();

			node = this.parseFunctionBody(context);
			this.failWhenNull(node);

			if(this.inStrictMode && name !== null)
			{
				this.failWhenTrue(jsc.Parser.KnownIdentifiers.Arguments === name, "Function name '" + name + "' is not valid in strict mode.");
				this.failWhenTrue(jsc.Parser.KnownIdentifiers.Eval === name, "Function name '" + name + "' is not valid in strict mode.");
			}

			closeBracePosition = this.tok.value;
		}
		finally
		{
			this.popScope(true);
		}
		
		this.matchOrFail(jsc.Token.Kind.CLOSE_BRACE);
		this.next();

		return {
			name: name,
			node: node,
			parameters: parameters,
			openBracePos: openBracePosition,
			closeBracePos: closeBracePosition,
			bodyBeginLine: bodyBeginLine
		};
	},
	
	parseFunctionBody: function(context) {
		if(this.match(jsc.Token.Kind.CLOSE_BRACE))
			return context.createInitialFunctionStatement(this.inStrictMode);

		var functionContext = new jsc.AST.Context(this.sourceCode, this.lexer);
		var lastStatementDepth = this.state.statementDepth;

		this.state.statementDepth = 0;

		var bodyBeginLine = this.state.lastLine;
		var openBracePosition = this.lastTokenBegin;
		var statements = this.parseStatements(functionContext, true);
		var closeBracePosition = this.tokenBegin;
		var features = functionContext.features;
		var constants = functionContext.constantCount;
		var capturedVariables = this.currentScope.capturedVariables;

		if(this.currentScope.strictMode)
			features |= jsc.AST.CodeFeatureFlags.STRICT_MODE;
		
		if(this.currentScope.shadowsArguments)
			features |= jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS;

		var functionStatement = context.createFunctionStatement(
				statements, functionContext.variableDecls, functionContext.functions, capturedVariables, features, constants, openBracePosition, closeBracePosition, bodyBeginLine, this.currentScope.doesFunctionReturn);

		this.state.statementDepth = lastStatementDepth;

		return functionStatement;
	},
	
	parseParameters: function(context) {
		this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
		this.failWhenFalseInStrictMode(this.declareParameter(this.tok.value), "Cannot declare a parameter named '" + this.tok.value + "' in strict mode.");

		var parameters = context.createParameterList(this.tok.value);
		var next = parameters;

		this.next();

		while(this.match(jsc.Token.Kind.COMMA))
		{
			var name = null;

			this.next();
			this.matchOrFail(jsc.Token.Kind.IDENTIFIER);
			
			name = this.tok.value;
			this.failWhenFalseInStrictMode(this.declareParameter(name), "Cannot declare a parameter named '" + name + "' in strict mode.");

			this.next();
			next = context.createParameterList(name, next);
		}

		return parameters;
	},
	
	parseArguments: function(context) {
		this.consumeOrFail(jsc.Token.Kind.OPEN_PAREN);

		if(this.match(jsc.Token.Kind.CLOSE_PAREN))
		{
			this.next();
			return context.createArgumentsList();
		}

		var argument = this.parseAssignment(context);
		this.failWhenNull(argument);

		var arguments = context.createArgumentsList(null, argument);
		var next = arguments;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();

			argument = this.parseAssignment(context);
			this.failWhenNull(argument);

			next = context.createArgumentsList(next, argument);
		}

		this.consumeOrFail(jsc.Token.Kind.CLOSE_PAREN);

		return arguments;
	},
	
	parseObjectLiteral: function(context) {
		var beginOffset = this.tok.value;
		var nonLHSCount = 0;
		var lastLastLineNumber = this.lexer.lastLineNumber;
		var lastLineNumber = this.lexer.lineNumber;

		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACE);

		nonLHSCount = this.state.nonLHSCount;

		if(this.match(jsc.Token.Kind.CLOSE_BRACE))
		{
			this.next();
			return context.createObjectLiteralExpression();
		}

		var prop = this.parseProperty(context, false);
		this.failWhenNull(prop);

		if(!this.state.hasSyntaxBeenValidated && prop.flags !== jsc.AST.PropertyKindFlags.CONSTANT)
		{
			this.lexer.position = beginOffset;
			this.next();
			this.lexer.lastLineNumber = lastLastLineNumber;
			this.lexer.lineNumber = lastLineNumber;

			return this.parseObjectLiteralStrict(context);
		}

		var properties = context.createPropertyList(prop);
		var next = properties;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
				break;

			prop = this.parseProperty(context, false);
			this.failWhenNull(prop);

			if(!this.state.hasSyntaxBeenValidated && prop.flags !== jsc.AST.PropertyKindFlags.CONSTANT)
			{
				this.lexer.position = beginOffset;
				this.next();
				this.lexer.lastLineNumber = lastLastLineNumber;
				this.lexer.lineNumber = lastLineNumber;
				
				return this.parseObjectLiteralStrict(context);
			}

			next = context.createPropertyList(prop, next);
		}

		this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACE);
		this.state.nonLHSCount = nonLHSCount;

		return context.createObjectLiteralExpression(properties);
	},
	
	parseObjectLiteralStrict: function(context) {
		var nonLHSCount = this.state.nonLHSCount;
		
		this.consumeOrFail(jsc.Token.Kind.OPEN_BRACE);

		if(this.match(jsc.Token.Kind.CLOSE_BRACE))
		{
			this.next();
			return context.createObjectLiteralExpression();
		}
		
		var prop = this.parseProperty(context, true);
		this.failWhenNull(prop);

		var propDict = {};

		if(!this.state.hasSyntaxBeenValidated)
			propDict[prop.name] = prop;

		var properties = context.createPropertyList(prop);
		var next = properties;

		while(this.match(jsc.Token.Kind.COMMA))
		{
			this.next();

			if(this.match(jsc.Token.Kind.CLOSE_BRACE))
				break;

			prop = this.parseProperty(context, true);
			this.failWhenNull(prop);

			if(!this.state.hasSyntaxBeenValidated)
			{
				if(!propDict.hasOwnProperty(prop.name))
					propDict[prop.name] = prop;
				else
				{
					var propEntry = propDict[prop.name];
					
					this.failWhenTrue(propEntry.isConstant);
					this.failWhenTrue(prop.isConstant);
					this.failWhenTrue((prop.flags & propEntry) !== jsc.AST.PropertyKindFlags.UNKNOWN);
					
					propEntry.flags |= prop.flags;
				}
			}

			next = context.createPropertyList(prop, next);
		}

		this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACE);
		this.state.nonLHSCount = nonLHSCount;

		return context.createObjectLiteralExpression(properties);
	},
	
	parseProperty: function(context, asStrict) {
		var wasIdentifier = false;
		var node = null;
		var id = null;
		var propertyName = null;

		while(true)
		{
			switch(this.tok.kind)
			{
				case jsc.Token.Kind.IDENTIFIER:
					wasIdentifier = true;
				case jsc.Token.Kind.STRING:
				{
					id = this.tok.value;
					this.nextIdentifier();
					
					if(this.match(jsc.Token.Kind.COLON))
					{
						this.next();

						node = this.parseAssignment(context);
						this.failWhenNull(node);

						return context.createProperty(id, node, jsc.AST.PropertyKindFlags.CONSTANT);
					}

					this.failWhenFalse(wasIdentifier);
					
					var type = jsc.AST.PropertyKindFlags.UNKNOWN;
					var parseFunctionResult = null;

					if(id === "get")
						type = jsc.AST.PropertyKindFlags.GETTER;
					else if(id === "set")
						type = jsc.AST.PropertyKindFlags.SETTER;
					else
						this.fail();

					if(this.tok.kind == jsc.Token.Kind.IDENTIFIER || this.tok.kind == jsc.Token.Kind.STRING || this.tok.kind == jsc.Token.Kind.NUMBER)
						propertyName = this.tok.value;
					else
						this.fail();

					this.next();
					
					parseFunctionResult = this.parseFunction(context, false);
					this.failWhenFalse(parseFunctionResult);

					return context.createGetterOrSetterProperty(
						type, propertyName, parseFunctionResult.parameters, parseFunctionResult.node, parseFunctionResult.openBracePos, parseFunctionResult.closeBracePos, parseFunctionResult.bodyBeginLine, this.state.lastLine);
				}
				case jsc.Token.Kind.NUMBER:
				{
					propertyName = this.tok.value;

					this.next();
					this.consumeOrFail(jsc.Token.Kind.COLON);
					
					node = this.parseAssignment(context);
					this.failWhenNull(node);

					return context.createProperty(propertyName, node, jsc.AST.PropertyKindFlags.CONSTANT);
				}
				default:
					this.failWhenFalse(this.tok.kind & jsc.Token.KEYWORD);
					break;
			}
		}

		return null;
	},
	
	parseArrayLiteral: function(context) {
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
			return context.createArrayExpression(null, elisions);
		}

		elem = this.parseAssignment(context);
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
				return context.createArrayExpression(elements, elisions);
			}

			elem = this.parseAssignment(context);
			this.failWhenNull(elem);
			
			next = context.createArrayElementList(elem, elisions, next);
		}

		this.consumeOrFail(jsc.Token.Kind.CLOSE_BRACKET);
		this.state.nonLHSCount = nonLHSCount;

		return context.createArrayExpression(elements);
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
	
	isUnaryOp: function(tokenKind) {
		return ((tokenKind & jsc.Token.UNARY) !== 0);
	},
	
	getBinaryOperatorPrecedence: function(tokenKind) {

		if(this.state.allowsIn)
			return (tokenKind & (jsc.Token.PRECEDENCE_MASK << jsc.Token.IN_PRECEDENCE));

		return (tokenKind & jsc.Token.PRECEDENCE_MASK);
	},
	
	next: function() {
		this.state.lastLine = this.tokenLine;
		this.state.lastTokenBegin = this.tokenBegin;
		this.state.lastTokenEnd = this.tokenEnd;
		
		this.lexer.lastLineNumber = this.state.lastLine;
		this.tok.kind = this.lexer.nextToken(this.tok, this.inStrictMode);
	},
	
	nextIdentifier: function() {
		this.state.lastLine = this.tokenLine;
		this.state.lastTokenBegin = this.tokenBegin;
		this.state.lastTokenEnd = this.tokenEnd;
		
		this.lexer.lastLineNumber = this.state.lastLine;
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
			this.throwOnError("Unable to leave the current scope.");

		this.scopeStack[this.scopeStack.length-2].collectFreeVariables(this.currentScope, shouldTrackClosedVariables);
		this.scopeStack.pop();
	},
	
	declareVariable: function(name) {
		var i = this.scopeStack.length-1;
		
		while(!this.scopeStack[i].allowsNewDeclarations) { i--; }
		
		return this.scopeStack[i].declareVariable(name);
	},
	
	declareParameter: function(name) {
		this.currentScope.declareParameter(name);
	},
	
	declareWrite: function(name) {
		if(!this.state.hasSyntaxBeenValidated)
			this.currentScope.declareWrite(name);
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
	
	fail: function(tokKindOrMessage) {
		if(!this.hasError)
			this.setError(tokKindOrMessage, true);
	},
	
	failWhenError: function() {
		this.failWhenTrue(this.hasError, true);
	},
	
	failWhenNull: function(obj, message) {
		if(jsc.Utils.isNull(obj))
			this.fail(message, true);
	},
	
	failWhenFalse: function(value, message) {
		if(!value)
			this.fail(message, true);
	},
	
	failWhenTrue: function(value, message) {
		if(value)
			this.fail(message, true);
	},
	
	failWhenFalseInStrictMode: function(value, message) {
		if(!value && this.inStrictMode)
			this.fail(message, true);
	},
	
	failWhenTrueInStrictMode: function(value, message) {
		if(value && this.inStrictMode)
			this.fail(message, true);
	},

	getErrorMessageForExpectedToken: function(tokenKind) {
		switch(tokenKind)
		{
			case jsc.Token.Kind.RESERVED_STRICT:
				return jsc.Utils.format("The keyword '%s' is reserved and cannot be used in strict mode.", this.tokenString);
			case jsc.Token.Kind.RESERVED:
				return jsc.Utils.format("The keyword '%s' is reserved and cannot be used.", this.tokenString);
			case jsc.Token.Kind.NUMBER:
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
		
		var line = this.state.lastLine;
		var column = this.state.lastTokenBegin - this.lexer.lastLinePosition - 1;
		var filename = this.sourceCode.url;
		var lineColumnString = line + ":" + column;

		msg += " \n\tin " + filename + ":[" + lineColumnString + "]";

		this.setErrorImpl(msg, throwError, "Parse Error (" + lineColumnString + ")");
	},

	setErrorImpl: function(message, throwError, errorName) {
		this.state.error = message;
		
		if(throwError)
		{
			var err = new Error(this.error);

			if(errorName)
				err.name = errorName;
			
			throw err;
		}
	},

	clearError: function() {
		this.state.error = null;
	},
	
	throwUnreachableError: function() {
		this.throwOnError("UNREACHABLE CODE SHOULD NOT HAVE BEEN REACHED");
	},

	throwOnError: function(message) {
		// set and throw an immediate error when there is a message, otherwise
		// throw only when an error already exists
		if(!jsc.Utils.isStringNullOrEmpty(message))
			this.setErrorImpl(message, false);

		// only throw when an error exists
		if(this.hasError)
			throw new Error(this.error);
	},

	debugLog: function(msg /*, ... */) {
		if(this.debugMode)
			console.log(jsc.Utils.format.apply(null, arguments));
	}
});

Object.extend(jsc.Parser, {
	Mode: {
		PROGRAM		: 1,
		FUNCTIONS	: 2
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
		this.declaredVariables = new jsc.Utils.HashMap();
		this.usedVariables = new jsc.Utils.HashMap();
		this.closedVariables = new jsc.Utils.HashMap();
		this.writtenVariables = new jsc.Utils.HashMap();
		this.shadowsArguments = false;
		this.usesEval = false;
		this.needsFullActivation = false;
		this.allowsNewDeclarations = true;
		this.strictMode = inStrictMode;
		this.isFunction = isFunction;
		this.isFunctionBoundary = false;
		this.doesFunctionReturn = false;
		this.isStrictModeValid = true;
		this.loopDepth = 0;
		this.switchDepth = 0;
	},

	get isInLoop() {
		return (this.loopDepth > 0);
	},

	get canBreak() {
		return (this.loopDepth > 0 || this.switchDepth > 0);
	},

	get canContinue() {
		return (this.loopDepth > 0);
	},
	
	get capturedVariables() {		
		if(this.needsFullActivation || this.usesEval)
			return this.declaredVariables.keys;
			
		var keys = this.closedVariables.keys;
		var vars = [];
		
		for(var k in keys)
		{
			if(!this.declaredVariables.exists(k))
				continue;
				
			vars.push(k);
		}

		return vars;
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
	
	declareVariable: function(name) {
		var isValidStrictMode = (name !== jsc.Parser.KnownIdentifiers.Eval && name !== jsc.Parser.KnownIdentifiers.Arguments);
		
		this.isStrictModeValid = this.isStrictModeValid && isValidStrictMode;
		this.declaredVariables.set(name);
		
		return isValidStrictMode;
	},
	
	declareParameter: function(name) {
		var isArguments = (name === jsc.Parser.KnownIdentifiers.Arguments);
		var isValidStrictMode = (this.declaredVariables.set(name) && name !== jsc.Parser.KnownIdentifiers.Eval && !isArguments);
		
		this.isStrictModeValid = this.isStrictModeValid && isValidStrictMode;
		
		if(isArguments)
			this.shadowsArguments = true;
			
		return isValidStrictMode;
	},
	
	declareWrite: function(name) {
		this.writtenVariables.set(name);
	},
	
	useVariable: function(name, isEval) {
		this.usesEval |= isEval;
		this.usedVariables.set(name);
	},
	
	collectFreeVariables: function(nestedScope, shouldTrackClosedVariables) {
		if(nestedScope.usesEval)
			this.usesEval = true;
			
		var keys = nestedScope.usedVariables.keys;
			
		for(var k in keys)
		{			
			if(nestedScope.declaredVariables.exists(k))
				continue;
				
			this.usedVariables.set(k);
			
			if(shouldTrackClosedVariables)
				this.closedVariables.set(k);
		}
		
		if(nestedScope.writtenVariables.length)
		{
			keys = nestedScope.writtenVariables.keys;
			
			for(var k in keys)
			{				
				if(nestedScope.declaredVariables.exists(k))
					continue;

				this.writtenVariables.set(k);
			}
		}
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
	This: "this",
	Arguments: "arguments",
	Eval: "eval"
};


module.exports = {
	Parser: jsc.Parser,
	ParserScope: jsc.ParserScope
};