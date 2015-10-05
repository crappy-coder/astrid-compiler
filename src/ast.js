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
		this.functions = [];			// element = jsc.AST.FunctionMetadataNode
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

	createBlockStatement: function(statements, variables, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.BlockStatement(this.lineNumber, columnNumber, statements, variables);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},

	createLabelStatement: function(labelInfo, statement) {
		return new jsc.AST.LabelStatement(this.lineNumber, labelInfo.columnNumber, labelInfo.name, statement);
	},

	createDeclarationStatement: function(expression, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.DeclarationStatement(this.lineNumber, columnNumber, expression);
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
	
	createForStatement: function(initializeExpression, conditionExpression, iteratorExpression, statement, lexicalVariables, beginLine, endLine, columnNumber) {
		var forStatement = new jsc.AST.ForStatement(this.lineNumber, columnNumber, initializeExpression, conditionExpression, iteratorExpression, statement, lexicalVariables);
		this.setStatementLocation(forStatement, beginLine, endLine);

		return forStatement;
	},

	createForInStatement: function(leftExpression, iterationExpression, statement, lexicalVariables, beginLine, endLine, columnNumber) {
		var forInStatement = new jsc.AST.ForInStatement(this.lineNumber, columnNumber, leftExpression, iterationExpression, statement, lexicalVariables);
		this.setStatementLocation(forInStatement, beginLine, endLine);

		return forInStatement;
	},

	createForOfStatement: function(leftExpression, iterationExpression, statement, lexicalVariables, beginLine, endLine, columnNumber) {
		var forInStatement = new jsc.AST.ForOfStatement(this.lineNumber, columnNumber, leftExpression, iterationExpression, statement, lexicalVariables);
		this.setStatementLocation(forInStatement, beginLine, endLine);

		return forInStatement;
	},

	createContinueStatement: function(name, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ContinueStatement(this.lineNumber, columnNumber, name);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createBreakStatement: function(name, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.BreakStatement(this.lineNumber, columnNumber, name);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createReturnStatement: function(expression, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ReturnStatement(this.lineNumber, columnNumber, expression);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createThrowStatement: function(expression, start, end, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.ThrowStatement(this.lineNumber, columnNumber, expression);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createDebuggerStatement: function(beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.DebuggerStatement(this.lineNumber, columnNumber);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createTryStatement: function(thrownVariableName, tryStatement, catchStatement, finallyStatement, catchVariables, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.TryStatement(this.lineNumber, columnNumber, thrownVariableName, tryStatement, catchStatement, finallyStatement, catchVariables);
		this.setStatementLocation(statement, beginLine, endLine);

		if(jsc.Utils.isNotNull(catchStatement))
			this.features |= jsc.AST.CodeFeatureFlags.CATCH;

		return statement;
	},

	createWithStatement: function(expression, statement, start, end, beginLine, endLine, columnNumber) {
		var withStatement = new jsc.AST.WithStatement(this.lineNumber, columnNumber, expression, statement, end, end - start);
		this.setStatementLocation(withStatement, beginLine, endLine);

		this.features |= jsc.AST.CodeFeatureFlags.WITH;

		return withStatement;
	},
	
	createSwitchStatement: function(expression, defaultClause, firstClauseList, secondClauseList, variables, beginLine, endLine, columnNumber) {
		var statement = new jsc.AST.SwitchStatement(this.lineNumber, columnNumber, expression, defaultClause, firstClauseList, secondClauseList, variables);
		this.setStatementLocation(statement, beginLine, endLine);

		return statement;
	},
	
	createSwitchClauseList: function(expression, statements, tail) {
		return new jsc.AST.SwitchClauseListNode(expression, statements, tail);
	},

	createFunctionDeclarationStatement: function(name, body, begin, end, beginLine, endLine, bodyBeginColumn, columnNumber) {
		var subSource = this.source.toSourceCode(begin, end, beginLine);
		var funcDecl = new jsc.AST.FunctionDeclarationStatement(this.lineNumber, columnNumber, name, body, subSource);

		this.setStatementLocation(body, beginLine, endLine);

		if(name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;

		this.functions.push(body);

		return funcDecl;
	},
		


	//=============================================================================================
	// CREATE EXPRESSIONS
	//=============================================================================================

	createAssignmentExpression: function(expression, initialCount, currentCount) {
		var info = this.assignmentStack[this.assignmentStack.length-1];
		var expr = this.createAssignment(info.op, info.expression, expression, info.count !== initialCount, info.count !== currentCount, info.columnNumber);

		this.assignmentStack.pop();
		
		return expr;
	},

	createAssignment: function(op, leftExpression, rightExpression, leftHasAssignments, rightHasAssignments, columnNumber) {

		if(!leftExpression.isLocation)
			return new jsc.AST.AssignErrorExpression(this.lineNumber, columnNumber, leftExpression, rightExpression, op);

		// resolve expression
		if(leftExpression.isResolve)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
			{
				if(rightExpression.isFunctionExpression)
					rightExpression.metadata.inferredName = leftExpression.name;

				return new jsc.AST.AssignResolveExpression(this.lineNumber, columnNumber, leftExpression.name, rightExpression, rightHasAssignments);
			}

			return new jsc.AST.ReadModifyResolveExpression(this.lineNumber, columnNumber, leftExpression.name, rightExpression, rightHasAssignments, op);
		}


		// bracket expression
		if(leftExpression.isBracketAccessor)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
				return new jsc.AST.AssignBracketExpression(this.lineNumber, columnNumber, leftExpression.base, leftExpression.subscript, leftHasAssignments, rightExpression, rightHasAssignments);

			return new jsc.AST.ReadModifyBracketExpression(this.lineNumber, columnNumber, leftExpression.base, leftExpression.subscript, leftHasAssignments, rightExpression, rightHasAssignments, op);
		}


		// dot expression
		if(leftExpression.isDotAccessor)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
			{
				if(rightExpression.isFunctionExpression)
					rightExpression.metadata.inferredName = leftExpression.name;

				return new jsc.AST.AssignDotExpression(this.lineNumber, columnNumber, leftExpression.name, leftExpression.base, rightExpression, rightHasAssignments);
			}

			return new jsc.AST.ReadModifyDotExpression(this.lineNumber, columnNumber, leftExpression.name, leftExpression.base, rightExpression, rightHasAssignments, op);
		}


		throw new Error("Invalid assignment expression.");
	},
	
	createAssignResolveExpression: function(name, rightExpression, rightHasAssignments, columnNumber) {
		if(rightExpression.isFunctionExpression)
			rightExpression.metadata.inferredName = name;

		return new jsc.AST.AssignResolveExpression(this.lineNumber, columnNumber, name, rightExpression, rightHasAssignments);
	},

	createDestructuringAssignmentExpression: function(pattern, initializer, columnNumber) {
		return new jsc.AST.DestructuringAssignmentExpression(this.lineNumber, columnNumber, pattern, initializer);
	},

	createArrowFunctionExpression: function(name, body, begin, end, beginLine, endLine, bodyBeginColumn, columnNumber) {
		var subSource = this.source.toSourceCode(begin, (body.isArrowFunctionBodyExpression ? end - 1 : end), beginLine);
		var funcExpr = new jsc.AST.ArrowFunctionExpression(this.lineNumber, columnNumber, name, body, subSource);

		this.features |= jsc.AST.CodeFeatureFlags.THIS;

		return funcExpr;
	},

	createResolveExpression: function(name, position, columnNumber) {
		if(name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;

		return new jsc.AST.ResolveExpression(this.lineNumber, columnNumber, name, position);
	},

	createEmptyDeclarationExpression: function(name, declarationKind, beginLine, columnNumber) {
		return new jsc.AST.EmptyDeclarationExpression(this.lineNumber, columnNumber, name, declarationKind);
	},

	createConditionalExpression: function(conditionExpression, leftExpression, rightExpression, columnNumber) {
		return new jsc.AST.ConditionalExpression(this.lineNumber, columnNumber, conditionExpression, leftExpression, rightExpression);
	},
	
	createPrefixExpression: function(expression, op, columnNumber) {
		return new jsc.AST.PrefixExpression(this.lineNumber, columnNumber, expression, op);
	},
	
	createPostfixExpression: function(expression, op, columnNumber) {
		return new jsc.AST.PostfixExpression(this.lineNumber, columnNumber, expression, op);
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
	
	createDeleteExpression: function(expression, columnNumber) {
		if(!expression.isLocation)
			return new jsc.AST.DeleteValueExpression(this.lineNumber, columnNumber, expression);

		if(expression.isResolve)
			return new jsc.AST.DeleteResolveExpression(this.lineNumber, columnNumber, expression.name);

		if(expression.isBracketAccessor)
			return new jsc.AST.DeleteBracketExpression(this.lineNumber, columnNumber, expression.base, expression.subscript);

		if(expression.isDotAccessor)
			return new jsc.AST.DeleteDotExpression(this.lineNumber, columnNumber, expression.name, expression.base);

		throw new Error("Invalid delete expression.");
	},
	
	createThisExpression: function(columnNumber) {
		this.features |= jsc.AST.CodeFeatureFlags.THIS;

		return new jsc.AST.ThisExpression(this.lineNumber, columnNumber);
	},

	createSuperExpression: function(columnNumber) {
		return new jsc.AST.SuperExpression(this.lineNumber, columnNumber);
	},

	createNewExpression: function(expression, columnNumber) {
		return new jsc.AST.NewExpression(this.lineNumber, columnNumber, expression);
	},
	
	createNewExpressionWithArguments: function(expression, argumentList, columnNumber) {
		return new jsc.AST.NewExpression(this.lineNumber, columnNumber, expression, argumentList);
	},

	createNewTargetExpression: function(columnNumber) {
		return new jsc.AST.NewTargetExpression(this.lineNumber, columnNumber);
	},

	createFunctionExpression: function(name, body, begin, end, beginLine, endLine, bodyBeginColumn, columnNumber) {
		return new jsc.AST.FunctionExpression(this.lineNumber, columnNumber, name, body, this.source.toSourceCode(begin, end, beginLine));
	},

	createFunctionCallExpression: function(expression, argumentList, columnNumber) {
		if(!expression.isLocation)
			return new jsc.AST.ValueFunctionCallExpression(this.lineNumber, columnNumber, expression, argumentList);

		if(expression.isResolve)
		{
			if(expression.name === "eval")
			{
				this.features |= jsc.AST.CodeFeatureFlags.EVAL;
				this.evalCount++;

				return new jsc.AST.EvalFunctionCallExpression(this.lineNumber, columnNumber, argumentList);
			}

			return new jsc.AST.ResolveFunctionCallExpression(this.lineNumber, columnNumber, expression.name, argumentList);
		}

		if(expression.isBracketAccessor)
			return new jsc.AST.BracketFunctionCallExpression(this.lineNumber, columnNumber, expression.base, expression.subscript, argumentList);

		if(expression.isDotAccessor)
		{
			if(expression.name === "call")
				return new jsc.AST.CallDotFunctionCallExpression(this.lineNumber, columnNumber, expression.name, expression.base, argumentList);

			if(expression.name === "apply")
				return new jsc.AST.ApplyDotFunctionCallExpression(this.lineNumber, columnNumber, expression.name, expression.base, argumentList);

			return new jsc.AST.DotFunctionCallExpression(this.lineNumber, columnNumber, expression.name, expression.base, argumentList);
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

	createBracketAccessorExpression: function(base, subscript, subscriptHasAssignments, columnNumber) {
		return new jsc.AST.BracketAccessorExpression(this.lineNumber, columnNumber, base, subscript, subscriptHasAssignments);
	},

	createDotAccessorExpression: function(propertyName, baseExpression, columnNumber) {
		return new jsc.AST.DotAccessorExpression(this.lineNumber, columnNumber, propertyName, baseExpression);
	},
	
	createStringExpression: function(value, columnNumber) {
		this.constantCount++;

		return new jsc.AST.StringExpression(this.lineNumber, columnNumber, value);
	},
	
	createDoubleExpression: function(value, columnNumber) {
		this.constantCount++;

		return new jsc.AST.DoubleExpression(this.lineNumber, columnNumber, value);
	},

	createIntegerExpression: function(value, columnNumber) {
		this.constantCount++;

		return new jsc.AST.IntegerExpression(this.lineNumber, columnNumber, value);
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
		return new jsc.AST.RegExExpression(this.lineNumber, columnNumber, pattern, flags);
	},
	
	createCommaExpression: function(expression, columnNumber) {
		var commaExpression = new jsc.AST.CommaExpression(this.lineNumber, columnNumber);
		commaExpression.append(expression);

		return commaExpression;
	},

	createSpreadExpression: function(expression, columnNumber) {
		return new jsc.AST.SpreadExpression(this.lineNumber, columnNumber, expression);
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
				return new jsc.AST.InExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.INSTANCEOF:
				return new jsc.AST.InstanceOfExpression(this.lineNumber, columnNumber, lhsExpr, rhsExpr, rhsHasAssignment);

			default:
				throw new Error("Unknown binary expression operation. Operation Kind='" + jsc.Token.getName(operatorTokenKind) + "'.");
		}
	},


	//=============================================================================================
	// CREATE OTHER NODES
	//=============================================================================================

	createFunctionParameterList: function() {
		return new jsc.AST.FunctionParameterList();
	},

	createFunctionMetadata: function(begin, end, beginColumn, endColumn, keywordBegin, nameBegin, parametersBegin, parameterCount, inStrictMode, isArrowFunction, isArrowFunctionExpression) {
		var metadata = new jsc.AST.FunctionMetadataNode(this.lineNumber, beginColumn, endColumn, inStrictMode);

		metadata.nameBegin = nameBegin;
		metadata.keywordBegin = keywordBegin;
		metadata.parametersBegin = parametersBegin;
		metadata.parameterCount = parameterCount;
		metadata.begin = begin;
		metadata.end = end;
		metadata.isArrowFunction = isArrowFunction;
		metadata.isArrowFunctionBodyExpression = isArrowFunctionExpression;

		return metadata;
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
	
	createProperty: function(nameOrNameExpression, expression, flags, putKind, needsSuperBinding) {
		needsSuperBinding = jsc.Utils.valueOrDefault(needsSuperBinding, false);

		if(jsc.Utils.isString(nameOrNameExpression) && expression.isFunctionExpression)
			expression.metadata.inferredName = nameOrNameExpression;

		return new jsc.AST.PropertyNode(nameOrNameExpression, expression, flags, putKind, needsSuperBinding);
	},

	createGetterOrSetterProperty: function(propertyName, kindFlags, needsSuperBinding, body, begin, end, beginLine, endLine, bodyBeginColumn, columnNumber) {
		if(jsc.Utils.isString(propertyName))
			body.inferredName = propertyName;

		var functionExpression = new jsc.AST.FunctionExpression(this.lineNumber, columnNumber, null, body, this.source.toSourceCode(begin, end, beginLine));

		return new jsc.AST.PropertyNode(propertyName, functionExpression, kindFlags, jsc.AST.PropertyPutKind.UNKNOWN, needsSuperBinding);
	},

	createArrayPattern: function(columnNumber) {
		return new jsc.AST.ArrayPatternNode(this.lineNumber, columnNumber);
	},

	createObjectPattern: function(columnNumber) {
		return new jsc.AST.ObjectPatternNode(this.lineNumber, columnNumber);
	},

	createBindingPattern: function(boundName, bindingContextKind, columnNumber) {
		return new jsc.AST.BindingPatternNode(this.lineNumber, columnNumber, boundName, bindingContextKind);
	},


	//=============================================================================================
	// CONTEXT STATE / UTILS
	//=============================================================================================

	combineCommaExpressions: function(list, expression, columnNumber) {
		if(jsc.Utils.isNull(list))
			return expression;

		if(list.kind === jsc.AST.NodeKind.COMMA)
		{
			list.append(expression);
			return list;
		}

		var commaExpression = this.createCommaExpression(list, columnNumber);
		commaExpression.append(expression);

		return commaExpression;
	},

	stripUnaryPlusExpression: function(expression) {
		return (expression.kind === jsc.AST.NodeKind.UNARY_PLUS ? expression.expression : expression);
	},
	
	precedenceIsLowerThanOperatorStack: function(precedence) {
		return (precedence <= this.binaryOperatorStack[this.binaryOperatorStack.length-1][1]);
	},

	// TODO: remove start/divot
	appendAssignment: function(expr, start, divot, columnNumber, count, op) {
		this.assignmentStack.push(new jsc.AST.AssignmentInfo(expr, start, divot, columnNumber, count, op));
	},

	// TODO: remove start/divot/end
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
		var rhs = this.binaryOperandStack.pop();
		var lhs = this.binaryOperandStack.pop();

		operationState.operandDepth -= 2;
		
		if(operationState.operandDepth < 0)
			throw new Error("Not enough binary operands on the stack.");

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
		this.startOffset = 0;
		this.endOffset = 0;
	},

	get isExpression() {
		return false;
	},

	get isStatement() {
		return false;
	},

	get isEmpty() {
		return (this.kind === jsc.AST.NodeKind.EMPTY);
	},

	get isEmptyDeclaration() {
		return (this.kind === jsc.AST.NodeKind.EMPTY_DECL);
	},

	get isComma() {
		return (this.kind === jsc.AST.NodeKind.COMMA);
	},

	get isSuper() {
		return (this.kind === jsc.AST.NodeKind.SUPER);
	},

	get isThis() {
		return (this.kind === jsc.AST.NodeKind.THIS);
	},

	get isDouble() {
		return (this.kind === jsc.AST.NodeKind.DOUBLE);
	},

	get isInteger() {
		return (this.kind === jsc.AST.NodeKind.INTEGER);
	},

	get isNumber() {
		return (this.isDouble || this.isInteger);
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

	get isArray() {
		return (this.kind === jsc.AST.NodeKind.ARRAY);
	},

	get isConstant() {
		return (this.isNumber || this.isBoolean || this.isString || this.kind === jsc.AST.NodeKind.NULL);
	},

	get isLocation() {
		return (this.isResolve || this.isBracketAccessor || this.isDotAccessor);
	},

	get isAssignmentLocation() {
		return (this.isDestructuring || (!this.isDestructuring && this.isLocation));
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

	get isDestructuring() {
		return (this.kind === jsc.AST.NodeKind.DS_ASSIGN);
	},

	get isDestructuringPattern() {
		return (this.kind === jsc.AST.NodeKind.ARRAY_PATTERN || this.kind === jsc.AST.NodeKind.BINDING_PATTERN || this.kind === jsc.AST.NodeKind.OBJECT_PATTERN);
	},

	get isBindingPattern() {
		return (this.kind === jsc.AST.NodeKind.BINDING_PATTERN);
	},

	get isSpread() {
		return (this.kind === jsc.AST.NodeKind.SPREAD);
	},

	get isFunctionDeclaration() {
		return (this.kind === jsc.AST.NodeKind.FUNCTION_DECL);
	},

	get isFunctionExpression() {
		return (this.kind === jsc.AST.NodeKind.FUNCTION_EXPR);
	},

	get isArrowFunctionExpression() {
		return (this.kind === jsc.AST.NodeKind.FUNCTION_EXPR_ARROW);
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
jsc.AST.EmptyDeclarationExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, declarationKind) {
		$super(jsc.AST.NodeKind.EMPTY_DECL, lineNumber, columnNumber);

		this.name = name;
		this.declarationKind = declarationKind;
	}
});


/** @class */
jsc.AST.NewExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression, args) {
		$super(jsc.AST.NodeKind.NEW, lineNumber, columnNumber);
		
		this.expression = expression;
		this.args = args;
	}
});


/** @class */
jsc.AST.NewTargetExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.NEW_TARGET, lineNumber, columnNumber);
	}
});


/** @class */
jsc.AST.CommaExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.COMMA, lineNumber, columnNumber);

		this.expressions = [];
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
jsc.AST.SuperExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.SUPER, lineNumber, columnNumber);
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
jsc.AST.ConstantExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, lineNumber, columnNumber, resultKind) {
		$super(kind, lineNumber, columnNumber, resultKind);
	}
});


/** @class */
jsc.AST.NullExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.NULL, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Null);
	}
});


/** @class */
jsc.AST.BooleanExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.BOOLEAN, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Boolean);

		this.value = value;
	}
});


/** @class */
jsc.AST.NumberExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, kind, lineNumber, columnNumber, resultKind, value) {
		$super(kind, lineNumber, columnNumber, resultKind);

		this.value = value;
	}
});


/** @class */
jsc.AST.DoubleExpression = Object.define(jsc.AST.NumberExpression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.DOUBLE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Number, value);
	}
});


/** @class */
jsc.AST.IntegerExpression = Object.define(jsc.AST.NumberExpression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.INTEGER, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Int32, value);
	}
});


/** @class */
jsc.AST.StringExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, lineNumber, columnNumber, value) {
		$super(jsc.AST.NodeKind.STRING, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.String);

		this.value = value;
		this.isDirective = false;
	}
});


/** @class */
jsc.AST.RegExExpression = Object.define(jsc.AST.Expression, {
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
jsc.AST.BaseFunctionExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, lineNumber, columnNumber, name, metadata, source) {
		$super(kind, lineNumber, columnNumber);

		this.metadata = metadata;
		this.metadata.finalize(source, name, jsc.AST.FunctionMode.EXPRESSION);
	}
});


/** @class */
jsc.AST.FunctionExpression = Object.define(jsc.AST.BaseFunctionExpression, {
	initialize: function($super, lineNumber, columnNumber, name, metadata, source) {
		$super(jsc.AST.NodeKind.FUNCTION_EXPR, lineNumber, columnNumber, name, metadata, source);
	}
});


/** @class */
jsc.AST.ArrowFunctionExpression = Object.define(jsc.AST.BaseFunctionExpression, {
	initialize: function($super, lineNumber, columnNumber, name, metadata, source) {
		$super(jsc.AST.NodeKind.FUNCTION_EXPR_ARROW, lineNumber, columnNumber, name, metadata, source);
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
jsc.AST.EqualExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.EqualStrictExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.NotEqualExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.NotEqualStrictExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.BitwiseAndExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.BitwiseOrExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.BitwiseXOrExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.InExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.InstanceOfExpression = Object.define(jsc.AST.BinaryExpression, {
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
jsc.AST.BracketAccessorExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, subscriptHasAssignments) {
		$super(jsc.AST.NodeKind.BRACKET_ACCESSOR, lineNumber, columnNumber);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
	}
});


/** @class */
jsc.AST.DotAccessorExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, base) {
		$super(jsc.AST.NodeKind.DOT_ACCESSOR, lineNumber, columnNumber);
		
		this.name = name;
		this.base = base;
	}
});


/** @class */
jsc.AST.AssignBracketExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, subscriptHasAssignments, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_BRACKET, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AssignDotExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, base, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_DOT, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.name = name;
		this.base = base;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AssignErrorExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, left, right, operatorKind) {
		$super(jsc.AST.NodeKind.ASSIGN_ERROR, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.left = left;
		this.right = right;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.AssignResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_RESOLVE, lineNumber, columnNumber);
		
		this.name = name;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.PrePostfixExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, lineNumber, columnNumber, expression, operatorKind) {
		$super(kind, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.Number);
		
		this.expression = expression;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PrefixExpression = Object.define(jsc.AST.PrePostfixExpression, {
	initialize: function($super, lineNumber, columnNumber, expression, operatorKind) {
		$super(jsc.AST.NodeKind.PREFIX, lineNumber, columnNumber, expression, operatorKind);
	}
});


/** @class */
jsc.AST.PostfixExpression = Object.define(jsc.AST.PrePostfixExpression, {
	initialize: function($super, lineNumber, columnNumber, expression, operatorKind) {
		$super(jsc.AST.NodeKind.POSTFIX, lineNumber, columnNumber, expression, operatorKind);
	}
});


/** @class */
jsc.AST.DeleteBracketExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript) {
		$super(jsc.AST.NodeKind.DELETE_BRACKET, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.base = base;
		this.subscript = subscript;
	}
});


/** @class */
jsc.AST.DeleteDotExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, base) {
		$super(jsc.AST.NodeKind.DELETE_DOT, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.name = name;
		this.base = base;
	}
});


/** @class */
jsc.AST.DeleteResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name) {
		$super(jsc.AST.NodeKind.DELETE_RESOLVE, lineNumber, columnNumber, jsc.AST.ExpressionResultKind.UNKNOWN);
		
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
jsc.AST.ReadModifyBracketExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, subscriptHasAssignments, right, rightHasAssignments, operatorKind) {
		$super(jsc.AST.NodeKind.READ_MODIFY_BRACKET, lineNumber, columnNumber);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.ReadModifyDotExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, base, right, rightHasAssignments, operatorKind) {
		$super(jsc.AST.NodeKind.READ_MODIFY_DOT, lineNumber, columnNumber);
		
		this.name = name;
		this.base = base;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.ReadModifyResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, right, rightHasAssignments, operatorKind) {
		$super(jsc.AST.NodeKind.READ_MODIFY_RESOLVE, lineNumber, columnNumber);
		
		this.name = name;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.BracketFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, base, subscript, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_BRACKET, lineNumber, columnNumber);
		
		this.base = base;
		this.subscript = subscript;
		this.args = args;
	}
});


/** @class */
jsc.AST.DotFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, base, args, kind) {
		$super(jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.FUNC_CALL_DOT), lineNumber, columnNumber);
		
		this.name = name;
		this.base = base;
		this.args = args;
	}
});


/** @class */
jsc.AST.ResolveFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, name, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_RESOLVE, lineNumber, columnNumber);
		
		this.name = name;
		this.args = args;
	}
});


/** @class */
jsc.AST.ValueFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_VALUE, lineNumber, columnNumber);
		
		this.expression = expression;
		this.args = args;
	}
});


/** @class */
jsc.AST.EvalFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_EVAL, lineNumber, columnNumber);
		
		this.args = args;
	}
});


/** @class */
jsc.AST.ApplyDotFunctionCallExpression = Object.define(jsc.AST.DotFunctionCallExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, args) {
		$super(lineNumber, columnNumber, name, base, args, jsc.AST.NodeKind.FUNCTION_APPLY);
	}
});


/** @class */
jsc.AST.CallDotFunctionCallExpression = Object.define(jsc.AST.DotFunctionCallExpression, {
	initialize: function($super, lineNumber, columnNumber, name, base, args) {
		$super(lineNumber, columnNumber, name, base, args, jsc.AST.NodeKind.FUNCTION_CALL);
	}
});


/** @class */
jsc.AST.SpreadExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.SPREAD, lineNumber, columnNumber);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.DestructuringAssignmentExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, lineNumber, columnNumber, bindingPattern, initializeExpression) {
		$super(jsc.AST.NodeKind.EMPTY_DECL, lineNumber, columnNumber);

		this.bindingPattern = bindingPattern;
		this.initializeExpression = initializeExpression;
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
	initialize: function($super, lineNumber, columnNumber, statements, variables) {
		$super(jsc.AST.NodeKind.BLOCK, lineNumber, columnNumber);

		this.statements = statements;
		this.variables = variables.clone();
	},

	get hasStatements() {
		return jsc.Utils.isNotNull(this.statements) && this.statements.length;
	},

	get hasVariables() {
		return !!this.variables.count;
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
	initialize: function($super, lineNumber, columnNumber, expression, defaultClause, firstClauseList, secondClauseList, variables) {
		$super(jsc.AST.NodeKind.SWITCH, lineNumber, columnNumber);

		this.expression = expression;
		this.defaultClause = defaultClause;
		this.firstClauseList = firstClauseList;
		this.secondClauseList = secondClauseList;
		this.variables = variables.clone();
	}
});


/** @class */
jsc.AST.TryStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, thrownVariableName, tryBlock, catchBlock, finallyBlock, catchVariables) {
		$super(jsc.AST.NodeKind.TRY, lineNumber, columnNumber);

		this.thrownVariableName = thrownVariableName;
		this.tryBlock = tryBlock;
		this.finallyBlock = finallyBlock;
		this.catchBlock = catchBlock;
		this.catchVariables = catchVariables.clone();
	},

	get hasCatchVariables() {
		return !!this.catchVariables.count;
	},
	
	get hasCatchBlock() {
		return !jsc.Utils.isNull(this.catchBlock);
	},
	
	get hasFinallyBlock() {
		return !jsc.Utils.isNull(this.finallyBlock);
	}
});


/** @class */
jsc.AST.ThrowStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.THROW, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.ReturnStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.RETURN, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.BreakStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, name) {
		$super(jsc.AST.NodeKind.BREAK, lineNumber, columnNumber);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.ContinueStatement = Object.define(jsc.AST.Statement, {
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
jsc.AST.DeclarationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, expression) {
		$super(jsc.AST.NodeKind.DECL_STATEMENT, lineNumber, columnNumber);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.LabelStatement = Object.define(jsc.AST.Statement, {
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
jsc.AST.EnumerationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, kind, lineNumber, columnNumber, leftExpression, expression, statement, variables) {
		$super(kind, lineNumber, columnNumber);

		this.leftExpression = leftExpression;
		this.expression = expression;
		this.statement = statement;
		this.variables = variables.clone();
	}
});


/** @class */
jsc.AST.ForInStatement = Object.define(jsc.AST.EnumerationStatement, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, expression, statement, variables) {
		$super(jsc.AST.NodeKind.FOR_IN, lineNumber, columnNumber, leftExpression, expression, statement, variables);
	}
});


/** @class */
jsc.AST.ForOfStatement = Object.define(jsc.AST.EnumerationStatement, {
	initialize: function($super, lineNumber, columnNumber, leftExpression, expression, statement, variables) {
		$super(jsc.AST.NodeKind.FOR_OF, lineNumber, columnNumber, leftExpression, expression, statement, variables);
	}
});


/** @class */
jsc.AST.ForStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, initializeExpression, conditionExpression, incrementExpression, statement, variables) {
		$super(jsc.AST.NodeKind.FOR, lineNumber, columnNumber);
		
		this.initializeExpression = initializeExpression;
		this.conditionExpression = conditionExpression;
		this.incrementExpression = incrementExpression;
		this.statement = statement;
		this.variables = variables.clone();
	}
});


/** @class */
jsc.AST.FunctionDeclarationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, lineNumber, columnNumber, name, body, source) {
		$super(jsc.AST.NodeKind.FUNCTION_DECL, lineNumber, columnNumber);

		this.metadata = body;
		this.metadata.finalize(source, name, jsc.AST.FunctionMode.DECLARATION);
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
		this.variableDeclarations = jsc.VariableEnvironment.Empty;
		this.variables = jsc.VariableEnvironment.Empty;
		this.constantCount = 0;
	},
	
	get hasCapturedVariables() {
		return this.variableDeclarations.hasCaptures;
	},
	
	get inStrictMode() {
		return !!(this.features & jsc.AST.CodeFeatureFlags.STRICT_MODE);
	},

	get usesArguments() {
		return (!!(this.features & jsc.AST.CodeFeatureFlags.ARGUMENTS)) && !(this.features & jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS);
	},
	set usesArguments(value) {
		this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;
	},
	
	get usesEval() {
		return !!(this.features & jsc.AST.CodeFeatureFlags.EVAL);
	},
	
	get usesThis() {
		return !!(this.features & jsc.AST.CodeFeatureFlags.THIS);
	},

	get modifiesParameter() {
		return !!(this.features & jsc.AST.CodeFeatureFlags.MODIFIED_PARAMETER);
	},

	get modifiesArguments() {
		return !!(this.features & jsc.AST.CodeFeatureFlags.MODIFIED_ARGUMENTS);
	},

	captures: function(name) {
		return this.variableDeclarations.captures(name);
	}
});


/** @class */
jsc.AST.EvalStatement = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.EVAL, lineNumber, columnNumber);
	}
});


/**
 * An AST node that represents a complete program (script).
 *
 * @class
 */
jsc.AST.ScriptNode = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, source, lineNumber, columnNumber, inStrictMode) {
		$super(jsc.AST.NodeKind.SCRIPT, lineNumber, columnNumber, inStrictMode);
		
		this.source = source;
	}
});



//=============================================================================================
// OTHER NODE CLASSES
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
 * Represents an entry in the FunctionParameterList target patterns.
 *
 * @class
 */
jsc.AST.FunctionParameterNode = Object.define({
	initialize: function(kind, pattern, defaultValue) {
		this.kind = kind;
		this.pattern = pattern;
		this.defaultValue = defaultValue;
	}
});


/**
 * Represents a list of function parameters.
 *
 * @class
 */
jsc.AST.FunctionParameterList = Object.define({
	initialize: function() {
		this.parameters = [];
		this.hasDefaultParameterValues = false;
	},

	append: function(kind, patternNode, defaultValue) {
		this.parameters.push(new jsc.AST.FunctionParameterNode(kind, patternNode, defaultValue));

		if(!jsc.Utils.isNull(defaultValue))
			this.hasDefaultParameterValues = true;
	}
});


/**
 * Represents a functions metadata.
 *
 * @class
 */
jsc.AST.FunctionMetadataNode = Object.define(jsc.AST.Node, {
	initialize: function($super, lineNumber, beginColumn, endColumn, inStrictMode) {
		$super(jsc.AST.NodeKind.FUNCTION_METADATA, lineNumber, beginColumn);

		this.name = null;
		this.nameBegin = 0;
		this.beginColumn = beginColumn;
		this.endColumn = endColumn;
		this.inStrictMode = inStrictMode;
		this.keywordBegin = 0;
		this.parametersBegin = 0;
		this.begin = 0;
		this.end = 0;
		this.parameterCount = 0;
		this.lastLine = 0;
		this.isArrowFunction = false;
		this.isArrowFunctionBodyExpression = false;
		this.mode = jsc.AST.FunctionMode.DECLARATION;
		this.source = null;
		this.state = {
			inferredName: null
		};
	},

	get inferredName() {
		return (jsc.Utils.isStringNullOrEmpty(this.state.inferredName) ? this.name : this.state.inferredName);
	},

	set inferredName(value) {
		this.state.inferredName = value;
	},

	finalize: function(source, name, mode) {
		this.source = source;
		this.name = name;
		this.mode = mode;
	}
});


/**
 * Represents property info for an individual property in
 * a jsc.AST.PropertyListNode.
 *
 * @class
 */
jsc.AST.PropertyNode = Object.define({
	initialize: function(nameOrNameExpression, expression, kindFlags, putKind, needsSuperBinding) {
		this.name = (jsc.Utils.isString(nameOrNameExpression) ? nameOrNameExpression : null);
		this.expressionName = (jsc.Utils.isObject(nameOrNameExpression) ? nameOrNameExpression : null);
		this.expression = expression;
		this.flags = kindFlags;
		this.putKind = putKind;
		this.needsSuperBinding = jsc.Utils.valueOrDefault(needsSuperBinding, false);
	},
	
	get isConstant() {
		return !!(this.flags & jsc.AST.PropertyKindFlags.CONSTANT);
	},

	get isGetter() {
		return !!(this.flags & jsc.AST.PropertyKindFlags.GETTER);
	},
	
	get isSetter() {
		return !!(this.flags & jsc.AST.PropertyKindFlags.SETTER);
	},

	get isGetterOrSetter() {
		return (this.isGetter || this.isSetter);
	},

	get isComputed() {
		return !!(this.flags & jsc.AST.PropertyKindFlags.COMPUTED);
	},

	get isShorthand() {
		return !!(this.flags & jsc.AST.PropertyKindFlags.SHORTHAND);
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
 * Represents the base destructuring pattern node.
 *
 * @class
 */
jsc.AST.DestructuringPatternNode = Object.define(jsc.AST.Node, {
	initialize: function($super, kind, lineNumber, columnNumber) {
		$super(kind, lineNumber, columnNumber);
	}
});


/**
 * Represents the an array pattern node.
 *
 * @class
 */
jsc.AST.ArrayPatternNode = Object.define(jsc.AST.DestructuringPatternNode, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.ARRAY_PATTERN, lineNumber, columnNumber);

		this.targetPatterns = [];
	},

	append: function(bindingKind, patternNode, defaultValueExpression) {
		this.targetPatterns.push(new jsc.AST.ArrayPatternEntry(bindingKind, patternNode, defaultValueExpression));
	}
});


/**
 * Represents an entry in the ArrayPatternNode target patterns.
 *
 * @class
 */
jsc.AST.ArrayPatternEntry = Object.define({
	initialize: function(bindingKind, pattern, defaultValueExpression) {
		this.bindingKind = bindingKind;
		this.pattern = pattern;
		this.defaultValueExpression = defaultValueExpression;
	}
});


/**
 * Represents the an object pattern node.
 *
 * @class
 */
jsc.AST.ObjectPatternNode = Object.define(jsc.AST.DestructuringPatternNode, {
	initialize: function($super, lineNumber, columnNumber) {
		$super(jsc.AST.NodeKind.OBJECT_PATTERN, lineNumber, columnNumber);

		this.targetPatterns = [];
	},

	append: function(propertyName, propertyNameWasString, patternNode, defaultValueExpression) {
		this.targetPatterns.push(new jsc.AST.ObjectPatternEntry(propertyName, propertyNameWasString, patternNode, defaultValueExpression));
	}
});


/**
 * Represents an entry in the ObjectPatternNode target patterns.
 *
 * @class
 */
jsc.AST.ObjectPatternEntry = Object.define({
	initialize: function(propertyName, propertyNameWasString, pattern, defaultValueExpression) {
		this.propertyName = propertyName;
		this.propertyNameWasString = propertyNameWasString;
		this.pattern = pattern;
		this.defaultValueExpression = defaultValueExpression;
	}
});


/**
 * Represents the an binding pattern node.
 *
 * @class
 */
jsc.AST.BindingPatternNode = Object.define(jsc.AST.DestructuringPatternNode, {
	initialize: function($super, lineNumber, columnNumber, boundName, bindingContextKind) {
		$super(jsc.AST.NodeKind.BINDING_PATTERN, lineNumber, columnNumber);

		this.boundName = boundName;
		this.bindingContextKind = bindingContextKind;
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
jsc.AST.ArrayPatternBindingKind = {
	ELISION: 1,
	ELEMENT: 2,
	REST_ELEMENT: 3
};

/** @enum */
jsc.AST.FunctionParameterKind = {
	NORMAL: 1,
	REST: 2
};


/** @enum */
jsc.AST.OpCode = {
	ADD:					 1,
	BITWISE_AND:			 2,
	BITWISE_OR:				 3,
	BITWISE_XOR:			 4,
	DIVIDE:					 5,
	EQUAL:					 6,
	EQUAL_STRICT:			 7,
	GREATER:				 8,
	GREATER_EQ:				 9,
	IN:						10,
	INSTANCEOF:				11,
	LEFT_SHIFT:				12,
	LESS:					13,
	LESS_EQ:				14,
	MODULUS:				15,
	MULTIPLY:				16,
	NOT_EQUAL:				17,
	NOT_EQUAL_STRICT:		18,
	RIGHT_SHIFT:			19,
	RIGHT_SHIFT_UNSIGNED:	20,
	SUBTRACT:				21
};


/** @enum */
jsc.AST.AssignmentOperatorKind = {
	AND_EQUAL				:  1,
	DIVIDE_EQUAL			:  2,
	EQUAL					:  3,
	LSHIFT_EQUAL			:  4,
	MINUS_EQUAL				:  5,
	MINUS_MINUS				:  6,
	MOD_EQUAL				:  7,
	MULTIPLY_EQUAL			:  8,
	OR_EQUAL				:  9,
	PLUS_EQUAL				: 10,
	PLUS_PLUS				: 11,
	RSHIFT_EQUAL			: 12,
	RSHIFT_EQUAL_UNSIGNED	: 13,
	XOR_EQUAL				: 14
};


/** @enum */
jsc.AST.AssignmentContextKind = {
	ASSIGNMENT: 			0,
	DECLARATION: 			1,
	CONSTANT_DECLARATION:	2
};


/** @enum */
jsc.AST.FunctionMode = {
	EXPRESSION: 0,
	DECLARATION: 1
};


/** @enum */
jsc.AST.DeclarationKind = {
	VAR: 1,
	CONST: 2,
	LET: 3
};


/** @enum */
jsc.AST.LogicalOperatorKind = {
	AND	: 1,
	OR	: 2
};


/** @enum */
jsc.AST.PropertyKindFlags = {
	UNKNOWN		: 0x00,
	CONSTANT	: 0x01,
	GETTER		: 0x02,
	SETTER		: 0x04,
	COMPUTED	: 0x08,
	SHORTHAND	: 0x10
};


/** @enum */
jsc.AST.PropertyPutKind = {
	UNKNOWN: 0,
	DIRECT: 1
};


/** @enum */
jsc.AST.VariableFlags = {
	NONE			: 0x00,
	CONSTANT		: 0x01,
	HAS_INITIALIZER	: 0x02
};


/** @enum */
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


/** @enum */
jsc.AST.NodeKind = {
	UNKNOWN:				  0,

	ADD:					  1,
	ARGUMENT_LIST:			  2,
	ARRAY:					  3,
	ARRAY_PATTERN:			  4,
	ASSIGN_BRACKET:			  5,
	ASSIGN_DOT:				  6,
	ASSIGN_ERROR:			  7,
	ASSIGN_RESOLVE:			  8,
	BINDING_PATTERN:		  9,
	BITWISE_AND:			 10,
	BITWISE_NOT:			 11,
	BITWISE_OR:				 12,
	BITWISE_XOR:			 13,
	BLOCK:					 14,
	BOOLEAN:				 15,
	BRACKET_ACCESSOR:		 16,
	BREAK:					 17,
	COMMA:					 18,
	CONDITIONAL:			 19,
	CONST_DECL:				 20,
	CONTINUE:				 21,
	DEBUGGER:				 22,
	DECL_STATEMENT:			 23,
	DELETE_BRACKET:			 24,
	DELETE_DOT:				 25,
	DELETE_RESOLVE:			 26,
	DELETE_VALUE:			 27,
	DIVIDE:					 28,
	DOT_ACCESSOR:			 29,
	DO_WHILE:				 30,
	DS_ASSIGN:				 31,
	EMPTY:					 32,
	EMPTY_DECL:				 33,
	EQUAL:					 34,
	EQUAL_STRICT:			 35,
	EVAL:					 36,
	EXPR_STATEMENT:			 37,
	FOR:					 38,
	FOR_IN:					 39,
	FUNCTION:				 40,
	FUNCTION_APPLY:			 41,
	FUNCTION_CALL:			 42,
	FUNCTION_DECL:			 43,
	FUNCTION_EXPR:			 44,
	FUNC_CALL_BRACKET:		 45,
	FUNC_CALL_DOT:			 46,
	FUNC_CALL_EVAL:			 47,
	FUNC_CALL_RESOLVE:		 48,
	FUNC_CALL_VALUE:		 49,
	GREATER:				 50,
	GREATER_EQ:				 51,
	IF:						 52,
	IF_ELSE:				 53,
	IN:						 54,
	INSTANCEOF:				 55,
	LABEL:					 56,
	LEFT_SHIFT:				 57,
	LESS:					 58,
	LESS_EQ:				 59,
	LOGICAL_NOT:			 60,
	LOGICAL_OP:				 61,
	MODULUS:				 62,
	MULTIPLY:				 63,
	NEGATE:					 64,
	NEW:					 65,
	NOT_EQUAL:				 66,
	NOT_EQUAL_STRICT:		 67,
	NULL:					 68,
	OBJECT_LITERAL:			 70,
	OBJECT_PATTERN:			 71,
	PREFIX:			 		 76,
	POSTFIX:		 		 72,
	PROPERTY_LIST:			 80,
	READ_MODIFY_BRACKET:	 81,
	READ_MODIFY_DOT:		 82,
	READ_MODIFY_RESOLVE:	 83,
	REGEX:					 84,
	RESOLVE:				 85,
	RETURN:					 86,
	RIGHT_SHIFT:			 87,
	RIGHT_SHIFT_UNSIGNED:	 88,
	SCRIPT:					 89,
	SPREAD:					 90,
	STRING:					 91,
	SUBTRACT:				 92,
	SWITCH:					 93,
	THIS:					 94,
	THROW:					 95,
	TRY:					 96,
	TYPEOF_RESOLVE:			 97,
	TYPEOF_VALUE:			 98,
	UNARY_PLUS:				 99,
	VOID:					100,
	WHILE:					101,
	WITH:					102,
	DOUBLE:					103,
	INTEGER:				104,
	FUNCTION_EXPR_ARROW:	105,
	SUPER:					106,
	FOR_OF:					107,
	FUNCTION_METADATA:		108,
	NEW_TARGET:				109,
	PARAMETER_PATTERN:		110
};


/** @enum */
jsc.AST.CodeFeatureFlags = {};


(function() {

	//
	// CodeFeatureFlags
	//
	var featureNames = [
		"NONE", "ARGUMENTS", "CATCH", "EVAL", "SHADOWS_ARGUMENTS", "STRICT_MODE", "THIS", "WITH", "MODIFIED_PARAMETER", "MODIFIED_ARGUMENTS"
	];
	
	jsc.Utils.createEnumFlags(featureNames, jsc.AST.CodeFeatureFlags);
	
	Object.defineProperty(jsc.AST.CodeFeatureFlags, "ALL", {
		value: (jsc.AST.CodeFeatureFlags.EVAL | jsc.AST.CodeFeatureFlags.ARGUMENTS | jsc.AST.CodeFeatureFlags.WITH | jsc.AST.CodeFeatureFlags.CATCH | jsc.AST.CodeFeatureFlags.THIS | jsc.AST.CodeFeatureFlags.STRICT_MODE | jsc.AST.CodeFeatureFlags.SHADOWS_ARGUMENTS | jsc.AST.CodeFeatureFlags.MODIFIED_PARAMETER | jsc.AST.CodeFeatureFlags.MODIFIED_ARGUMENTS),
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
	Object.freeze(jsc.AST.ArrayPatternBindingKind);
	Object.freeze(jsc.AST.AssignmentContextKind);
	Object.freeze(jsc.AST.AssignmentOperatorKind);
	Object.freeze(jsc.AST.CodeFeatureFlags);
	Object.freeze(jsc.AST.DeclarationKind);
	Object.freeze(jsc.AST.Keyword);
	Object.freeze(jsc.AST.LogicalOperatorKind);
	Object.freeze(jsc.AST.NodeKind);
	Object.freeze(jsc.AST.OpCode);
	Object.freeze(jsc.AST.PropertyKindFlags);
	Object.freeze(jsc.AST.VariableFlags);
})();

module.exports = jsc.AST;