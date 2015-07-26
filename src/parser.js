var ast = require("./ast");
var token = require("./token");
var utils = require("./utils");
var source = require("./source-code");
var text = require("./text");
var lex = require("./lexer");
var jsc = jsc || {};

/*
	Parser parser(globalContext, sourceCode, parameters, Parser::ParserStrictnessNormal, Parser::ParserModeProgram);
	ProgramNode* program = parser.Parse<ProgramNode>();
*/

jsc.Parser = function(sourceCode, parameters, inStrictMode, parserMode) {
	if(utils.isNull(sourceCode))
		throw new Error("The sourceCode argument must not be null.");
		
	this.state = {
		mode: utils.valueOrDefault(parserMode, jsc.Parser.Mode.PROGRAM),
		inStrictMode: inStrictMode,
		lastIdentifier: null,
		lastLine: 0,
		lastTokenBegin: 0,
		lastTokenEnd: 0,
		assignmentCount: 0,
		constantCount: 0,
		nonLHSCount: 0,
		nonTrivialExprCount: 0,
		statementDepth: 0,
		features: 0,
		allowsIn: true,
		debugMode: false,
		hasSyntaxBeenValidated: true,
		error: null
	};
		
	this.sourceCode = sourceCode;
	this.lexer = new lex.Lexer(sourceCode);
	this.tok = new token();
	this.scopeStack = [];
	this.statements = null;
	this.variableDecls = null;
	this.functions = null;
	this.capturedVariables = null;
}

jsc.Parser.prototype = {
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
		return this.state.inStrictMode;
	},
	
	get features() {
		return this.state.features;
	},
	
	get error() {
		return this.state.error;
	},
	
	get scope() {
		return this.scopeStack[this.scopeStack.length-1];
	},
	
	get tokenString() {
		return this.sourceCode.toString(this.tok.begin, this.tok.end);
	},
	
	parse: function(asFunction) {
		var errorLine = -1;
		var errorMessage = "";
		
		if(asFunction)
			this.lexer.isReparsing = true;
			
		this.statements = null;
		
		errorMessage = this.parseImpl();
		
		var lexLine = this.lexer.lineNumber;
		var lexError = this.lexer.error;
		
		this.lexer.clear();
		
		if(!utils.isStringNullOrEmpty(errorMessage) || lexError)
		{
			errorLine = lexLine;
			errorMessage = lexError ? lexError : errorMessage;
			
			this.statements = null;
		}
		
		if(!this.statements)
			return null;

		var program = new ast.SciptNode(
			this.sourceCode,
			this.lexer.lastLineNumber,
			this.state.lastLine,
			{
				statements: this.statements, 
				declarations: this.variableDecls, 
				functions: this.functions, 
				vars: this.capturedVariables, 
				features: this.features, 
				constantCount: this.state.constantCount
			});
	},
	
	parseImpl: function() {
	
	},
	
	pushScope: function() {
		var isFunction = false;
		var isStrict = false;
		
		if(this.scopeStack.length)
		{
			isFunction = this.scope.isFunction;
			isStrict = this.scope.strictMode;
		}
		
		this.scopeStack.push(new jsc.ParserScope(isFunction, isStrict));
		
		return this.scope;
	},
	
	popScope: function(shouldTrackClosedVariables) {
		if(this.scopeStack.length <= 1)
			this.throwOnError("Unable to leave the current scope.");
			
		this.scopeStack[this.scopeStack.length-2].collectFreeVariables(this.scope, shouldTrackClosedVariables);
		this.scopeStack.pop();
	},
	
	getErrorMessageForExpectedToken: function(tokKind) {
		switch(tokKind)
		{
			case token.Kind.RESERVED_STRICT:
				return utils.format("The keyword '%s' is reserved and cannot be used in strict mode.", this.tokenString);
			case token.Kind.RESERVED:
				return utils.format("The keyword '%s' is reserved and cannot be used.", this.tokenString);
			case token.Kind.NUMBER:
				return utils.format("Unexpected number '%s'.", this.tokenString);
			case token.Kind.IDENTIFIER:
				return utils.format("Identifier expected, but found '%s' instead.", this.tokenString);
			case token.Kind.STRING:
				return utils.format("Unexpected string %s.", this.tokenString);
			case token.Kind.ERROR:
				return utils.format("The token '%s' was not recognized.", this.tokenString);
			case token.Kind.EOF:
				return "Unexpected end of file.";
			case token.Kind.RETURN:
				return "Return statements are only valid inside a function.";
			default:
				return "Internal Error";
		}
		
		return "";
	},
	
	setError: function(tokKindOrMessage) {
		var msg = null;

		if(utils.isNull(tokKindOrMessage))
		{
			msg = jsc.Token.getName(this.tok.kind);
			msg = (!utils.isStringNullOrEmpty(msg) ? "Unexpected token: " + msg : this.getErrorMessageForExpectedToken(this.tok.kind));
		}
		else if(utils.isString(tokKindOrMessage))
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
				if(utils.isStringNullOrEmpty(jsc.Token.getName(this.tok.kind)))
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
		if(!utils.isStringNullOrEmpty(message))
			this.setErrorImpl(message);

		// only throw when an error exists
		if(!utils.isStringNullOrEmpty(this.state.error))
			throw new Error(this.state.error);
	},
	
	debugLog: function(msg /*, ... */) {
		if(this.debugMode)
			console.log(utils.format.apply(null, arguments));
	},
};

jsc.ParserScope = function(isFunction, inStrictMode) {
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
};

jsc.ParserScope.prototype = {
	get isInLoop() {
		return (this.loopDepth > 0);
	},
	
	get canBreak() {
		return (this.loopDepth > 0 || this.switchDepth > 0);
	},
	
	get canContinue() {
		return (this.loopDepth > 0);
	},
	
	collectFreeVariables: function(nestedScope, shouldTrackClosedVariables) {
		// TODO
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
	}
};

(function() {
	jsc.Parser.Mode = utils.createEnum(1, ["PROGRAM", "FUNCTION"]);
})()

module.exports = {
	create: function(sourceCode, parameters, inStrictMode, parserMode) {
		return new jsc.Parser(sourceCode, parameters, inStrictMode, parserMode);
	}
}