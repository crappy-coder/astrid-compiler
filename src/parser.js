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
		return !jsc.Utils.isNull(this.error);
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

		var errorLine = -1;
		var errorMessage = "";

		if(asFunction)
			this.lexer.isReparsing = true;

		this.statements = null;

		errorMessage = this.parseImpl();

		var lexLine = this.lexer.lineNumber;
		var lexError = this.lexer.error;

		this.lexer.clear();

		if(!jsc.Utils.isStringNullOrEmpty(errorMessage) || lexError)
		{
			errorLine = lexLine;
			errorMessage = lexError ? lexError : errorMessage;

			this.statements = null;
		}

		if(!this.statements)
			return null;

		var program = new jsc.AST.ScriptNode(this.sourceCode, this.lexer.lastLineNumber);
		
		program.startLine = this.sourceCode.startLine;
		program.endLine = this.state.lastLine;
		program.constantCount = this.state.constantCount;
		program.features = this.features;
		program.statements = this.statements;
		program.functions = this.functions;
		program.variables = this.variableDecls;
		program.capturedVariables = this.capturedVariables;

		return program;
	},

	parseImpl: function() {
		var lastError = null;
		var context = new jsc.AST.Context(this.sourceCode, this.lexer);
		var scope = this.currentScope;
		
		if(this.lexer.isReparsing)
			this.state.statementDepth--;
			
		this.statements = this.parseStatements(context, true);
		
		
	},
	
	parseStatements: function(context, checkForStrictMode) {
		var result = [];
		// TODO
		return result;
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
	
	fail: function(tokKindOrMessage) {
		if(!this.hasError)
			this.setError(tokKindOrMessage);
	},
	
	failIfError: function() {
		this.failIfTrue(this.hasError);
	},
	
	failIfNull: function(obj, message) {
		if(jsc.Utils.isNull(obj))
			this.fail(message);
	},
	
	failIfFalse: function(value, message) {
		if(!value)
			this.fail(message);
	},
	
	failIfTrue: function(value, message) {
		if(value)
			this.fail(message);
	},
	
	failIfFalseInStrictMode: function(value, message) {
		if(!value && this.inStrictMode)
			this.fail(message);
	},
	
	failIfTrueInStrictMode: function(value, message) {
		if(value && this.inStrictMode)
			this.fail(message);
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

	setError: function(tokKindOrMessage) {
		var msg = null;

		if(jsc.Utils.isNull(tokKindOrMessage))
		{
			msg = jsc.Token.getName(this.tok.kind);
			msg = (!jsc.Utils.isStringNullOrEmpty(msg) ? "Unexpected token: " + msg : this.getErrorMessageForExpectedToken(this.tok.kind));
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

		this.setErrorImpl(msg);
	},

	setErrorImpl: function(message) {
		this.state.error = message;
	},

	clearError: function() {
		this.state.error = null;
	},

	throwOnError: function(message) {
		// set and throw an immediate error when there is a message, otherwise
		// throw only when an error already exists
		if(!jsc.Utils.isStringNullOrEmpty(message))
			this.setErrorImpl(message);

		// only throw when an error exists
		if(!jsc.Utils.isStringNullOrEmpty(this.state.error))
			throw new Error(this.state.error);
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
		this.declaredVariables = null;
		this.usedVariables = null;
		this.closedVariables = null;
		this.writtenVariables = null;
		this.shadowsArguments = false;
		this.usesEval = false;
		this.needsFullActivation = false;
		this.allowsNewDeclarations = true;
		this.strictMode = inStrictMode;
		this.isFunction = isFunction;
		this.isFunctionBoundary = false;
		this.doesFunctionReturn = false;
		this.hasValidStrictMode = true;
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

	pushLabel: function(label, isLoop) {
		this.labels.push({
			id: label,
			isLoop: isLoop
		});
	},

	popLabel: function() {
		if(!this.labels.length)
			throw new Error("Cannot pop label. There are no labels on the stack.");

		this.labels.pop();
	},

	findLabel: function(label) {
		if(!this.labels.length)
			return null;

		for(var i = this.labels.length; i > 0; i--)
		{
			if(this.labels[i-1].id === label)
				return this.labels[i-1];
		}

		return null;
	},
	
	declareVariable: function(name) {
		var isValidStrictMode = (name !== jsc.Parser.KnownIdentifiers.Eval && name !== jsc.Parser.KnownIdentifiers.Arguments);
		
		this.hasValidStrictMode = this.hasValidStrictMode && isValidStrictMode;
		this.declaredVariables.set(name);
		
		return isValidStrictMode;
	},
	
	declareParameter: function(name) {
		var isArguments = (name === jsc.Parser.KnownIdentifiers.Arguments);
		var isValidStrictMode = (this.declaredVariables.set(name) && name !== jsc.Parser.KnownIdentifiers.Eval && !isArguments);
		
		this.hasValidStrictMode = this.hasValidStrictMode && isValidStrictMode;
		
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
		// TODO
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