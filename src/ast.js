var jsc = require("./jsc");
require("./utils");

/** @namespace */
jsc.AST = jsc.AST || {};


/**
 * The AST parsing context.
 *
 * @class
 */
jsc.AST.Context = Object.define({
	initialize: function(source, lexer) {
		this.source = source;
		this.lexer = lexer;
		this.assignmentStack = [];		// element = jsc.AST.AssignmentInfo
		this.binaryOperandStack = []; 	// element = jsc.AST.BinaryOperand
		this.binaryOperatorStack = []; 	// element = [<operatorTokenKind>, <operatorPrecedence>]
		this.unaryTokenStack = [];		// element = [<tokenKind>, <tokenBegin>, <tokenColumn>]
		this.variableDecls = [];		// element = jsc.AST.VariableDeclaration
		this.functions = [];			// element = jsc.AST.FunctionNode
		this.features = jsc.AST.CodeFeatureFlags.NONE;
		this.evalCount = 0;
		this.constantCount = 0;
	},
	
	get lineNumber() {
		return this.lexer.lastLineNumber;
	},

	get lastUnaryTokenKind() {
		return this.unaryTokenStack[this.unaryTokenStack.length-1][0];
	},
	
	get lastUnaryTokenBegin() {
		return this.unaryTokenStack[this.unaryTokenStack.length-1][1];
	},

	get lastUnaryTokenColumn() {
		return this.unaryTokenStack[this.unaryTokenStack.length-1][2];
	},



	//=============================================================================================
	// CREATE STATEMENTS
	//=============================================================================================
	
	createEmptyStatement: function(columnNumber) {
		return new jsc.AST.EmptyStatement(this.lineNumber, columnNumber);
	},

	createExpressionStatement: function(expression, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ExpressionStatement(this.lineNumber, columnNumber, expression);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createBlockStatement: function(statements, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.BlockStatement(this.lineNumber, columnNumber, statements);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createLabelStatement: function(labelInfo, statement) {
		var labelStatement = new jsc.AST.LabelStatement(this.lineNumber, labelInfo.columnNumber, labelInfo.name, statement);
		this.setExceptionLocation(labelStatement, labelInfo.end, labelInfo.begin, labelInfo.end);

		return labelStatement;
	},
	
	createVarStatement: function(expression, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.VarStatement(this.lineNumber, columnNumber, expression);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createConstStatement: function(expression, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ConstStatement(this.lineNumber, columnNumber, expression);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createIfStatement: function(conditionExpression, trueStatement, falseStatement, beginLine, endLine, columnNumber) {
		var statement = null;

		if(jsc.Utils.isNull(falseStatement))
			statement = new jsc.AST.IfStatement(this.lineNumber, columnNumber, conditionExpression, trueStatement);
		else
			statement = new jsc.AST.IfElseStatement(this.lineNumber, columnNumber, conditionExpression, trueStatement, falseStatement);

		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createWhileStatement: function(expression, statement, beginLine, endLine, columnNumber) {
		var whileStatement = new jsc.AST.WhileStatement(this.lineNumber, columnNumber, expression, statement);
		this.setStatementLocation(whileStatement, beginLine, endLine);

		return whileStatement;
	},
	
	createDoWhileStatement: function(expression, statement, beginLine, endLine, columnNumber) {
		var doWhileStatement = new jsc.AST.DoWhileStatement(this.lineNumber, columnNumber, expression, statement);
		this.setStatementLocation(doWhileStatement, beginLine, endLine);

		return doWhileStatement;
	},
	
	createForStatement: function(initializeExpression, conditionExpression, iteratorExpression, statement, isFirstExpressionVarDeclaration, beginLine, endLine, columnNumber) {
		var forStatement = new jsc.AST.ForStatement(this.lineNumber, columnNumber, initializeExpression, conditionExpression, iteratorExpression, statement, isFirstExpressionVarDeclaration);
		this.setStatementLocation(forStatement, beginLine, endLine);

		return forStatement;
	},
	
	createForInStatement: function(leftExpression, rightExpression, statement, start, divot, end, beginLine, endLine, columnNumber) {
		var forInStatement = new jsc.AST.ForInStatement(this.lineNumber, columnNumber, null, false, null, leftExpression, rightExpression, statement, 0, 0, 0);
		this.setExceptionLocation(forInStatement, divot, start, end);
		this.setStatementLocation(forInStatement, beginLine, endLine);

		return forInStatement;
	},
	
	createForInStatementWithVarDecl: function(name, initializeExpression, expression, statement, start, divot, end, initBegin, initEnd, beginLine, endLine, columnNumber) {
		var leftExpression = new jsc.AST.ResolveExpression(this.lineNumber, columnNumber, name, initBegin - (initBegin - start));

		if(!jsc.Utils.isNull(initializeExpression))
		{
			initializeExpression = new jsc.AST.AssignResolveExpression(this.lineNumber, columnNumber, name, initializeExpression, true);
			initializeExpression.exceptionDivot = initBegin;
			initializeExpression.exceptionStartPosition = initBegin - (initBegin - start);
			initializeExpression.exceptionEndPosition = (initEnd - initBegin) - initBegin;
		}

		var forInStatement = new jsc.AST.ForInStatement(this.lineNumber, columnNumber, name, true, initializeExpression, leftExpression, expression, statement, 0, 0, 0);
		this.setExceptionLocation(forInStatement, divot+1, start, end);
		this.setStatementLocation(forInStatement, beginLine, endLine);

		return forInStatement;
	},
	
	createContinueStatement: function(name, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ContinueStatement(this.lineNumber, columnNumber, name);
		this.setExceptionLocation(statement, end, start, end);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createBreakStatement: function(name, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.BreakStatement(this.lineNumber, columnNumber, name);
		this.setExceptionLocation(statement, end, start, end);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createReturnStatement: function(expression, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ReturnStatement(this.lineNumber, columnNumber, expression);
		this.setExceptionLocation(statement, end, start, end);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createThrowStatement: function(expression, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ThrowStatement(this.lineNumber, columnNumber, expression);
		this.setExceptionLocation(statement, end, start, end);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createDebuggerStatement: function(beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.DebuggerStatement(this.lineNumber, columnNumber);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createTryStatement: function(exceptionVarName, tryStatement, catchStatement, finallyStatement, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.TryStatement(this.lineNumber, columnNumber, exceptionVarName, tryStatement, catchStatement, finallyStatement);
		this.setStatementLocation(statement, beginLine, endLine);

		if(!jsc.Utils.isNull(catchStatement))
			this.features |= jsc.AST.CodeFeatureFlags.CATCH;

		return statement;
	},

	createWithStatement: function(expression, statement, start, end, beginLine, endLine, columnNumber) {
		var withStatement = new jsc.AST.WithStatement(this.lineNumber, columnNumber, expression, statement, end, end - start);
		this.setStatementLocation(withStatement, beginLine, endLine);

		this.features |= jsc.AST.CodeFeatureFlags.WITH;

		return withStatement;
	},
	
	createSwitchStatement: function(expression, defaultClause, firstClauseList, secondClauseList, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.SwitchStatement(this.lineNumber, columnNumber, expression, defaultClause, firstClauseList, secondClauseList);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createSwitchClauseList: function(expression, statements, tail) {
		return new jsc.AST.SwitchClauseListNode(expression, statements, tail);
	},
	
	createInitialFunctionStatement: function(inStrictMode, columnNumber) {
		return new jsc.AST.FunctionNode(this.lineNumber, columnNumber, inStrictMode);
	},
	
	createFunctionStatement: function(statements, variables, functions, capturedVariables, features, constantCount, openBracePosition, closeBracePosition, bodyBeginLine, hasReturnValue, columnNumber) {
		var func = new jsc.AST.FunctionNode(this.lineNumber, columnNumber);

		func.features = features;
		func.source = this.source.toSourceCode(openBracePosition, closeBracePosition, bodyBeginLine);
		func.statements = statements;
		func.functions = functions;
		func.variables = variables;
		func.capturedVariables = capturedVariables;
		func.constantCount = constantCount;
		func.hasReturnValue = hasReturnValue;

		// set each of the functions parent to this new
		// function node
		if(functions)
		{
			functions.forEach(function(f) {
				f.parentFunction = func;
			});
		}

		return func;
	},
	
	createFunctionDeclarationStatement: function(name, functionNode, parametersNode, openBracePosition, closeBracePosition, bodyBeginLine, bodyEndLine, columnNumber) {
		var subSource = this.source.toSourceCode(openBracePosition, closeBracePosition, bodyBeginLine);
		var funcDecl = new jsc.AST.FunctionDeclarationStatement(this.lineNumber, columnNumber, name, functionNode, subSource, parametersNode);

		this.setStatementLocation(functionNode, bodyBeginLine, bodyEndLine);

		if(name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;

		this.functions.push(functionNode);

		return funcDecl;
	},
		


	//=============================================================================================
	// CREATE EXPRESSIONS
	//=============================================================================================

	createAssignmentExpression: function(expression, initialCount, currentCount, lastTokenEnd) {
		var info = this.assignmentStack[this.assignmentStack.length-1];
		var expr = this.createAssignment(info.op, info.expression, expression, info.count !== initialCount, info.count !== currentCount, info.start, info.divot+1, lastTokenEnd, info.columnNumber);

		this.assignmentStack.pop();
		
		return expr;
	},
	
	createAssignment: function(op, leftExpression, rightExpression, leftHasAssignments, rightHasAssignments, start, divot, end, columnNumber) {

		if(!leftExpression.isLocation)
			return new jsc.AST.AssignErrorExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, op, divot, divot - start, end - divot);

		var expr = null;


		// resolve expression
		if(leftExpression.isResolve)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
			{
				if(rightExpression.kind === jsc.AST.NodeKind.FUNCTION_EXPR)
					rightExpression.functionNode.inferredName = leftExpression.name;

				expr = new jsc.AST.AssignResolveExpression(this.lineNumber, columnNumber, leftExpression.name, rightExpression, rightHasAssignments);
				this.setExceptionLocation(expr, divot, start, end);

				return expr;
			}

			return new jsc.AST.ReadModifyResolveExpression(this.lineNumber, columnNumber, leftExpression.name, rightExpression, rightHasAssignments, op, divot, divot - start, end - divot);
		}


		// bracket expression
		if(leftExpression.isBracketAccessor)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
				return new jsc.AST.AssignBracketExpression(this.lineNumber, columnNumber, leftExpression.base, leftExpression.subscript, leftHasAssignments, rightExpression, rightHasAssignments, leftExpression.exceptionDivot, leftExpression.exceptionDivot - start, end - leftExpression.exceptionDivot);

			expr = new jsc.AST.ReadModifyBracketExpression(this.lineNumber, columnNumber, leftExpression.base, leftExpression.subscript, leftHasAssignments, rightExpression, rightHasAssignments, op, divot, divot - start, end - divot);
			expr.setExpressionInfo(leftExpression.exceptionDivot, leftExpression.exceptionEndPosition);

			return expr;
		}


		// dot expression
		if(leftExpression.isDotAccessor)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
			{
				if(rightExpression.kind === jsc.AST.NodeKind.FUNCTION_EXPR)
					rightExpression.functionNode.inferredName = leftExpression.name;

				return new jsc.AST.AssignDotExpression(this.lineNumber, columnNumber, leftExpression.name, leftExpression.base, rightExpression, rightHasAssignments, leftExpression.exceptionDivot, leftExpression.exceptionDivot - start, end - leftExpression.exceptionDivot);
			}

			expr = new jsc.AST.ReadModifyDotExpression(this.lineNumber, columnNumber, leftExpression.name, leftExpression.base, rightExpression, rightHasAssignments, op, divot, divot - start, end - divot);
			expr.setExpressionInfo(leftExpression.exceptionDivot, leftExpression.exceptionEndPosition);

			return expr;
		}


		throw new Error("Invalid assignment expression.");
	},
	
	createAssignResolveExpression: function(name, rightExpression, rightHasAssignments, start, divot, end, columnNumber) {
		if(rightExpression.kind === jsc.AST.NodeKind.FUNCTION_EXPR)
			rightExpression.functionNode.inferredName = name;

		var expr = new jsc.AST.AssignResolveExpression(this.lineNumber, columnNumber, name, rightExpression, rightHasAssignments);
		this.setExceptionLocation(expr, divot, start, end);

		return expr;
	},
	
	createResolveExpression: function(name, position, columnNumber) {
		if(name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;

		return new jsc.AST.ResolveExpression(this.lineNumber, columnNumber, name, position);
	},
	
	createConstDeclarationExpression: function(name, initializeExpression, nextExpression, columnNumber) {
		return new jsc.AST.ConstantDeclarationExpression(this.lineNumber, columnNumber, name, initializeExpression, nextExpression);
	},
	
	createConditionalExpression: function(conditionExpression, leftExpression, rightExpression, columnNumber) {
		return new jsc.AST.ConditionalExpression(this.lineNumber, columnNumber, conditionExpression, leftExpression, rightExpression);
	},
	
	createPrefixExpression: function(expression, op, start, divot, end, columnNumber) {
		if(!expression.isLocation)
			return new jsc.AST.PrefixErrorExpression(this.lineNumber, columnNumber, expression, op, divot, divot - start, end - divot);

		if(expression.isResolve)
			return new jsc.AST.PrefixResolveExpression(this.lineNumber, columnNumber, expression.name, op, divot, divot - start, end - divot);

		if(expression.isBracketAccessor)
		{
			var bracketExpr = new jsc.AST.PrefixBracketExpression(this.lineNumber, columnNumber, expression.base, expression.subscript, op, divot, divot - start, end - divot);
			bracketExpr.setExpressionInfo(expression.exceptionDivot, expression.exceptionStartPosition);

			return bracketExpr;
		}

		if(expression.isDotAccessor)
		{
			var dotExpr = new jsc.AST.PrefixDotExpression(this.lineNumber, columnNumber, expression.name, expression.base, op, divot, divot - start, end - divot);
			dotExpr.setExpressionInfo(expression.exceptionDivot, expression.exceptionStartPosition);

			return dotExpr;
		}

		throw new Error("Invalid prefix expression.");
	},
	
	createPostfixExpression: function(expression, op, start, divot, end, columnNumber) {
		if(!expression.isLocation)
			return new jsc.AST.PostfixErrorExpression(this.lineNumber, columnNumber, expression, op, divot, divot - start, end - divot);

		if(expression.isResolve)
			return new jsc.AST.PostfixResolveExpression(this.lineNumber, columnNumber, expression.name, op, divot, divot - start, end - divot);

		if(expression.isBracketAccessor)
		{
			var bracketExpr = new jsc.AST.PostfixBracketExpression(this.lineNumber, columnNumber, expression.base, expression.subscript, op, divot, divot - start, end - divot);
			bracketExpr.setExpressionInfo(expression.exceptionDivot, expression.exceptionEndPosition);

			return bracketExpr;
		}

		if(expression.isDotAccessor)
		{
			var dotExpr = new jsc.AST.PostfixDotExpression(this.lineNumber, columnNumber, expression.name, expression.base, op, divot, divot - start, end - divot);
			dotExpr.setExpressionInfo(expression.exceptionDivot, expression.exceptionEndPosition);

			return dotExpr;
		}

		throw new Error("Invalid postfix expression.");
	},
	
	createLogicalNotExpression: function(expression, columnNumber) {
		return new jsc.AST.LogicalNotExpression(this.lineNumber, columnNumber, expression);
	},
	
	createBitwiseNotExpression: function(expression, columnNumber) {
		return new jsc.AST.BitwiseNotExpression(this.lineNumber, columnNumber, expression);
	},
	
	createNegateExpression: function(expression, columnNumber) {
		return new jsc.AST.NegateExpression(this.lineNumber, columnNumber, expression);
	},
	
	createUnaryPlusExpression: function(expression, columnNumber) {
		return new jsc.AST.UnaryPlusExpression(this.lineNumber, columnNumber, expression);
	},
	
	createTypeOfExpression: function(expression, columnNumber) {
		if(expression.isResolve)
			return new jsc.AST.TypeOfResolveExpression(this.lineNumber, columnNumber, expression.name);

		return new jsc.AST.TypeOfValueExpression(this.lineNumber, columnNumber, expression);
	},
	
	createVoidExpression: function(expression, columnNumber) {
		this.constantCount++;

		return new jsc.AST.VoidExpression(this.lineNumber, columnNumber, expression);
	},
	
	createDeleteExpression: function(expression, start, divot, end, columnNumber) {
		if(!expression.isLocation)
			return new jsc.AST.DeleteValueExpression(this.lineNumber, columnNumber, expression);

		if(expression.isResolve)
			return new jsc.AST.DeleteResolveExpression(this.lineNumber, columnNumber, expression.name, divot, divot - start, end - divot);

		if(expression.isBracketAccessor)
			return new jsc.AST.DeleteBracketExpression(this.lineNumber, columnNumber, expression.base, expression.subscript, divot, divot - start, end - divot);

		if(expression.isDotAccessor)
			return new jsc.AST.DeleteDotExpression(this.lineNumber, columnNumber, expression.name, expression.base, divot, divot - start, end - divot);

		throw new Error("Invalid delete expression.");
	},
	
	createThisExpression: function(columnNumber) {
		this.features |= jsc.AST.CodeFeatureFlags.THIS;

		return new jsc.AST.ThisExpression(this.lineNumber, columnNumber);
	},
	
	createNewExpression: function(expression, start, end, columnNumber) {
		var expr = new jsc.AST.NewExpression(this.lineNumber, columnNumber, expression);
		this.setExceptionLocation(expr, start, end, end, false);

		return expr;
	},
	
	createNewExpressionWithArguments: function(expression, argumentList, start, divot, end, columnNumber) {
		var expr = new jsc.AST.NewExpression(this.lineNumber, columnNumber, expression, argumentList);
		this.setExceptionLocation(expr, divot, start, end);

		return expr;
	},

	createFunctionExpression: function(name, functionNode, parameterList, openBracePosition, closeBracePosition, bodyBeginLine, bodyEndLine, columnNumber) {
		var expr = new jsc.AST.FunctionExpression(this.lineNumber, columnNumber, name, functionNode, this.source.toSourceCode(openBracePosition, closeBracePosition, bodyBeginLine), parameterList);

		this.setStatementLocation(functionNode, bodyBeginLine, bodyEndLine);
		this.functions.push(functionNode);

		return expr;
	},

	createFunctionCallExpression: function(expression, argumentList, start, divot, end, columnNumber) {
		if(!expression.isLocation)
			return new jsc.AST.ValueFunctionCallExpression(this.lineNumber, columnNumber, expression, argumentList, divot, divot - start, end - divot);

		if(expression.isResolve)
		{
			if(expression.name === "eval")
			{
				this.features |= jsc.AST.CodeFeatureFlags.EVAL;
				this.evalCount++;

				return new jsc.AST.EvalFunctionCallExpression(this.lineNumber, columnNumber, argumentList, divot, divot - start, end - divot);
			}

			return new jsc.AST.ResolveFunctionCallExpression(this.lineNumber, columnNumber, expression.name, argumentList, divot, divot - start, end - divot);
		}

		if(expression.isBracketAccessor)
		{
			var bracketExpr = new jsc.AST.BracketFunctionCallExpression(this.lineNumber, columnNumber, expression.base, expression.subscript, argumentList, divot, divot - start, end - divot);
			bracketExpr.setExpressionInfo(expression.exceptionDivot, expression.exceptionEndPosition);

			return bracketExpr;
		}

		if(expression.isDotAccessor)
		{
			var dotExpr = null;

			if(expression.name === "call")
				dotExpr = new jsc.AST.CallDotFunctionCallExpression(this.lineNumber, columnNumber, expression.name, expression.base, argumentList, divot, divot - start, end - divot);
			else if(expression.name === "apply")
				dotExpr = new jsc.AST.ApplyDotFunctionCallExpression(this.lineNumber, columnNumber, expression.name, expression.base, argumentList, divot, divot - start, end - divot);
			else
				dotExpr = new jsc.AST.DotFunctionCallExpression(this.lineNumber, columnNumber, expression.name, expression.base, argumentList, divot, divot - start, end - divot);

			dotExpr.setExpressionInfo(expression.exceptionDivot, expression.exceptionEndPosition);

			return dotExpr;
		}

		throw new Error("Invalid function call expression.");
	},
	
	createArrayExpression: function(columnNumber, elements, elisions) {
		var isOptional = !jsc.Utils.isNull(elisions);

		elisions = jsc.Utils.valueOrDefault(elisions, 0);

		if(elisions > 0)
			this.constantCount++;

		return new jsc.AST.ArrayExpression(this.lineNumber, columnNumber, elements, elisions, isOptional);
	},
	
	createObjectLiteralExpression: function(columnNumber, properties) {
		return new jsc.AST.ObjectLiteralExpression(this.lineNumber, columnNumber, properties);
	},

	createBracketAccessorExpression: function(base, subscript, subscriptHasAssignments, start, divot, end, columnNumber) {
		var expr = new jsc.AST.BracketAccessorExpression(this.lineNumber, columnNumber, base, subscript, subscriptHasAssignments);
		this.setExceptionLocation(expr, divot, start, end);

		return expr;
	},

	createDotAccessorExpression: function(propertyName, baseExpression, start, divot, end, columnNumber) {
		var expr = new jsc.AST.DotAccessorExpression(this.lineNumber, columnNumber, propertyName, baseExpression);
		this.setExceptionLocation(expr, divot, start, end);

		return expr;
	},
	
	createStringExpression: function(value, columnNumber) {
		this.constantCount++;

		return new jsc.AST.StringExpression(this.lineNumber, columnNumber, value);
	},
	
	createNumberExpression: function(value, columnNumber, isConstant) {
		isConstant = jsc.Utils.valueOrDefault(isConstant, true);

		if(isConstant)
			this.constantCount++;

		return new jsc.AST.NumberExpression(this.lineNumber, columnNumber, value);
	},
	
	createNullExpression: function(columnNumber) {
		this.constantCount++;

		return new jsc.AST.NullExpression(this.lineNumber, columnNumber);
	},
	
	createBooleanExpression: function(value, columnNumber) {
		this.constantCount++;

		return new jsc.AST.BooleanExpression(this.lineNumber, columnNumber, value);
	},

	createRegExpExpression: function(pattern, flags, start, columnNumber) {
		var expr = new jsc.AST.RegExExpression(this.lineNumber, columnNumber, pattern, flags);
		var size = pattern.length + 2; // +2 for the two '/' chars.

		this.setExceptionLocation(expr, start + size, start, start + size);

		return expr;
	},
	
	createCommaExpression: function(expr1, expr2, columnNumber) {
		return new jsc.AST.CommaExpression(this.lineNumber, columnNumber, expr1, expr2);
	},

	createBitwiseExpression: function(opCode, leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		switch(opCode)
		{
			case jsc.AST.OpCode.BITWISE_AND:
				return new jsc.AST.BitwiseAndExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
			case jsc.AST.OpCode.BITWISE_OR:
				return new jsc.AST.BitwiseOrExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
			case jsc.AST.OpCode.BITWISE_XOR:
				return new jsc.AST.BitwiseXOrExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
			default:
				throw new Error("Invalid bitwise operation.");
		}
	},

	createDivideExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.DivideExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createMultiplyExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.MultiplyExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createSubtractExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.SubtractExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createAddExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		return new jsc.AST.AddExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createModExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.ModulusExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createLeftShiftExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		return new jsc.AST.LeftShiftExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createRightShiftExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber, asUnsigned) {
		if(asUnsigned)
			return new jsc.AST.RightShiftUnsignedExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);

		return new jsc.AST.RightShiftExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createLessThanExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		return new jsc.AST.LessThanExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createLessThanOrEqualExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		return new jsc.AST.LessThanOrEqualExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createGreaterThanExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		return new jsc.AST.GreaterThanExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createGreaterThanOrEqualExpression: function(leftExpression, rightExpression, rightHasAssignments, columnNumber) {
		return new jsc.AST.GreaterThanOrEqualExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments);
	},

	createBinaryExpression: function(operatorTokenKind, leftOp, rightOp, columnNumber) {
		var lhsExpr = leftOp.expression;
		var rhsExpr = rightOp.expression;
		var rhsHasAssignment = rightOp.info.hasAssignments;

		switch(operatorTokenKind)
		{
			case jsc.Token.Kind.AND:
				return new jsc.AST.LogicalExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, jsc.AST.LogicalOperatorKind.AND);

			case jsc.Token.Kind.OR:
				return new jsc.AST.LogicalExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, jsc.AST.LogicalOperatorKind.OR);

			case jsc.Token.Kind.BITWISE_AND:
				return this.createBitwiseExpression(jsc.AST.OpCode.BITWISE_AND, lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.BITWISE_OR:
				return this.createBitwiseExpression(jsc.AST.OpCode.BITWISE_OR, lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.BITWISE_XOR:
				return this.createBitwiseExpression(jsc.AST.OpCode.BITWISE_XOR, lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.DIV:
				return this.createDivideExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.MULT:
				return this.createMultiplyExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.MINUS:
				return this.createSubtractExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.PLUS:
				return this.createAddExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.MOD:
				return this.createModExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.LSHIFT:
				return this.createLeftShiftExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.RSHIFT:
				return this.createRightShiftExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber, false);

			case jsc.Token.Kind.URSHIFT:
				return this.createRightShiftExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber, true);

			case jsc.Token.Kind.EQUAL_EQUAL:
				return new jsc.AST.EqualExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.NOT_EQUAL:
				return new jsc.AST.NotEqualExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.STRICT_EQUAL:
				return new jsc.AST.EqualStrictExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.STRICT_NOT_EQUAL:
				return new jsc.AST.NotEqualStrictExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.LESS:
				return this.createLessThanExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.LESS_EQUAL:
				return this.createLessThanOrEqualExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.GREATER:
				return this.createGreaterThanExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.GREATER_EQUAL:
				return this.createGreaterThanOrEqualExpression(lhsExpr, rhsExpr, rhsHasAssignment, columnNumber);

			case jsc.Token.Kind.IN:
			{
				var inExpr = new jsc.AST.InExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);
				this.setExceptionLocation(inExpr, rightOp.info.start, leftOp.info.start, rightOp.info.end);

				return inExpr;
			}
			case jsc.Token.Kind.INSTANCEOF:
			{
				var instanceofExpr = new jsc.AST.InstanceOfExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);
				this.setExceptionLocation(instanceofExpr, rightOp.info.start, leftOp.info.start, rightOp.info.end);

				return instanceofExpr;
			}
			default:
				throw new Error("Unknown binary expression operation. Operation Kind='" + jsc.Token.getName(operatorTokenKind) + "'.");
		}
	},


	//=============================================================================================
	// CREATE LIST NODES
	//=============================================================================================

	createParameterList: function(name, list) {
		return new jsc.AST.ParameterListNode(name, list);
	},
	
	createArgumentsList: function(columnNumber, expression, list) {
		return new jsc.AST.ArgumentListNode(this.lineNumber, columnNumber, expression, list);
	},
	
	createArrayElementList: function(expression, elisions, list) {
		return new jsc.AST.ArrayElementList(elisions, expression, list);
	},
	
	createPropertyList: function(columnNumber, propertyNode, propertyList) {
		return new jsc.AST.PropertyListNode(this.lineNumber, columnNumber, propertyNode, propertyList);
	},
	
	createProperty: function(propertyName, expression, flags) {
		if(jsc.Utils.isString(propertyName) && expression.kind === jsc.AST.NodeKind.FUNCTION_EXPR)
			expression.functionNode.inferredName = propertyName;

		return new jsc.AST.PropertyNode(propertyName, flags, expression);
	},

	createGetterOrSetterProperty: function(propertyName, flags, parameters, functionNode, openBracePosition, closeBracePosition, bodyBeginLine, bodyEndLine, columnNumber) {
		if(jsc.Utils.isString(propertyName))
			functionNode.inferredName = propertyName;

		this.setStatementLocation(functionNode, bodyBeginLine, bodyEndLine);

		return new jsc.AST.PropertyNode(
			propertyName,
			flags,
			new jsc.AST.FunctionExpression(this.lineNumber, columnNumber, null, functionNode, this.source.toSourceCode(openBracePosition, closeBracePosition, bodyBeginLine), parameters));
	},



	//=============================================================================================
	// CONTEXT STATE / UTILS
	//=============================================================================================

	combineCommaExpressions: function(list, initExpression, columnNumber) {
		if(jsc.Utils.isNull(list))
			return initExpression;

		if(list.kind === jsc.AST.NodeKind.COMMA)
		{
			list.expressions.push(initExpression);
			return list;
		}

		return new jsc.AST.CommaExpression(this.lineNumber, columnNumber, list, initExpression);
	},

	stripUnaryPlusExpression: function(expression) {
		return (expression.kind === jsc.AST.NodeKind.UNARY_PLUS ? expression.expression : expression);
	},

	addVariable: function(name, flags) {
		if(name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;
			
		this.variableDecls.push(new jsc.AST.VariableDeclaration(name, flags));
	},
	
	precedenceIsLowerThanOperatorStack: function(precedence) {
		return (precedence <= this.binaryOperatorStack[this.binaryOperatorStack.length-1][1]);
	},
	
	appendAssignment: function(expr, start, divot, columnNumber, count, op) {
		this.assignmentStack.push(new jsc.AST.AssignmentInfo(expr, start, divot, columnNumber, count, op));
	},
	
	pushBinaryOperand: function(state, expr, start, divot, end, columnNumber, hasAssignments) {
		state.operandDepth++;

		this.binaryOperandStack.push(new jsc.AST.BinaryOperand(expr, new jsc.AST.BinaryOperationInfo(start, divot, end, columnNumber, hasAssignments)));
	},
	
	popBinaryOperand: function() {
		var operand = this.binaryOperandStack.pop();
		
		return operand.expression;
	},
	
	pushBinaryOperation: function(state, operatorTokenKind, precedence) {
		state.operatorDepth++;
		this.binaryOperatorStack.push([operatorTokenKind, precedence]);
	},
	
	popBinaryOperation: function(operationState) {
		var lhs = this.binaryOperandStack[this.binaryOperandStack.length-2];
		var rhs = this.binaryOperandStack[this.binaryOperandStack.length-1];
		
		operationState.operandDepth -= 2;
		
		if(operationState.operandDepth < 0)
			throw new Error("Not enough binary operands on the stack.");

		this.binaryOperandStack.length -= 2;
		this.binaryOperandStack.push(new jsc.AST.BinaryOperand(
				this.createBinaryExpression(this.binaryOperatorStack[this.binaryOperatorStack.length-1][0], lhs, rhs, lhs.info.columnNumber),
				new jsc.AST.BinaryOperationInfo.FromBinaryOperations(lhs.info, rhs.info)));
		
		this.binaryOperatorStack.pop();
		
		operationState.operandDepth++;
		operationState.operatorDepth--;
	},
	
	pushUnaryToken: function(tokenKind, tokenBegin, tokenColumn) {
		this.unaryTokenStack.push([tokenKind, tokenBegin, tokenColumn]);
	},
	
	popUnaryToken: function() {
		this.unaryTokenStack.pop();
	},

	setStatementLocation: function(statement, beginLine, endLine) {
		statement.startLine = beginLine;
		statement.endLine = endLine;
	},

	setExceptionLocation: function(throwableNode, divot, start, end, adjustValues) {
		adjustValues = jsc.Utils.valueOrDefault(adjustValues, true);

		throwableNode.exceptionDivot = divot;
		throwableNode.exceptionStartPosition = (adjustValues ? divot - start : start);
		throwableNode.exceptionEndPosition = (adjustValues ? end - divot : end);
	}
});


/**
 * The base class for all AST nodes.
 *
 * @class
 */
jsc.AST.Node = Object.define({
	initialize: function(kind, lineNumber, columnNumber) {
		this.kind = jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.UNKNOWN);
		this.lineNumber = jsc.Utils.valueOrDefault(lineNumber, 1);
		this.columnNumber = jsc.Utils.valueOrDefault(columnNumber, 1);
	},

	get isEmpty() {
		return (this.kind === jsc.AST.NodeKind.EMPTY);
	},

	get isThis() {
		return (this.kind === jsc.AST.NodeKind.THIS);
	},
	
	get isNumber() {
		return (this.kind === jsc.AST.NodeKind.NUMBER);
	},
	
	get isBoolean() {
		return (this.kind === jsc.AST.NodeKind.BOOLEAN);
	},
	
	get isString() {
		return (this.kind === jsc.AST.NodeKind.STRING);
	},
	
	get isPrimitive() {
		return (this.isNumber || this.isBoolean || this.isString);
	},
	
	get isPrimitiveOrNull() {
		return (this.isPrimitive || this.kind === jsc.AST.NodeKind.NULL);
	},
	
	get isLocation() {
		return (this.isResolve || this.isBracketAccessor || this.isDotAccessor);
	},
	
	get isResolve() {
		return (this.kind === jsc.AST.NodeKind.RESOLVE);
	},
	
	get isBracketAccessor() {
		return (this.kind === jsc.AST.NodeKind.BRACKET_ACCESSOR);
	},
	
	get isDotAccessor() {
		return (this.kind === jsc.AST.NodeKind.DOT_ACCESSOR);
	},

	get isIfOrIfElse() {
		return (this.kind === jsc.AST.NodeKind.IF || this.kind === jsc.AST.NodeKind.IF_ELSE);
	},

	get isExpression() {
		return false;
	},

	get isStatement() {
		return false;
	},

	toString: function() {
		for(var kind in jsc.AST.NodeKind)
		{
			if(jsc.AST.NodeKind.hasOwnProperty(kind) && jsc.AST.NodeKind[kind] === this.kind)
				return kind;
		}

		return "UNKNOWN";
	}
});




//=============================================================================================
// EXPRESSION CLASSES
//=============================================================================================

/**
 * The base class for all language expressions.
 *
 * @class
 */
jsc.AST.Expression = Object.define(jsc.AST.Node, {
	initialize: function($super, kind, lineNumber, columnNumber, resultKind) {
		$super(kind, lineNumber, columnNumber);

		this.state = {
			resultKind: jsc.Utils.valueOrDefault(resultKind, jsc.AST.ExpressionResultKind.Unknown)
		};
	},

	get isExpression() {
		return true;
	},
	
	get resultKind() {
		return this.state.resultKind;
	}

});


/** @class */
jsc.AST.ThrowableExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, lineNumber, columnNumber, resultKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(kind, lineNumber, columnNumber, resultKind);

		this.exceptionDivot = jsc.Utils.valueOrDefault(exceptionDivot, -1);
		this.exceptionStartPosition = jsc.Utils.valueOrDefault(exceptionStartPosition, -1);
		this.exceptionEndPosition = jsc.Utils.valueOrDefault(exceptionEndPosition, -1);
	}
});


/** @class */
jsc.AST.ThrowableSubExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, kind, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(kind, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Unknown, exceptionDivot, exceptionStartPosition, exceptionEndPosition);

		this.subDivot = 0;
		this.subEndPosition = 0;
	},
	
	setExpressionInfo: function(divot, end) {
		if(divot > this.exceptionDivot)
			throw new Error();
			
		if((this.exceptionDivot - divot) & ~0xFFFF)
			return;

		this.subDivot = this.exceptionDivot - divot;
		this.subEndPosition = end;
	}
});


/** @class */
jsc.AST.ThrowablePrefixedSubExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, kind, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(kind, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Unknown, exceptionDivot, exceptionStartPosition, exceptionEndPosition);

		this.subDivot = 0;
		this.subStartPosition = 0;
	},
	
	setExpressionInfo: function(divot, startPosition) {
		if(divot < this.exceptionDivot)
			throw new Error();
			
		if((divot - this.exceptionDivot) & ~0xFFFF)
			return;

		this.subDivot = divot - this.exceptionDivot;
		this.subStartPosition = startPosition;
	}
});


/** @class */
jsc.AST.ThrowableBinaryExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, kind, resultKind, opCode, leftExpression, rightExpression, rightHasAssignments) {
		$super(kind, lineNumber, columnNumber, resultKind);

		this.opCode = opCode;
		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.NewExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, expression, args) {
		$super(jsc.AST.NodeKind.NEW, lineNumber, columnNumber);
		
		this.expression = expression;
		this.args = args;
	}
});


/** @class */
jsc.AST.CommaExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expr1, expr2) {
		$super(jsc.AST.NodeKind.COMMA, lineNumber, columnNumber);
		
		this.expressions = [expr1, expr2];
	},
	
	get count() {
		return this.expressions.length;
	},
	
	get: function(index) {
		return this.expressions[index];
	},
	
	append: function(expr) {
		this.expressions.push(expr);
	}
});


/** @class */
jsc.AST.VoidExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.VOID, lineNumber, columnNumber);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.ThisExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.THIS, lineNumber, columnNumber);
	}
});


/** @class */
jsc.AST.NullExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.NULL, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Null);
	}
});


/** @class */
jsc.AST.ArrayExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, elements, elision, isOptional) {
		$super(jsc.AST.NodeKind.ARRAY, lineNumber, columnNumber);
		
		this.elements = jsc.Utils.valueOrDefault(elements, null);
		this.elision = jsc.Utils.valueOrDefault(elision, 0);
		this.isOptional = jsc.Utils.valueOrDefault(isOptional, false);
	}
});


/** @class */
jsc.AST.ObjectLiteralExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, properties) {
		$super(jsc.AST.NodeKind.OBJECT_LITERAL, lineNumber, columnNumber);
		
		this.properties = jsc.Utils.valueOrDefault(properties, null);
	},

	get hasProperties() {
		return !jsc.Utils.isNull(this.properties);
	}
});


/** @class */
jsc.AST.BooleanExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.BOOLEAN, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Boolean);

		this.value = value;
	}
});


/** @class */
jsc.AST.NumberExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.NUMBER, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Number);

		this.value = value;
	}
});


/** @class */
jsc.AST.StringExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.STRING, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.String);

		this.value = value;
		this.isDirective = false;
	}
});


/** @class */
jsc.AST.RegExExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, pattern, flags) {
		$super(jsc.AST.NodeKind.REGEX, lineNumber, columnNumber);
		
		this.pattern = pattern;
		this.flags = flags;
	}
});


/** @class */
jsc.AST.ConditionalExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, conditionExpression, leftExpression, rightExpression) {
		$super(jsc.AST.NodeKind.CONDITIONAL, lineNumber, columnNumber);

		this.conditionExpression = conditionExpression;
		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
	}
});


/** @class */
jsc.AST.ConstantDeclarationExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, initializeExpression, nextExpression) {
		$super(jsc.AST.NodeKind.CONST_DECL, lineNumber, columnNumber);

		this.name = name;
		this.initializeExpression = initializeExpression;
		this.next = null;

		if(!jsc.Utils.isNull(nextExpression))
			nextExpression.next = this;
	},
	
	get hasInitializer() {
		return !jsc.Utils.isNull(this.initializeExpression);
	}
});


/** @class */
jsc.AST.FunctionExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, functionNode, source, parameters) {
		$super(jsc.AST.NodeKind.FUNCTION_EXPR, lineNumber, columnNumber);

		this.functionNode = functionNode;
		this.functionNode.finalize(source, name, parameters, jsc.AST.NodeKind.FUNCTION_EXPR);
	}
});


/** @class */
jsc.AST.BinaryExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, kind, resultKind, opCode, leftExpression, rightExpression, rightHasAssignments) {
		$super(kind, lineNumber, columnNumber, resultKind);

		this.opCode = opCode;
		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AddExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.ADD, 
			jsc.AST.ExpressionResultKind.ForAdd(leftExpression.resultKind, rightExpression.resultKind),
			jsc.AST.OpCode.ADD,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.SubtractExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.SUBTRACT, 
			jsc.AST.ExpressionResultKind.Number,
			jsc.AST.OpCode.SUBTRACT,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.MultiplyExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.MULTIPLY, 
			jsc.AST.ExpressionResultKind.Number,
			jsc.AST.OpCode.MULTIPLY,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.DivideExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.DIVIDE, 
			jsc.AST.ExpressionResultKind.Number,
			jsc.AST.OpCode.DIVIDE,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.ModulusExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.MODULUS, 
			jsc.AST.ExpressionResultKind.Number,
			jsc.AST.OpCode.MODULUS,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.LeftShiftExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.LEFT_SHIFT, 
			jsc.AST.ExpressionResultKind.Int32,
			jsc.AST.OpCode.LEFT_SHIFT,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.RightShiftExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.RIGHT_SHIFT, 
			jsc.AST.ExpressionResultKind.Int32,
			jsc.AST.OpCode.RIGHT_SHIFT,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.RightShiftUnsignedExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.RIGHT_SHIFT_UNSIGNED, 
			jsc.AST.ExpressionResultKind.Number,
			jsc.AST.OpCode.RIGHT_SHIFT_UNSIGNED,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.LessThanExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.LESS,
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.LESS,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.LessThanOrEqualExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.LESS_EQ,
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.LESS_EQ,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.GreaterThanExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.GREATER,
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.GREATER,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.GreaterThanOrEqualExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.GREATER_EQ,
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.GREATER_EQ,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.EqualExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.EQUAL, 
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.EQUAL,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.EqualStrictExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.EQUAL_STRICT, 
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.EQUAL_STRICT,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.NotEqualExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.NOT_EQUAL, 
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.NOT_EQUAL,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.NotEqualStrictExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.NOT_EQUAL_STRICT, 
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.NOT_EQUAL_STRICT,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.BitwiseAndExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.BITWISE_AND, 
			jsc.AST.ExpressionResultKind.Int32,
			jsc.AST.OpCode.BITWISE_AND,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.BitwiseOrExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.BITWISE_OR, 
			jsc.AST.ExpressionResultKind.Int32,
			jsc.AST.OpCode.BITWISE_OR,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.BitwiseXOrExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.BITWISE_XOR, 
			jsc.AST.ExpressionResultKind.Int32,
			jsc.AST.OpCode.BITWISE_XOR,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.BitwiseNotExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.BITWISE_NOT, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Int32);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.UnaryExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, lineNumber, columnNumber, resultKind, expression) {
		$super(kind, lineNumber, columnNumber, resultKind);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.UnaryPlusExpression = Object.define(jsc.AST.UnaryExpression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.UNARY_PLUS, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Number, expression);
	}
});


/** @class */
jsc.AST.NegateExpression = Object.define(jsc.AST.UnaryExpression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.NEGATE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Number, expression);
	}
});


/** @class */
jsc.AST.LogicalNotExpression = Object.define(jsc.AST.UnaryExpression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.LOGICAL_NOT, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Boolean, expression);
	}
});


/** @class */
jsc.AST.LogicalExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, logicalOperator) {
		$super(jsc.AST.NodeKind.LOGICAL_OP, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Boolean);

		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
		this.logicalOperator = logicalOperator;
	}
});


/** @class */
jsc.AST.InExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.IN, 
			jsc.AST.ExpressionResultKind.UNKNOWN,
			jsc.AST.OpCode.IN,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.ResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, position) {
		$super(jsc.AST.NodeKind.RESOLVE, lineNumber, columnNumber);

		this.name = name;
		this.position = position;
	}
});


/** @class */
jsc.AST.TypeOfResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name) {
		$super(jsc.AST.NodeKind.TYPEOF_RESOLVE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.String);

		this.name = name;
	}
});


/** @class */
jsc.AST.TypeOfValueExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.TYPEOF_VALUE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.String);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.InstanceOfExpression = Object.define(jsc.AST.ThrowableBinaryExpression, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			lineNumber,
			columnNumber,
			jsc.AST.NodeKind.INSTANCEOF, 
			jsc.AST.ExpressionResultKind.Boolean,
			jsc.AST.OpCode.INSTANCEOF,
			leftExpression,
			rightExpression,
			rightHasAssignments);
	}
});


/** @class */
jsc.AST.BracketAccessorExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, subscriptHasAssignments) {
		$super(jsc.AST.NodeKind.BRACKET_ACCESSOR, lineNumber, columnNumber);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
	}
});


/** @class */
jsc.AST.DotAccessorExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base) {
		$super(jsc.AST.NodeKind.DOT_ACCESSOR, lineNumber, columnNumber);
		
		this.name = name;
		this.base = base;
	}
});


/** @class */
jsc.AST.AssignBracketExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, subscriptHasAssignments, right, rightHasAssignments, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.ASSIGN_BRACKET, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AssignDotExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, right, rightHasAssignments, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.ASSIGN_DOT, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.base = base;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AssignErrorExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, left, right, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.ASSIGN_ERROR, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.left = left;
		this.right = right;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.AssignResolveExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_RESOLVE, lineNumber, columnNumber);
		
		this.name = name;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.PrePostResolveExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, kind, lineNumber, columnNumber, name, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(kind, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Number, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.PrefixBracketExpression = Object.define(jsc.AST.ThrowablePrefixedSubExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.PREFIX_BRACKET, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.base = base;
		this.subscript = subscript;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PrefixDotExpression = Object.define(jsc.AST.ThrowablePrefixedSubExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.PREFIX_DOT, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.base = base;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PrefixErrorExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, expression, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.PREFIX_ERROR, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.expression = expression;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PrefixResolveExpression = Object.define(jsc.AST.PrePostResolveExpression, {
	initialize: function($super, lineNumber, columnNumber, name, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.PREFIX_RESOLVE, lineNumber, columnNumber, name, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PostfixBracketExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.POSTFIX_BRACKET, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.base = base;
		this.subscript = subscript;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PostfixDotExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.POSTFIX_DOT, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.base = base;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PostfixErrorExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, expression, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.POSTFIX_ERROR, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.expression = expression;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PostfixResolveExpression = Object.define(jsc.AST.PrePostResolveExpression, {
	initialize: function($super, lineNumber, columnNumber, name, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.POSTFIX_RESOLVE, lineNumber, columnNumber, name, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.DeleteBracketExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.DELETE_BRACKET, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.base = base;
		this.subscript = subscript;
	}
});


/** @class */
jsc.AST.DeleteDotExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.DELETE_DOT, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.base = base;
	}
});


/** @class */
jsc.AST.DeleteResolveExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.DELETE_RESOLVE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.DeleteValueExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.DELETE_VALUE, lineNumber, columnNumber);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.ReadModifyBracketExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, subscriptHasAssignments, right, rightHasAssignments, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.READ_MODIFY_BRACKET, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.ReadModifyDotExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, right, rightHasAssignments, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.READ_MODIFY_DOT, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.base = base;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.ReadModifyResolveExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, right, rightHasAssignments, operatorKind, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.READ_MODIFY_RESOLVE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.BracketFunctionCallExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.FUNC_CALL_BRACKET, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.base = base;
		this.subscript = subscript;
		this.args = args;
	}
});


/** @class */
jsc.AST.DotFunctionCallExpression = Object.define(jsc.AST.ThrowableSubExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition, kind) {
		$super(jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.FUNC_CALL_DOT), lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.base = base;
		this.args = args;
	}
});


/** @class */
jsc.AST.ResolveFunctionCallExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, name, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.FUNC_CALL_RESOLVE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.args = args;
	}
});


/** @class */
jsc.AST.ValueFunctionCallExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, expression, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.FUNC_CALL_VALUE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.expression = expression;
		this.args = args;
	}
});


/** @class */
jsc.AST.EvalFunctionCallExpression = Object.define(jsc.AST.ThrowableExpression, {
	initialize: function($super, lineNumber, columnNumber, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.FUNC_CALL_EVAL, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.args = args;
	}
});


/** @class */
jsc.AST.ApplyDotFunctionCallExpression = Object.define(jsc.AST.DotFunctionCallExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(lineNumber, columnNumber, name, base, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition, jsc.AST.NodeKind.FUNCTION_APPLY);
	}
});


/** @class */
jsc.AST.CallDotFunctionCallExpression = Object.define(jsc.AST.DotFunctionCallExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(lineNumber, columnNumber, name, base, args, exceptionDivot, exceptionStartPosition, exceptionEndPosition, jsc.AST.NodeKind.FUNCTION_CALL);
	}
});




//=============================================================================================
// STATEMENT CLASSES
//=============================================================================================

/**
 * The base class for all language statements.
 *
 * @class
 */
jsc.AST.Statement = Object.define(jsc.AST.Node, {
	initialize: function($super, kind, lineNumber, columnNumber) {
		$super(kind, lineNumber, columnNumber);
		
		this.endLine = 0;
	},

	get startLine() {
		return this.lineNumber;
	},
	
	set startLine(value) {
		this.lineNumber = value;
	},

	get isStatement() {
		return true;
	}
});


/** @class */
jsc.AST.ThrowableStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, kind, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(kind, lineNumber, columnNumber);

		this.exceptionDivot = jsc.Utils.valueOrDefault(exceptionDivot, -1);
		this.exceptionStartPosition = jsc.Utils.valueOrDefault(exceptionStartPosition, -1);
		this.exceptionEndPosition = jsc.Utils.valueOrDefault(exceptionEndPosition, -1);
	}
});


/** @class */
jsc.AST.EmptyStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.EMPTY, lineNumber, columnNumber);
	}
});


/** @class */
jsc.AST.ExpressionStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expr) {
		$super(jsc.AST.NodeKind.EXPR_STATEMENT, lineNumber, columnNumber);

		this.expression = expr;
	}
});


/** @class */
jsc.AST.BlockStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, statements) {
		$super(jsc.AST.NodeKind.BLOCK, lineNumber, columnNumber);

		this.statements = statements;
	},
	
	get hasStatements() {
		return (!jsc.Utils.isNull(this.statements) && this.statements.length);
	}
});


/** @class */
jsc.AST.IfStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, conditionExpression, ifBlock, kind) {
		$super(jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.IF), lineNumber, columnNumber);

		this.conditionExpression = conditionExpression;
		this.ifBlock = ifBlock;
	}
});


/** @class */
jsc.AST.IfElseStatement = Object.define(jsc.AST.IfStatement, {
	initialize: function($super, lineNumber, columnNumber, conditionExpression, ifBlock, elseBlock) {
		$super(lineNumber, columnNumber, conditionExpression, ifBlock, jsc.AST.NodeKind.IF_ELSE);

		this.elseBlock = elseBlock;
	}
});


/** @class */
jsc.AST.SwitchStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression, defaultClause, firstClauseList, secondClauseList) {
		$super(jsc.AST.NodeKind.SWITCH, lineNumber, columnNumber);

		this.expression = expression;
		this.defaultClause = defaultClause;
		this.firstClauseList = firstClauseList;
		this.secondClauseList = secondClauseList;
	}
});


/** @class */
jsc.AST.TryStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, exceptionVarName, tryBlock, catchBlock, finallyBlock) {
		$super(jsc.AST.NodeKind.TRY, lineNumber, columnNumber);

		this.exceptionVarName = exceptionVarName;
		this.tryBlock = tryBlock;
		this.catchBlock = catchBlock;
		this.finallyBlock = finallyBlock;
	},
	
	get hasCatchBlock() {
		return !jsc.Utils.isNull(this.catchBlock);
	},
	
	get hasFinallyBlock() {
		return !jsc.Utils.isNull(this.finallyBlock);
	}
});


/** @class */
jsc.AST.ThrowStatement = Object.define(jsc.AST.ThrowableStatement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.THROW, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.ReturnStatement = Object.define(jsc.AST.ThrowableStatement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.RETURN, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.BreakStatement = Object.define(jsc.AST.ThrowableStatement, {
	initialize: function($super, lineNumber, columnNumber, name) {
		$super(jsc.AST.NodeKind.BREAK, lineNumber, columnNumber);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.ContinueStatement = Object.define(jsc.AST.ThrowableStatement, {
	initialize: function($super, lineNumber, columnNumber, name) {
		$super(jsc.AST.NodeKind.CONTINUE, lineNumber, columnNumber);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.DebuggerStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.DEBUGGER, lineNumber, columnNumber);
	}
});


/** @class */
jsc.AST.ConstStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.CONST_STATEMENT, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.VarStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.VAR, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.LabelStatement = Object.define(jsc.AST.ThrowableStatement, {
	initialize: function($super, lineNumber, columnNumber, name, statement) {
		$super(jsc.AST.NodeKind.LABEL, lineNumber, columnNumber);
		
		this.name = name;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.WithStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression, statement, divot, length) {
		$super(jsc.AST.NodeKind.WITH, lineNumber, columnNumber);
		
		this.expression = expression;
		this.statement = statement;
		this.divot = divot;
		this.length = length;
	}
});


/** @class */
jsc.AST.WhileStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression, statement) {
		$super(jsc.AST.NodeKind.WHILE, lineNumber, columnNumber);
		
		this.expression = expression;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.DoWhileStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression, statement) {
		$super(jsc.AST.NodeKind.DO_WHILE, lineNumber, columnNumber);
		
		this.expression = expression;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.ForStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, initializeExpression, conditionExpression, incrementExpression, statement, isFirstExpressionVarDeclaration) {
		$super(jsc.AST.NodeKind.FOR, lineNumber, columnNumber);
		
		this.initializeExpression = initializeExpression;
		this.conditionExpression = conditionExpression;
		this.incrementExpression = incrementExpression;
		this.statement = statement;
		this.isFirstExpressionVarDeclaration = (!jsc.Utils.isNull(initializeExpression) && isFirstExpressionVarDeclaration);
	}
});


/** @class */
jsc.AST.ForInStatement = Object.define(jsc.AST.ThrowableStatement, {
	initialize: function($super, lineNumber, columnNumber, name, nameIsVarDeclaration, initializeExpression, leftExpression, rightExpression, statement, exceptionDivot, exceptionStartPosition, exceptionEndPosition) {
		$super(jsc.AST.NodeKind.FOR_IN, lineNumber, columnNumber, exceptionDivot, exceptionStartPosition, exceptionEndPosition);
		
		this.name = name;
		this.nameIsVarDeclaration = nameIsVarDeclaration;
		this.initializeExpression = initializeExpression;
		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.FunctionDeclarationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, name, functionNode, source, parameters) {
		$super(jsc.AST.NodeKind.FUNCTION_DECL, lineNumber, columnNumber);

		this.functionNode = functionNode;
		this.functionNode.finalize(source, name, parameters, jsc.AST.NodeKind.FUNCTION_DECL);
	}
});


/**
 * The base class for statements that are scoped, i.e. a function
 *
 * @class
 */
jsc.AST.ScopedStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, kind, lineNumber, columnNumber, inStrictMode) {
		$super(kind, lineNumber, columnNumber);
		
		inStrictMode = jsc.Utils.valueOrDefault(inStrictMode, false);
		
		this.features = inStrictMode ? jsc.AST.CodeFeatureFlags.STRICT_MODE : jsc.AST.CodeFeatureFlags.NONE;
		this.source = null;
		this.statements = [];
		this.functions = [];
		this.variables = [];
		this.capturedVariables = [];
		this.constantCount = 0;
	},
	
	get hasCapturedVariables() {
		return (this.capturedVariables && this.capturedVariables.length);
	},
	
	get inStrictMode() {
		return ((this.features & jsc.AST.CodeFeatureFlags.STRICT_MODE) !== jsc.AST.CodeFeatureFlags.NONE);
	},
	
	get usesArguments() {
		return (((this.features & jsc.AST.CodeFeatureFlags.ARGUMENTS) !== jsc.AST.CodeFeatureFlags.NONE) && 
				((this.features & jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS) === jsc.AST.CodeFeatureFlags.NONE));
	},
	
	set usesArguments(value) {
		this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;
	},
	
	get usesEval() {
		return ((this.features & jsc.AST.CodeFeatureFlags.EVAL) !== jsc.AST.CodeFeatureFlags.NONE);
	},
	
	get usesThis() {
		return ((this.features & jsc.AST.CodeFeatureFlags.THIS) !== jsc.AST.CodeFeatureFlags.NONE);
	},
	
	get needsActivation() {
		return (this.hasCapturedVariables || ((this.features & (jsc.AST.CodeFeatureFlags.EVAL | jsc.AST.CodeFeatureFlags.WITH | jsc.AST.CodeFeatureFlags.CATCH)) !== jsc.AST.CodeFeatureFlags.NONE));
	}
});


/** @class */
jsc.AST.EvalStatement = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.EVAL, lineNumber, columnNumber);
	}
});


/**
 * An AST node that represents a function.
 *
 * @class
 */
jsc.AST.FunctionNode = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, lineNumber, columnNumber, inStrictMode) {
		$super(jsc.AST.NodeKind.FUNCTION, lineNumber, columnNumber, inStrictMode);

		this.name = null;
		this.inferredName = null;
		this.parameterNames = null;
		this.hasReturnValue = false;
		this.parentFunction = null;
		this.ownerKind = jsc.AST.NodeKind.UNKNOWN;
	},

	get qualifiedName() {
		var name = jsc.Utils.isStringNullOrEmpty(this.name) ? this.inferredName : this.name;

		if(jsc.Utils.isStringNullOrEmpty(name))
			name = "anonymous";

		if(jsc.Utils.isNull(this.parentFunction))
			return name;

		return this.parentFunction.qualifiedName + "." + name;
	},

	get parameterCount() {
		return (this.parameterNames ? this.parameterNames.length : 0);
	},

	finalize: function(source, name, parameterList, ownerKind) {
		this.source = source;
		this.name = name;
		this.ownerKind = ownerKind;
		this.parameterNames = [];

		for(var p = parameterList; p; p = p.next)
			this.parameterNames.push(p.name);
	}
});


/**
 * An AST node that represents a complete program (script).
 *
 * @class
 */
jsc.AST.ScriptNode = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, source, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.SCRIPT, lineNumber, columnNumber);
		
		this.source = source;
	}
});



//=============================================================================================
// LIST NODE CLASSES
//=============================================================================================

/**
 * Represents a list of arguments.
 *
 * @class
 */
jsc.AST.ArgumentListNode = Object.define(jsc.AST.Node, {
	initialize: function($super, lineNumber, columnNumber, expression, nextNode) {
		$super(jsc.AST.NodeKind.ARGUMENT_LIST, lineNumber, columnNumber);

		this.expression = expression;
		this.next = null;
		
		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	}
});


/**
 * Represents a list of parameters.
 *
 * @class
 */
jsc.AST.ParameterListNode = Object.define({
	initialize: function(name, nextNode) {
		this.name = name;
		this.next = null;
		
		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	}
});


/**
 * Represents property info for an individual property in
 * a jsc.AST.PropertyListNode.
 *
 * @class
 */
jsc.AST.PropertyNode = Object.define({
	initialize: function(name, kindFlags, expr) {
		this.name = (jsc.Utils.isString(name) ? name : name.toString());
		this.flags = kindFlags;
		this.expression = expr;
	},
	
	get isConstant() {
		return (this.flags & jsc.AST.PropertyKindFlags.CONSTANT);
	},
	
	get isGetter() {
		return (this.flags & jsc.AST.PropertyKindFlags.GETTER);
	},
	
	get isSetter() {
		return (this.flags & jsc.AST.PropertyKindFlags.SETTER);
	}
});


/**
 * Represents a list of properties.
 *
 * @class
 */
jsc.AST.PropertyListNode = Object.define(jsc.AST.Node, {
	initialize: function($super, lineNumber, columnNumber, propNode, nextNode) {
		$super(jsc.AST.NodeKind.PROPERTY_LIST, lineNumber, columnNumber);

		this.property = propNode;
		this.next = null;
		
		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	},
	
	get name() {
		return this.property.name;
	}
});


/**
 * Represents one or more case clauses in a switch statement.
 *
 * Example:
 *   case [expression]:
 *   {
 *     [statements];
 *   }
 *   ...
 *
 * @class
 */
jsc.AST.SwitchClauseListNode = Object.define({
	initialize: function(expression, statements, nextNode) {
		this.expression = expression;
		this.statements = statements;
		this.next = null;

		if(!jsc.Utils.isNull(nextNode))
			nextNode.next = this;
	}
});


/**
 * Represents a list of elements within an array.
 *
 * @class
 */
jsc.AST.ArrayElementList = Object.define({
	initialize: function(elision, expr, nextEl) {
		this.elision = elision;
		this.expression = expr;
		this.nextElement = null;
		
		if(!jsc.Utils.isNull(nextEl))
			nextEl.nextElement = this;
	}
});




/**
 * Represents storage for a variable declaration to hold the name
 * of the variable and a set of flags. Used as an element for an
 * array of variable declarations.
 *
 * @class
 */
jsc.AST.VariableDeclaration = Object.define({
	initialize: function(name, flags) {
		this.name = name;
		this.flags = flags;
	}
});

/**
 * Represents a labels name and position within the source text.
 *
 * @class
 */
jsc.AST.LabelInfo = Object.define({
	initialize: function(name, begin, end, columnNumber) {
		this.name = name;
		this.begin = begin;
		this.end = end;
		this.columnNumber = columnNumber;
	}
});


/**
 * Represents the type of value that an expression will most likely
 * produce once the expression has been evaluated.
 *
 * @class
 */
jsc.AST.ExpressionResultKind = Object.define({
	initialize: function(kind) {
		this.kind = jsc.Utils.valueOrDefault(kind, jsc.AST.ExpressionResultKind.NULL);
	},
	
	get isString() {
		return ((this.kind & jsc.AST.ExpressionResultKind.BITS) === jsc.AST.ExpressionResultKind.STRING);
	},
	
	get isInt32() {
		return (this.kind & jsc.AST.ExpressionResultKind.INT32);
	},
	
	get isNumber() {
		return ((this.kind & jsc.AST.ExpressionResultKind.BITS) === jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get isNotNumber() {
		return !this.isMaybeNumber;
	},
	
	get isMaybeNumber() {
		return ((this.kind & jsc.AST.ExpressionResultKind.NUMBER) === jsc.AST.ExpressionResultKind.NUMBER);
	}
});

jsc.AST.ExpressionResultKind.INT32 	= 0x01;
jsc.AST.ExpressionResultKind.NUMBER = 0x04;
jsc.AST.ExpressionResultKind.STRING = 0x08;
jsc.AST.ExpressionResultKind.NULL 	= 0x10;
jsc.AST.ExpressionResultKind.BOOL 	= 0x20;
jsc.AST.ExpressionResultKind.OTHER 	= 0x40;
jsc.AST.ExpressionResultKind.BITS 	= (
	jsc.AST.ExpressionResultKind.NUMBER |
	jsc.AST.ExpressionResultKind.STRING |
	jsc.AST.ExpressionResultKind.NULL |
	jsc.AST.ExpressionResultKind.BOOL |
	jsc.AST.ExpressionResultKind.OTHER);

Object.extend(jsc.AST.ExpressionResultKind, {

	ForAdd: function(lhs, rhs) {
		if(lhs.isNumber && rhs.isNumber)
			return jsc.AST.ExpressionResultKind.Number;
			
		if(lhs.isString || rhs.isString)
			return jsc.AST.ExpressionResultKind.String;

		return jsc.AST.ExpressionResultKind.StringOrNumber;
	},
	
	get Unknown() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.BITS);
	},
	
	get Null() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.NULL);
	},
	
	get Int32() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.INT32 | jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get Number() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get String() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.STRING);
	},
	
	get StringOrNumber() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.STRING | jsc.AST.ExpressionResultKind.NUMBER);
	},
	
	get Boolean() {
		return new jsc.AST.ExpressionResultKind(jsc.AST.ExpressionResultKind.BOOL);
	}
});


/** @class */
jsc.AST.AssignmentInfo = Object.define({
	initialize: function(expr, start, divot, columnNumber, count, op) {
		this.expression = expr;
		this.start = start;
		this.divot = divot;
		this.columnNumber = columnNumber;
		this.count = count;
		this.op = op;
	}
});


/** @class */
jsc.AST.BinaryOperationInfo = Object.define({
	initialize: function(start, divot, end, columnNumber, hasAssignments) {
		this.start = start;
		this.end = end;
		this.divot = divot;
		this.columnNumber = columnNumber;
		this.hasAssignments = hasAssignments;
	}
});

Object.extend(jsc.AST.BinaryOperationInfo, {
	FromBinaryOperations: function(lhs, rhs) {
		var info = new jsc.AST.BinaryOperationInfo();
		info.columnNumber = lhs.columnNumber;
		info.start = lhs.start;
		info.divot = rhs.start;
		info.end = rhs.end;
		info.hasAssignments = (lhs.hasAssignments || rhs.hasAssignments);
		
		return info;
	}
});


/** @class */
jsc.AST.BinaryOperand = Object.define({
	initialize: function(expr, info) {
		this.expression = expr;
		this.info = info;
	}
});


/** @enum */
jsc.AST.OpCode = {};

/** @enum */
jsc.AST.CodeFeatureFlags = {};

/** @enum */
jsc.AST.NodeKind = {};

/** @enum */
jsc.AST.AssignmentOperatorKind = {};

/** @enum */
jsc.AST.LogicalOperatorKind = {
	AND	: 1,
	OR	: 2
};

/** @enum */
jsc.AST.PropertyKindFlags = {
	UNKNOWN	: 0x00,
	CONSTANT: 0x01,
	GETTER	: 0x02,
	SETTER	: 0x04
};

/** @enum */
jsc.AST.VariableFlags = {
	NONE			: 0x00,
	CONSTANT		: 0x01,
	HAS_INITIALIZER	: 0x02
};

jsc.AST.Keyword = {
	BREAK: 		"break",
	CASE: 		"case",
	CATCH: 		"catch",
	CLASS: 		"class",
	CONST: 		"const",
	CONTINUE: 	"continue",
	DEBUGGER: 	"debugger",
	DEFAULT: 	"default",
	DELETE: 	"delete",
	DO: 		"do",
	ELSE: 		"else",
	ENUM: 		"enum",
	EVAL: 		"eval",
	EXPORT: 	"export",
	EXTENDS: 	"extends",
	FALSE: 		"false",
	FINALLY: 	"finally",
	FOR: 		"for",
	FUNCTION: 	"function",
	GET:		"get",
	IF: 		"if",
	IMPLEMENTS:	"implements",
	IMPORT: 	"import",
	IN: 		"in",
	INSTANCEOF:	"instanceof",
	INTERFACE: 	"interface",
	LET: 		"let",
	NEW: 		"new",
	NULL: 		"null",
	PACKAGE: 	"package",
	PRIVATE: 	"private",
	PROTECTED:	"protected",
	PUBLIC: 	"public",
	RETURN: 	"return",
	SET:		"set",
	STATIC: 	"static",
	SUPER: 		"super",
	SWITCH: 	"switch",
	THIS: 		"this",
	THROW: 		"throw",
	TRUE: 		"true",
	TRY: 		"try",
	TYPEOF: 	"typeof",
	VAR: 		"var",
	VOID: 		"void",
	WHILE: 		"while",
	WITH: 		"with",
	YIELD: 		"yield"
};

(function() {

	//
	// NodeKind
	//
	var nodeKinds = [
		"UNKNOWN", "NULL", "BOOLEAN", "NUMBER", "STRING", "REGEX", "THIS", "RESOLVE", "ARRAY", "PROPERTY_LIST", "OBJECT_LITERAL",
		"BRACKET_ACCESSOR", "DOT_ACCESSOR", "ARGUMENT_LIST", "NEW", "FUNC_CALL_VALUE", "FUNC_CALL_RESOLVE", "FUNC_CALL_BRACKET",
		"FUNC_CALL_DOT", "FUNC_CALL_EVAL", "FUNCTION_CALL", "FUNCTION_APPLY", "POSTFIX_RESOLVE", "POSTFIX_BRACKET",
		"POSTFIX_DOT", "POSTFIX_ERROR", "DELETE_RESOLVE", "DELETE_BRACKET", "DELETE_DOT", "DELETE_VALUE", "VOID", "TYPEOF_RESOLVE",
		"TYPEOF_VALUE", "PREFIX_RESOLVE", "PREFIX_BRACKET", "PREFIX_DOT", "PREFIX_ERROR", "UNARY_PLUS", "NEGATE", "LOGICAL_OP",
		"LOGICAL_NOT", "MULTIPLY", "DIVIDE", "MODULUS", "ADD", "SUBTRACT", "LEFT_SHIFT", "RIGHT_SHIFT", "RIGHT_SHIFT_UNSIGNED",
		"LESS", "LESS_EQ", "GREATER", "GREATER_EQ", "INSTANCEOF", "IN", "EQUAL", "EQUAL_STRICT", "NOT_EQUAL", "NOT_EQUAL_STRICT", "BITWISE_AND",
		"BITWISE_OR", "BITWISE_XOR", "BITWISE_NOT", "CONDITIONAL", "READ_MODIFY_RESOLVE", "READ_MODIFY_BRACKET", "READ_MODIFY_DOT", "ASSIGN_RESOLVE",
		"ASSIGN_BRACKET", "ASSIGN_DOT", "ASSIGN_ERROR", "COMMA", "CONST_DECL", "CONST_STATEMENT", "BLOCK", "EMPTY", "DEBUGGER",
		"EXPR_STATEMENT", "VAR", "IF", "IF_ELSE", "DO_WHILE", "WHILE", "FOR", "FOR_IN", "CONTINUE", "BREAK", "RETURN", "WITH", "LABEL",
		"THROW", "TRY", "SCRIPT", "EVAL", "FUNCTION", "FUNCTION_EXPR", "FUNCTION_DECL", "SWITCH"
	];
	
	jsc.Utils.createEnum(-1, nodeKinds, jsc.AST.NodeKind);
	
	
	//
	// AssignmentOperatorKind
	//
	var assignmentOperatorKinds = [
		"EQUAL", "PLUS_EQUAL", "MINUS_EQUAL", "MULTIPLY_EQUAL", "DIVIDE_EQUAL", "PLUS_PLUS", "MINUS_MINUS",
		"AND_EQUAL", "OR_EQUAL", "XOR_EQUAL", "MOD_EQUAL", "LSHIFT_EQUAL", "RSHIFT_EQUAL", "RSHIFT_EQUAL_UNSIGNED"
	];
	
	jsc.Utils.createEnum(1, assignmentOperatorKinds, jsc.AST.AssignmentOperatorKind);
	
	
	//
	// OpCode
	//
	var opCodes = [
		"EQUAL", "NOT_EQUAL", "EQUAL_STRICT", "NOT_EQUAL_STRICT", "LESS", "LESS_EQ", "GREATER", "GREATER_EQ",
		"ADD", "MULTIPLY", "DIVIDE", "MODULUS", "SUBTRACT", "LEFT_SHIFT", "RIGHT_SHIFT", "RIGHT_SHIFT_UNSIGNED",
		"BITWISE_AND", "BITWISE_OR", "BITWISE_XOR", "INSTANCEOF", "IN"
	];
	
	jsc.Utils.createEnum(1, opCodes, jsc.AST.OpCode);
	
	
	//
	// CodeFeatureFlags
	//
	var featureNames = [
		"NONE", "EVAL", "ARGUMENTS", "WITH", "CATCH", "THIS", "STRICT_MODE", "SHADOWS_ARGUMENTS"
	];
	
	jsc.Utils.createEnumFlags(featureNames, jsc.AST.CodeFeatureFlags);
	
	Object.defineProperty(jsc.AST.CodeFeatureFlags, "ALL", {
		value: (jsc.AST.CodeFeatureFlags.EVAL | jsc.AST.CodeFeatureFlags.ARGUMENTS | jsc.AST.CodeFeatureFlags.WITH | jsc.AST.CodeFeatureFlags.CATCH | jsc.AST.CodeFeatureFlags.THIS | jsc.AST.CodeFeatureFlags.STRICT_MODE | jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS),
		enumerable: true,
		configurable: false,
		writable: false
	});


	Object.extend(jsc.AST.NodeKind, {

		getName: function(kind) {
			var kinds = jsc.AST.NodeKind;

			for(var k in kinds)
			{
				if(!kinds.hasOwnProperty(k))
					continue;

				if(kinds[k] === kind)
					return k;
			}

			return "UNKNOWN";
		}
	});
	
	
	// make the enums immutable
	Object.freeze(jsc.AST.NodeKind);
	Object.freeze(jsc.AST.AssignmentOperatorKind);
	Object.freeze(jsc.AST.LogicalOperatorKind);
	Object.freeze(jsc.AST.PropertyKindFlags);
	Object.freeze(jsc.AST.VariableFlags);
	Object.freeze(jsc.AST.OpCode);
	Object.freeze(jsc.AST.CodeFeatureFlags);
})();

module.exports = jsc.AST;