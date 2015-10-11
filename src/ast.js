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
	initialize: function(source) {
		this.source = source;
		this.assignmentStack = [];		// element = jsc.AST.AssignmentInfo
		this.binaryOperandStack = []; 	// element = jsc.AST.BinaryOperand
		this.binaryOperatorStack = []; 	// element = [<operatorTokenKind>, <operatorPrecedence>]
		this.unaryTokenStack = [];		// element = [<tokenKind>, <tokenBegin>, <tokenColumn>]
		this.functions = [];			// element = jsc.AST.FunctionMetadataNode
		this.features = jsc.AST.CodeFeatureFlags.NONE;
		this.evalCount = 0;
		this.constantCount = 0;
	},

	get lastUnaryTokenKind() {
		return this.unaryTokenStack[this.unaryTokenStack.length-1][0];
	},
	
	get lastUnaryTokenBegin() {
		return this.unaryTokenStack[this.unaryTokenStack.length-1][1];
	},


	//=============================================================================================
	// CREATE STATEMENTS
	//=============================================================================================
	
	createEmptyStatement: function(location) {
		return new jsc.AST.EmptyStatement(location);
	},

	createExpressionStatement: function(location, begin, endLine, expression) {
		var statement = new jsc.AST.ExpressionStatement(location, expression);
		statement.updatePosition(begin.line, endLine, begin.begin, begin.lineBegin);

		return statement;
	},

	createBlockStatement: function(location, beginLine, endLine, statements, variables) {
		var statement = new jsc.AST.BlockStatement(location, statements, variables);
		statement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return statement;
	},

	createLabelStatement: function(location, begin, end, name, statement) {
		var label = new jsc.AST.LabelStatement(location, name, statement);
		label.updatePosition(begin.line, end.line, begin.begin, begin.lineBegin);

		return label;
	},

	createDeclarationStatement: function(location, beginLine, endLine, expression) {
		var statement = new jsc.AST.DeclarationStatement(location, expression);
		statement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return statement;
	},

	createIfStatement: function(location, beginLine, endLine, conditionExpression, trueStatement, falseStatement) {
		var statement = new jsc.AST.IfElseStatement(location, conditionExpression, trueStatement, falseStatement);
		statement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return statement;
	},
	
	createWhileStatement: function(location, beginLine, endLine, expression, statement) {
		var whileStatement = new jsc.AST.WhileStatement(location, expression, statement);
		whileStatement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return whileStatement;
	},
	
	createDoWhileStatement: function(location, beginLine, endLine, expression, statement) {
		var doWhileStatement = new jsc.AST.DoWhileStatement(location, expression, statement);
		doWhileStatement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return doWhileStatement;
	},
	
	createForStatement: function(location, beginLine, endLine, initializeExpression, conditionExpression, iteratorExpression, statement, lexicalVariables) {
		var forStatement = new jsc.AST.ForStatement(location, initializeExpression, conditionExpression, iteratorExpression, statement, lexicalVariables);
		forStatement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return forStatement;
	},

	createForInStatement: function(location, beginLine, endLine, leftExpression, iterationExpression, statement, lexicalVariables) {
		var forInStatement = new jsc.AST.ForInStatement(location, leftExpression, iterationExpression, statement, lexicalVariables);
		forInStatement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return forInStatement;
	},

	createForOfStatement: function(location, beginLine, endLine, leftExpression, iterationExpression, statement, lexicalVariables) {
		var forOfStatement = new jsc.AST.ForOfStatement(location, leftExpression, iterationExpression, statement, lexicalVariables);
		forOfStatement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return forOfStatement;
	},

	createContinueStatement: function(location, begin, end, name) {
		var statement = new jsc.AST.ContinueStatement(location, name);
		statement.updatePosition(begin.line, end.line, begin.begin, begin.lineBegin);

		return statement;
	},
	
	createBreakStatement: function(location, begin, end, name) {
		var statement = new jsc.AST.BreakStatement(location, name);
		statement.updatePosition(begin.line, end.line, begin.begin, begin.lineBegin);

		return statement;
	},
	
	createReturnStatement: function(location, begin, end, expression) {
		var statement = new jsc.AST.ReturnStatement(location, expression);
		statement.updatePosition(begin.line, end.line, begin.begin, begin.lineBegin);

		return statement;
	},
	
	createThrowStatement: function(location, begin, end, expression) {
		var statement = new jsc.AST.ThrowStatement(location, expression);
		statement.updatePosition(begin.line, end.line, begin.begin, begin.lineBegin);

		return statement;
	},
	
	createDebuggerStatement: function(location, beginLine, endLine) {
		var statement = new jsc.AST.DebuggerStatement(location);
		statement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return statement;
	},
	
	createTryStatement: function(location, beginLine, endLine, thrownVariableName, tryStatement, catchStatement, finallyStatement, catchVariables) {
		var statement = new jsc.AST.TryStatement(location, thrownVariableName, tryStatement, catchStatement, finallyStatement, catchVariables);
		statement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		if(jsc.Utils.isNotNull(catchStatement))
			this.features |= jsc.AST.CodeFeatureFlags.CATCH;

		return statement;
	},

	createWithStatement: function(location, beginLine, endLine, expression, expressionLength, statement) {
		var withStatement = new jsc.AST.WithStatement(location, expression, expressionLength, statement);
		withStatement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		this.features |= jsc.AST.CodeFeatureFlags.WITH;

		return withStatement;
	},
	
	createSwitchStatement: function(location, beginLine, endLine, expression, defaultClause, firstClauseList, secondClauseList, variables) {
		var statement = new jsc.AST.SwitchStatement(location, expression, defaultClause, firstClauseList, secondClauseList, variables);
		statement.updatePosition(beginLine, endLine, location.begin, location.lineBegin);

		return statement;
	},
	
	createSwitchClauseList: function(location, expression, statements, tail) {
		return new jsc.AST.SwitchClauseListNode(expression, statements, tail);
	},

	createFunctionDeclarationStatement: function(location, info) {
		var statement = new jsc.AST.FunctionDeclarationStatement(location, info.name, info.body, this.source.toSourceCode(info.begin, info.end, info.beginLine, info.bodyBeginColumn));
		info.body.updatePosition(info.beginLine, info.endLine, location.begin, location.lineBegin);

		if(info.name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;

		this.functions.push(info.body);

		return statement;
	},
		


	//=============================================================================================
	// CREATE EXPRESSIONS
	//=============================================================================================

	createAssignmentExpression: function(location, expression, initialCount, currentCount) {
		var info = this.assignmentStack[this.assignmentStack.length-1];
		var expr = this.createAssignment(location, info.op, info.expression, expression, info.count !== initialCount, info.count !== currentCount);

		this.assignmentStack.pop();
		
		return expr;
	},

	createAssignment: function(location, op, leftExpression, rightExpression, leftHasAssignments, rightHasAssignments) {

		if(!leftExpression.isLocation)
			return new jsc.AST.AssignErrorExpression(location, leftExpression, rightExpression, op);

		// resolve expression
		if(leftExpression.isResolve)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
			{
				if(rightExpression.isFunctionExpression)
					rightExpression.metadata.inferredName = leftExpression.name;

				return new jsc.AST.AssignResolveExpression(location, leftExpression.name, rightExpression, rightHasAssignments);
			}

			return new jsc.AST.ReadModifyResolveExpression(location, leftExpression.name, rightExpression, rightHasAssignments, op);
		}


		// bracket expression
		if(leftExpression.isBracketAccessor)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
				return new jsc.AST.AssignBracketExpression(location, leftExpression.base, leftExpression.subscript, leftHasAssignments, rightExpression, rightHasAssignments);

			return new jsc.AST.ReadModifyBracketExpression(location, leftExpression.base, leftExpression.subscript, leftHasAssignments, rightExpression, rightHasAssignments, op);
		}


		// dot expression
		if(leftExpression.isDotAccessor)
		{
			if(op === jsc.AST.AssignmentOperatorKind.EQUAL)
			{
				if(rightExpression.isFunctionExpression)
					rightExpression.metadata.inferredName = leftExpression.name;

				return new jsc.AST.AssignDotExpression(location, leftExpression.name, leftExpression.base, rightExpression, rightHasAssignments);
			}

			return new jsc.AST.ReadModifyDotExpression(location, leftExpression.name, leftExpression.base, rightExpression, rightHasAssignments, op);
		}


		throw new Error("Invalid assignment expression.");
	},
	
	createAssignResolveExpression: function(location, name, rightExpression, rightHasAssignments) {
		if(rightExpression.isFunctionExpression)
			rightExpression.metadata.inferredName = name;

		return new jsc.AST.AssignResolveExpression(location, name, rightExpression, rightHasAssignments);
	},

	createDestructuringAssignmentExpression: function(location, pattern, initializer) {
		return new jsc.AST.DestructuringAssignmentExpression(location, pattern, initializer);
	},

	createArrowFunctionExpression: function(location, info) {
		var expr = new jsc.AST.ArrowFunctionExpression(location, info.name, info.body, this.source.toSourceCode(info.begin, (info.body.isArrowFunctionBodyExpression ? info.end - 1 : info.end), info.beginLine, info.bodyBeginColumn));
		info.body.updatePosition(info.beginLine, info.endLine, location.begin, location.lineBegin);

		this.features |= jsc.AST.CodeFeatureFlags.THIS;

		return expr;
	},

	createResolveExpression: function(location, name, position) {
		if(name === "arguments")
			this.features |= jsc.AST.CodeFeatureFlags.ARGUMENTS;

		return new jsc.AST.ResolveExpression(location, name, position);
	},

	createEmptyDeclarationExpression: function(location, name, declarationKind) {
		return new jsc.AST.EmptyDeclarationExpression(location, name, declarationKind);
	},

	createConditionalExpression: function(location, conditionExpression, leftExpression, rightExpression) {
		return new jsc.AST.ConditionalExpression(location, conditionExpression, leftExpression, rightExpression);
	},
	
	createPrefixExpression: function(location, expression, op) {
		return new jsc.AST.PrefixExpression(location, expression, op);
	},
	
	createPostfixExpression: function(location, expression, op) {
		return new jsc.AST.PostfixExpression(location, expression, op);
	},
	
	createLogicalNotExpression: function(location, expression) {
		return new jsc.AST.LogicalNotExpression(location, expression);
	},
	
	createBitwiseNotExpression: function(location, expression) {
		return new jsc.AST.BitwiseNotExpression(location, expression);
	},
	
	createNegateExpression: function(location, expression) {
		return new jsc.AST.NegateExpression(location, expression);
	},
	
	createUnaryPlusExpression: function(location, expression) {
		return new jsc.AST.UnaryPlusExpression(location, expression);
	},
	
	createTypeOfExpression: function(location, expression) {
		if(expression.isResolve)
			return new jsc.AST.TypeOfResolveExpression(location, expression.name);

		return new jsc.AST.TypeOfValueExpression(location, expression);
	},
	
	createVoidExpression: function(location, expression) {
		this.constantCount++;

		return new jsc.AST.VoidExpression(location, expression);
	},
	
	createDeleteExpression: function(location, expression) {
		if(!expression.isLocation)
			return new jsc.AST.DeleteValueExpression(location, expression);

		if(expression.isResolve)
			return new jsc.AST.DeleteResolveExpression(location, expression.name);

		if(expression.isBracketAccessor)
			return new jsc.AST.DeleteBracketExpression(location, expression.base, expression.subscript);

		if(expression.isDotAccessor)
			return new jsc.AST.DeleteDotExpression(location, expression.name, expression.base);

		throw new Error("Invalid delete expression.");
	},
	
	createThisExpression: function(location) {
		this.features |= jsc.AST.CodeFeatureFlags.THIS;

		return new jsc.AST.ThisExpression(location);
	},

	createSuperExpression: function(location) {
		return new jsc.AST.SuperExpression(location);
	},

	createNewExpression: function(location, expression) {
		return new jsc.AST.NewExpression(location, expression);
	},
	
	createNewExpressionWithArguments: function(location, expression, argumentList) {
		return new jsc.AST.NewExpression(location, expression, argumentList);
	},

	createNewTargetExpression: function(location) {
		return new jsc.AST.NewTargetExpression(location);
	},

	createFunctionExpression: function(location, info) {
		var expr = new jsc.AST.FunctionExpression(location, info.name, info.body, this.source.toSourceCode(info.begin, info.end, info.beginLine, info.bodyBeginColumn));
		info.body.updatePosition(info.beginLine, info.endLine, location.begin, location.lineBegin);

		return expr;
	},

	createFunctionCallExpression: function(location, expression, argumentList) {
		if(!expression.isLocation)
			return new jsc.AST.ValueFunctionCallExpression(location, expression, argumentList);

		if(expression.isResolve)
		{
			if(expression.name === "eval")
			{
				this.features |= jsc.AST.CodeFeatureFlags.EVAL;
				this.evalCount++;

				return new jsc.AST.EvalFunctionCallExpression(location, argumentList);
			}

			return new jsc.AST.ResolveFunctionCallExpression(location, expression.name, argumentList);
		}

		if(expression.isBracketAccessor)
			return new jsc.AST.BracketFunctionCallExpression(location, expression.base, expression.subscript, argumentList);

		if(expression.isDotAccessor)
		{
			if(expression.name === "call")
				return new jsc.AST.CallDotFunctionCallExpression(location, expression.name, expression.base, argumentList);

			if(expression.name === "apply")
				return new jsc.AST.ApplyDotFunctionCallExpression(location, expression.name, expression.base, argumentList);

			return new jsc.AST.DotFunctionCallExpression(location, expression.name, expression.base, argumentList);
		}

		throw new Error("Invalid function call expression.");
	},
	
	createArrayExpression: function(location, elements, elisions) {
		var isOptional = !jsc.Utils.isNull(elisions);

		elisions = jsc.Utils.valueOrDefault(elisions, 0);

		if(elisions > 0)
			this.constantCount++;

		return new jsc.AST.ArrayExpression(location, elements, elisions, isOptional);
	},
	
	createObjectLiteralExpression: function(location, properties) {
		return new jsc.AST.ObjectLiteralExpression(location, properties);
	},

	createBracketAccessorExpression: function(location, base, subscript, subscriptHasAssignments) {
		return new jsc.AST.BracketAccessorExpression(location, base, subscript, subscriptHasAssignments);
	},

	createDotAccessorExpression: function(location, propertyName, baseExpression) {
		return new jsc.AST.DotAccessorExpression(location, propertyName, baseExpression);
	},
	
	createStringExpression: function(location, value) {
		this.constantCount++;

		return new jsc.AST.StringExpression(location, value);
	},
	
	createDoubleExpression: function(location, value) {
		this.constantCount++;

		return new jsc.AST.DoubleExpression(location, value);
	},

	createIntegerExpression: function(location, value) {
		this.constantCount++;

		return new jsc.AST.IntegerExpression(location, value);
	},
	
	createNullExpression: function(location) {
		this.constantCount++;

		return new jsc.AST.NullExpression(location);
	},
	
	createBooleanExpression: function(location, value) {
		this.constantCount++;

		return new jsc.AST.BooleanExpression(location, value);
	},

	createRegExpExpression: function(location, pattern, flags) {
		return new jsc.AST.RegExExpression(location, pattern, flags);
	},
	
	createCommaExpression: function(location, expression) {
		var commaExpression = new jsc.AST.CommaExpression(location);
		commaExpression.append(expression);

		return commaExpression;
	},

	createSpreadExpression: function(location, expression) {
		return new jsc.AST.SpreadExpression(location, expression);
	},

	createBitwiseExpression: function(location, opCode, leftExpression, rightExpression, rightHasAssignments) {
		switch(opCode)
		{
			case jsc.AST.OpCode.BITWISE_AND:
				return new jsc.AST.BitwiseAndExpression(location, leftExpression, rightExpression, rightHasAssignments);
			case jsc.AST.OpCode.BITWISE_OR:
				return new jsc.AST.BitwiseOrExpression(location, leftExpression, rightExpression, rightHasAssignments);
			case jsc.AST.OpCode.BITWISE_XOR:
				return new jsc.AST.BitwiseXOrExpression(location, leftExpression, rightExpression, rightHasAssignments);
			default:
				throw new Error("Invalid bitwise operation.");
		}
	},

	createDivideExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.DivideExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createMultiplyExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.MultiplyExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createSubtractExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.SubtractExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createAddExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		return new jsc.AST.AddExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createModExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		leftExpression = this.stripUnaryPlusExpression(leftExpression);
		rightExpression = this.stripUnaryPlusExpression(rightExpression);

		return new jsc.AST.ModulusExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createLeftShiftExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		return new jsc.AST.LeftShiftExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createRightShiftExpression: function(location, leftExpression, rightExpression, rightHasAssignments, asUnsigned) {
		if(asUnsigned)
			return new jsc.AST.RightShiftUnsignedExpression(location, leftExpression, rightExpression, rightHasAssignments);

		return new jsc.AST.RightShiftExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createLessThanExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		return new jsc.AST.LessThanExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createLessThanOrEqualExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		return new jsc.AST.LessThanOrEqualExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createGreaterThanExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		return new jsc.AST.GreaterThanExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createGreaterThanOrEqualExpression: function(location, leftExpression, rightExpression, rightHasAssignments) {
		return new jsc.AST.GreaterThanOrEqualExpression(location, leftExpression, rightExpression, rightHasAssignments);
	},

	createBinaryExpression: function(location, operatorTokenKind, leftOp, rightOp) {
		var lhsExpr = leftOp.expression;
		var rhsExpr = rightOp.expression;
		var rhsHasAssignment = rightOp.hasAssignments;

		switch(operatorTokenKind)
		{
			case jsc.Token.Kind.AND:
				return new jsc.AST.LogicalExpression(location, lhsExpr, rhsExpr, jsc.AST.LogicalOperatorKind.AND);

			case jsc.Token.Kind.OR:
				return new jsc.AST.LogicalExpression(location, lhsExpr, rhsExpr, jsc.AST.LogicalOperatorKind.OR);

			case jsc.Token.Kind.BITWISE_AND:
				return this.createBitwiseExpression(location, jsc.AST.OpCode.BITWISE_AND, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.BITWISE_OR:
				return this.createBitwiseExpression(location, jsc.AST.OpCode.BITWISE_OR, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.BITWISE_XOR:
				return this.createBitwiseExpression(location, jsc.AST.OpCode.BITWISE_XOR, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.DIV:
				return this.createDivideExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.MULT:
				return this.createMultiplyExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.MINUS:
				return this.createSubtractExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.PLUS:
				return this.createAddExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.MOD:
				return this.createModExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.LSHIFT:
				return this.createLeftShiftExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.RSHIFT:
				return this.createRightShiftExpression(location, lhsExpr, rhsExpr, rhsHasAssignment, false);

			case jsc.Token.Kind.URSHIFT:
				return this.createRightShiftExpression(location, lhsExpr, rhsExpr, rhsHasAssignment, true);

			case jsc.Token.Kind.EQUAL_EQUAL:
				return new jsc.AST.EqualExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.NOT_EQUAL:
				return new jsc.AST.NotEqualExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.STRICT_EQUAL:
				return new jsc.AST.EqualStrictExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.STRICT_NOT_EQUAL:
				return new jsc.AST.NotEqualStrictExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.LESS:
				return this.createLessThanExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.LESS_EQUAL:
				return this.createLessThanOrEqualExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.GREATER:
				return this.createGreaterThanExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.GREATER_EQUAL:
				return this.createGreaterThanOrEqualExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.IN:
				return new jsc.AST.InExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

			case jsc.Token.Kind.INSTANCEOF:
				return new jsc.AST.InstanceOfExpression(location, lhsExpr, rhsExpr, rhsHasAssignment);

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

	createFunctionMetadata: function(beginLocation, endLocation, beginColumn, endColumn, keywordBegin, nameBegin, parametersBegin, parameterCount, inStrictMode, isArrowFunction, isArrowFunctionExpression) {
		var metadata = new jsc.AST.FunctionMetadataNode(beginLocation, endLocation, beginColumn, endColumn, inStrictMode);

		metadata.nameBegin = nameBegin;
		metadata.keywordBegin = keywordBegin;
		metadata.parametersBegin = parametersBegin;
		metadata.parameterCount = parameterCount;
		metadata.isArrowFunction = isArrowFunction;
		metadata.isArrowFunctionBodyExpression = isArrowFunctionExpression;

		return metadata;
	},

	createArgumentsList: function(location, expression, list) {
		return new jsc.AST.ArgumentListNode(location, expression, list);
	},
	
	createArrayElementList: function(expression, elisions, list) {
		return new jsc.AST.ArrayElementList(elisions, expression, list);
	},
	
	createPropertyList: function(location, propertyNode, propertyList) {
		return new jsc.AST.PropertyListNode(location, propertyNode, propertyList);
	},
	
	createProperty: function(nameOrNameExpression, expression, flags, putKind, needsSuperBinding) {
		needsSuperBinding = jsc.Utils.valueOrDefault(needsSuperBinding, false);

		if(jsc.Utils.isString(nameOrNameExpression) && expression.isFunctionExpression)
			expression.metadata.inferredName = nameOrNameExpression;

		return new jsc.AST.PropertyNode(nameOrNameExpression, expression, flags, putKind, needsSuperBinding);
	},

	createGetterOrSetterProperty: function(location, propertyName, kindFlags, needsSuperBinding, info) {
		if(jsc.Utils.isString(propertyName))
			info.body.inferredName = propertyName;

		info.body.updatePosition(info.beginLine, info.endLine, location.begin, location.lineBegin);

		var functionExpression = new jsc.AST.FunctionExpression(location, null, info.body, this.source.toSourceCode(info.begin, info.end, info.beginLine, info.bodyBeginColumn));

		return new jsc.AST.PropertyNode(propertyName.toString(), functionExpression, kindFlags, jsc.AST.PropertyPutKind.UNKNOWN, needsSuperBinding);
	},

	createArrayPattern: function(location) {
		return new jsc.AST.ArrayPatternNode(location);
	},

	createObjectPattern: function(location) {
		return new jsc.AST.ObjectPatternNode(location);
	},

	createBindingPattern: function(location, boundName, bindingContextKind) {
		return new jsc.AST.BindingPatternNode(location, boundName, bindingContextKind);
	},


	//=============================================================================================
	// CONTEXT STATE / UTILS
	//=============================================================================================

	combineCommaExpressions: function(location, list, expression) {
		if(jsc.Utils.isNull(list))
			return expression;

		if(list.kind === jsc.AST.NodeKind.COMMA)
		{
			list.append(expression);
			return list;
		}

		var commaExpression = this.createCommaExpression(location, list);
		commaExpression.append(expression);

		return commaExpression;
	},

	stripUnaryPlusExpression: function(expression) {
		return (expression.kind === jsc.AST.NodeKind.UNARY_PLUS ? expression.expression : expression);
	},
	
	precedenceIsLowerThanOperatorStack: function(precedence) {
		return (precedence <= this.binaryOperatorStack[this.binaryOperatorStack.length-1][1]);
	},

	appendAssignment: function(expr, count, op) {
		this.assignmentStack.push(new jsc.AST.AssignmentInfo(expr, count, op));
	},

	pushBinaryOperand: function(state, expr, hasAssignments) {
		state.operandDepth++;

		this.binaryOperandStack.push(new jsc.AST.BinaryOperand(expr, hasAssignments));
	},
	
	popBinaryOperand: function() {
		var operand = this.binaryOperandStack.pop();
		
		return operand.expression;
	},
	
	pushBinaryOperation: function(state, operatorTokenKind, precedence) {
		state.operatorDepth++;
		this.binaryOperatorStack.push([operatorTokenKind, precedence]);
	},
	
	popBinaryOperation: function(location, operationState) {
		var rhs = this.binaryOperandStack.pop();
		var lhs = this.binaryOperandStack.pop();
		var expr = null;

		operationState.operandDepth -= 2;
		
		if(operationState.operandDepth < 0)
			throw new Error("Not enough binary operands on the stack.");

		expr = this.createBinaryExpression(location, this.binaryOperatorStack[this.binaryOperatorStack.length-1][0], lhs, rhs);

		this.binaryOperandStack.push(new jsc.AST.BinaryOperand(expr, (lhs.hasAssignments || rhs.hasAssignments)));
		this.binaryOperatorStack.pop();
		
		operationState.operandDepth++;
		operationState.operatorDepth--;
	},
	
	pushUnaryToken: function(tokenKind, tokenBegin) {
		this.unaryTokenStack.push([tokenKind, tokenBegin]);
	},
	
	popUnaryToken: function() {
		this.unaryTokenStack.pop();
	}
});



/**
 * The base class for all AST nodes.
 *
 * @class
 */
jsc.AST.Node = Object.define({
	initialize: function(kind, location) {
		this.kind = jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.UNKNOWN);
		this.state = {
			position: new jsc.TextPosition(location.line, location.begin, location.lineBegin),
			end: -1,
			endLine: -1
		};
	},

	get position() {
		return this.state.position;
	},

	get begin() {
		return this.state.position.begin;
	},
	set begin(value) {
		this.state.position.begin = value;
	},

	get beginLine() {
		return this.state.position.line;
	},

	get end() {
		return this.state.end;
	},
	set end(value) {
		this.state.end = value;
	},

	get endLine() {
		return this.state.endLine;
	},
	set endLine(value) {
		this.state.endLine = value;
	},

	get lineBegin() {
		return this.state.position.lineBegin;
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

	updatePosition: function(beginLine, endLine, begin, lineBegin) {
		this.endLine = endLine;
		this.state.position.line = beginLine;
		this.state.position.lineBegin = lineBegin;
		this.state.position.begin = begin;
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
	initialize: function($super, kind, location, resultKind) {
		$super(kind, location);

		this.state.resultKind = jsc.Utils.valueOrDefault(resultKind, jsc.AST.ExpressionResultKind.Unknown);
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
	initialize: function($super, location, name, declarationKind) {
		$super(jsc.AST.NodeKind.EMPTY_DECL, location);

		this.name = name;
		this.declarationKind = declarationKind;
	}
});


/** @class */
jsc.AST.NewExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, expression, args) {
		$super(jsc.AST.NodeKind.NEW, location);
		
		this.expression = expression;
		this.args = args;
	}
});


/** @class */
jsc.AST.NewTargetExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.NEW_TARGET, location);
	}
});


/** @class */
jsc.AST.CommaExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.COMMA, location);

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
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.VOID, location);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.ThisExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.THIS, location);
	}
});


/** @class */
jsc.AST.SuperExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.SUPER, location);
	}
});


/** @class */
jsc.AST.ArrayExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, elements, elision, isOptional) {
		$super(jsc.AST.NodeKind.ARRAY, location);
		
		this.elements = jsc.Utils.valueOrDefault(elements, null);
		this.elision = jsc.Utils.valueOrDefault(elision, 0);
		this.isOptional = jsc.Utils.valueOrDefault(isOptional, false);
	}
});


/** @class */
jsc.AST.ObjectLiteralExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, properties) {
		$super(jsc.AST.NodeKind.OBJECT_LITERAL, location);
		
		this.properties = jsc.Utils.valueOrDefault(properties, null);
	},

	get hasProperties() {
		return !jsc.Utils.isNull(this.properties);
	}
});


/** @class */
jsc.AST.ConstantExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, location, resultKind) {
		$super(kind, location, resultKind);
	}
});


/** @class */
jsc.AST.NullExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.NULL, location, jsc.AST.ExpressionResultKind.Null);
	}
});


/** @class */
jsc.AST.BooleanExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, location, value) {
		$super(jsc.AST.NodeKind.BOOLEAN, location, jsc.AST.ExpressionResultKind.Boolean);

		this.value = value;
	}
});


/** @class */
jsc.AST.NumberExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, kind, location, resultKind, value) {
		$super(kind, location, resultKind);

		this.value = value;
	}
});


/** @class */
jsc.AST.DoubleExpression = Object.define(jsc.AST.NumberExpression, {
	initialize: function($super, location, value) {
		$super(jsc.AST.NodeKind.DOUBLE, location, jsc.AST.ExpressionResultKind.Number, value);
	}
});


/** @class */
jsc.AST.IntegerExpression = Object.define(jsc.AST.NumberExpression, {
	initialize: function($super, location, value) {
		$super(jsc.AST.NodeKind.INTEGER, location, jsc.AST.ExpressionResultKind.Int32, value);
	}
});


/** @class */
jsc.AST.StringExpression = Object.define(jsc.AST.ConstantExpression, {
	initialize: function($super, location, value) {
		$super(jsc.AST.NodeKind.STRING, location, jsc.AST.ExpressionResultKind.String);

		this.value = value;
		this.isDirective = false;
	}
});


/** @class */
jsc.AST.RegExExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, pattern, flags) {
		$super(jsc.AST.NodeKind.REGEX, location);
		
		this.pattern = pattern;
		this.flags = flags;
	}
});


/** @class */
jsc.AST.ConditionalExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, conditionExpression, leftExpression, rightExpression) {
		$super(jsc.AST.NodeKind.CONDITIONAL, location);

		this.conditionExpression = conditionExpression;
		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
	}
});


/** @class */
jsc.AST.BaseFunctionExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, location, name, metadata, source) {
		$super(kind, location);

		this.metadata = metadata;
		this.metadata.finalize(source, name, jsc.AST.FunctionMode.EXPRESSION);
	}
});


/** @class */
jsc.AST.FunctionExpression = Object.define(jsc.AST.BaseFunctionExpression, {
	initialize: function($super, location, name, metadata, source) {
		$super(jsc.AST.NodeKind.FUNCTION_EXPR, location, name, metadata, source);
	}
});


/** @class */
jsc.AST.ArrowFunctionExpression = Object.define(jsc.AST.BaseFunctionExpression, {
	initialize: function($super, location, name, metadata, source) {
		$super(jsc.AST.NodeKind.FUNCTION_EXPR_ARROW, location, name, metadata, source);
	}
});


/** @class */
jsc.AST.BinaryExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, kind, resultKind, opCode, leftExpression, rightExpression, rightHasAssignments) {
		$super(kind, location, resultKind);

		this.opCode = opCode;
		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AddExpression = Object.define(jsc.AST.BinaryExpression, {
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, leftExpression, rightExpression, rightHasAssignments) {
		$super(
			location,
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
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.BITWISE_NOT, location, jsc.AST.ExpressionResultKind.Int32);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.UnaryExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, location, resultKind, expression) {
		$super(kind, location, resultKind);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.UnaryPlusExpression = Object.define(jsc.AST.UnaryExpression, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.UNARY_PLUS, location, jsc.AST.ExpressionResultKind.Number, expression);
	}
});


/** @class */
jsc.AST.NegateExpression = Object.define(jsc.AST.UnaryExpression, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.NEGATE, location, jsc.AST.ExpressionResultKind.Number, expression);
	}
});


/** @class */
jsc.AST.LogicalNotExpression = Object.define(jsc.AST.UnaryExpression, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.LOGICAL_NOT, location, jsc.AST.ExpressionResultKind.Boolean, expression);
	}
});


/** @class */
jsc.AST.LogicalExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, leftExpression, rightExpression, logicalOperator) {
		$super(jsc.AST.NodeKind.LOGICAL_OP, location, jsc.AST.ExpressionResultKind.Boolean);

		this.leftExpression = leftExpression;
		this.rightExpression = rightExpression;
		this.logicalOperator = logicalOperator;
	}
});


/** @class */
jsc.AST.ResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, position) {
		$super(jsc.AST.NodeKind.RESOLVE, location);

		this.name = name;
		this.position = position;
	}
});


/** @class */
jsc.AST.TypeOfResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name) {
		$super(jsc.AST.NodeKind.TYPEOF_RESOLVE, location, jsc.AST.ExpressionResultKind.String);

		this.name = name;
	}
});


/** @class */
jsc.AST.TypeOfValueExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.TYPEOF_VALUE, location, jsc.AST.ExpressionResultKind.String);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.BracketAccessorExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, base, subscript, subscriptHasAssignments) {
		$super(jsc.AST.NodeKind.BRACKET_ACCESSOR, location);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
	}
});


/** @class */
jsc.AST.DotAccessorExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, base) {
		$super(jsc.AST.NodeKind.DOT_ACCESSOR, location);
		
		this.name = name;
		this.base = base;
	}
});


/** @class */
jsc.AST.AssignBracketExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, base, subscript, subscriptHasAssignments, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_BRACKET, location, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.base = base;
		this.subscript = subscript;
		this.subscriptHasAssignments = subscriptHasAssignments;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AssignDotExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, base, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_DOT, location, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.name = name;
		this.base = base;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.AssignErrorExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, left, right, operatorKind) {
		$super(jsc.AST.NodeKind.ASSIGN_ERROR, location, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.left = left;
		this.right = right;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.AssignResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, right, rightHasAssignments) {
		$super(jsc.AST.NodeKind.ASSIGN_RESOLVE, location);
		
		this.name = name;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
	}
});


/** @class */
jsc.AST.PrePostfixExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, kind, location, expression, operatorKind) {
		$super(kind, location, jsc.AST.ExpressionResultKind.Number);
		
		this.expression = expression;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.PrefixExpression = Object.define(jsc.AST.PrePostfixExpression, {
	initialize: function($super, location, expression, operatorKind) {
		$super(jsc.AST.NodeKind.PREFIX, location, expression, operatorKind);
	}
});


/** @class */
jsc.AST.PostfixExpression = Object.define(jsc.AST.PrePostfixExpression, {
	initialize: function($super, location, expression, operatorKind) {
		$super(jsc.AST.NodeKind.POSTFIX, location, expression, operatorKind);
	}
});


/** @class */
jsc.AST.DeleteBracketExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, base, subscript) {
		$super(jsc.AST.NodeKind.DELETE_BRACKET, location, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.base = base;
		this.subscript = subscript;
	}
});


/** @class */
jsc.AST.DeleteDotExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, base) {
		$super(jsc.AST.NodeKind.DELETE_DOT, location, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.name = name;
		this.base = base;
	}
});


/** @class */
jsc.AST.DeleteResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name) {
		$super(jsc.AST.NodeKind.DELETE_RESOLVE, location, jsc.AST.ExpressionResultKind.UNKNOWN);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.DeleteValueExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.DELETE_VALUE, location);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.ReadModifyBracketExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, base, subscript, subscriptHasAssignments, right, rightHasAssignments, operatorKind) {
		$super(jsc.AST.NodeKind.READ_MODIFY_BRACKET, location);
		
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
	initialize: function($super, location, name, base, right, rightHasAssignments, operatorKind) {
		$super(jsc.AST.NodeKind.READ_MODIFY_DOT, location);
		
		this.name = name;
		this.base = base;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.ReadModifyResolveExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, right, rightHasAssignments, operatorKind) {
		$super(jsc.AST.NodeKind.READ_MODIFY_RESOLVE, location);
		
		this.name = name;
		this.right = right;
		this.rightHasAssignments = rightHasAssignments;
		this.operatorKind = operatorKind;
	}
});


/** @class */
jsc.AST.BracketFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, base, subscript, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_BRACKET, location);
		
		this.base = base;
		this.subscript = subscript;
		this.args = args;
	}
});


/** @class */
jsc.AST.DotFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, base, args, kind) {
		$super(jsc.Utils.valueOrDefault(kind, jsc.AST.NodeKind.FUNC_CALL_DOT), location);
		
		this.name = name;
		this.base = base;
		this.args = args;
	}
});


/** @class */
jsc.AST.ResolveFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, name, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_RESOLVE, location);
		
		this.name = name;
		this.args = args;
	}
});


/** @class */
jsc.AST.ValueFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, expression, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_VALUE, location);
		
		this.expression = expression;
		this.args = args;
	}
});


/** @class */
jsc.AST.EvalFunctionCallExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, args) {
		$super(jsc.AST.NodeKind.FUNC_CALL_EVAL, location);
		
		this.args = args;
	}
});


/** @class */
jsc.AST.ApplyDotFunctionCallExpression = Object.define(jsc.AST.DotFunctionCallExpression, {
	initialize: function($super, location, name, base, args) {
		$super(location, name, base, args, jsc.AST.NodeKind.FUNCTION_APPLY);
	}
});


/** @class */
jsc.AST.CallDotFunctionCallExpression = Object.define(jsc.AST.DotFunctionCallExpression, {
	initialize: function($super, location, name, base, args) {
		$super(location, name, base, args, jsc.AST.NodeKind.FUNCTION_CALL);
	}
});


/** @class */
jsc.AST.SpreadExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.SPREAD, location);

		this.expression = expression;
	}
});


/** @class */
jsc.AST.DestructuringAssignmentExpression = Object.define(jsc.AST.Expression, {
	initialize: function($super, location, bindingPattern, initializeExpression) {
		$super(jsc.AST.NodeKind.EMPTY_DECL, location);

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
	initialize: function($super, kind, location) {
		$super(kind, location);
	},

	get isStatement() {
		return true;
	}
});


/** @class */
jsc.AST.EmptyStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.EMPTY, location);
	}
});


/** @class */
jsc.AST.ExpressionStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expr) {
		$super(jsc.AST.NodeKind.EXPR_STATEMENT, location);

		this.expression = expr;
	}
});


/** @class */
jsc.AST.BlockStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, statements, variables) {
		$super(jsc.AST.NodeKind.BLOCK, location);

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
jsc.AST.IfElseStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, conditionExpression, ifBlock, elseBlock) {
		$super(jsc.AST.NodeKind.IF_ELSE, location);

		this.conditionExpression = conditionExpression;
		this.ifBlock = ifBlock;
		this.elseBlock = elseBlock;
	}
});


/** @class */
jsc.AST.SwitchStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expression, defaultClause, firstClauseList, secondClauseList, variables) {
		$super(jsc.AST.NodeKind.SWITCH, location);

		this.expression = expression;
		this.defaultClause = defaultClause;
		this.firstClauseList = firstClauseList;
		this.secondClauseList = secondClauseList;
		this.variables = variables.clone();
	}
});


/** @class */
jsc.AST.TryStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, thrownVariableName, tryBlock, catchBlock, finallyBlock, catchVariables) {
		$super(jsc.AST.NodeKind.TRY, location);

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
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.THROW, location);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.ReturnStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.RETURN, location);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.BreakStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, name) {
		$super(jsc.AST.NodeKind.BREAK, location);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.ContinueStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, name) {
		$super(jsc.AST.NodeKind.CONTINUE, location);
		
		this.name = name;
	}
});


/** @class */
jsc.AST.DebuggerStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.DEBUGGER, location);
	}
});


/** @class */
jsc.AST.DeclarationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expression) {
		$super(jsc.AST.NodeKind.DECL_STATEMENT, location);
		
		this.expression = expression;
	}
});


/** @class */
jsc.AST.LabelStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, name, statement) {
		$super(jsc.AST.NodeKind.LABEL, location);
		
		this.name = name;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.WithStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expression, expressionLength, statement) {
		$super(jsc.AST.NodeKind.WITH, location);

		this.expression = expression;
		this.expressionLength = expressionLength;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.WhileStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expression, statement) {
		$super(jsc.AST.NodeKind.WHILE, location);
		
		this.expression = expression;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.DoWhileStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, expression, statement) {
		$super(jsc.AST.NodeKind.DO_WHILE, location);
		
		this.expression = expression;
		this.statement = statement;
	}
});


/** @class */
jsc.AST.EnumerationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, kind, location, leftExpression, expression, statement, variables) {
		$super(kind, location);

		this.leftExpression = leftExpression;
		this.expression = expression;
		this.statement = statement;
		this.variables = variables.clone();
	}
});


/** @class */
jsc.AST.ForInStatement = Object.define(jsc.AST.EnumerationStatement, {
	initialize: function($super, location, leftExpression, expression, statement, variables) {
		$super(jsc.AST.NodeKind.FOR_IN, location, leftExpression, expression, statement, variables);
	}
});


/** @class */
jsc.AST.ForOfStatement = Object.define(jsc.AST.EnumerationStatement, {
	initialize: function($super, location, leftExpression, expression, statement, variables) {
		$super(jsc.AST.NodeKind.FOR_OF, location, leftExpression, expression, statement, variables);
	}
});


/** @class */
jsc.AST.ForStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, initializeExpression, conditionExpression, incrementExpression, statement, variables) {
		$super(jsc.AST.NodeKind.FOR, location);
		
		this.initializeExpression = initializeExpression;
		this.conditionExpression = conditionExpression;
		this.incrementExpression = incrementExpression;
		this.statement = statement;
		this.variables = variables.clone();
	}
});


/** @class */
jsc.AST.FunctionDeclarationStatement = Object.define(jsc.AST.Statement, {
	initialize: function($super, location, name, body, source) {
		$super(jsc.AST.NodeKind.FUNCTION_DECL, location);

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
	initialize: function($super, kind, beginLocation, endLocation, beginColumn, endColumn, inStrictMode) {
		$super(kind, endLocation);
		
		inStrictMode = jsc.Utils.valueOrDefault(inStrictMode, false);

		this.beginColumn = beginColumn;
		this.endColumn = endColumn;
		this.beginPosition = new jsc.TextPosition(beginLocation.line, beginLocation.begin, beginLocation.lineBegin);
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
	initialize: function($super, beginLocation, endLocation, beginColumn, endColumn, inStrictMode) {
		$super(jsc.AST.NodeKind.EVAL, beginLocation, endLocation, beginColumn, endColumn, inStrictMode);
	}
});


/**
 * An AST node that represents a complete program (script).
 *
 * @class
 */
jsc.AST.ScriptNode = Object.define(jsc.AST.ScopedStatement, {
	initialize: function($super, source, beginLocation, endLocation, beginColumn, endColumn, inStrictMode) {
		$super(jsc.AST.NodeKind.SCRIPT, beginLocation, endLocation, beginColumn, endColumn, inStrictMode);
		
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
	initialize: function($super, location, expression, nextNode) {
		$super(jsc.AST.NodeKind.ARGUMENT_LIST, location);

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
	initialize: function($super, beginLocation, endLocation, beginColumn, endColumn, inStrictMode) {
		$super(jsc.AST.NodeKind.FUNCTION_METADATA, endLocation);

		this.name = null;
		this.nameBegin = 0;
		this.beginPosition = beginLocation.begin;
		this.beginColumn = beginColumn;
		this.endColumn = endColumn;
		this.inStrictMode = inStrictMode;
		this.keywordBegin = 0;
		this.parametersBegin = 0;
		this.parameterCount = 0;
		this.isArrowFunction = false;
		this.isArrowFunctionBodyExpression = false;
		this.mode = jsc.AST.FunctionMode.DECLARATION;
		this.source = null;
		this.state.inferredName = null;
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
	initialize: function($super, location, propNode, nextNode) {
		$super(jsc.AST.NodeKind.PROPERTY_LIST, location);

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
	initialize: function($super, kind, location) {
		$super(kind, location);
	}
});


/**
 * Represents the an array pattern node.
 *
 * @class
 */
jsc.AST.ArrayPatternNode = Object.define(jsc.AST.DestructuringPatternNode, {
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.ARRAY_PATTERN, location);

		this.targetPatterns = [];
	},

	append: function(location, bindingKind, patternNode, defaultValueExpression) {
		this.targetPatterns.push(new jsc.AST.ArrayPatternEntry(location, bindingKind, patternNode, defaultValueExpression));
	}
});


/**
 * Represents an entry in the ArrayPatternNode target patterns.
 *
 * @class
 */
jsc.AST.ArrayPatternEntry = Object.define({
	initialize: function(location, bindingKind, pattern, defaultValueExpression) {
		this.position = new jsc.TextPosition(location.line, location.begin, location.lineBegin);
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
	initialize: function($super, location) {
		$super(jsc.AST.NodeKind.OBJECT_PATTERN, location);

		this.targetPatterns = [];
	},

	append: function(location, propertyName, propertyNameWasString, patternNode, defaultValueExpression) {
		this.targetPatterns.push(new jsc.AST.ObjectPatternEntry(location, propertyName, propertyNameWasString, patternNode, defaultValueExpression));
	}
});


/**
 * Represents an entry in the ObjectPatternNode target patterns.
 *
 * @class
 */
jsc.AST.ObjectPatternEntry = Object.define({
	initialize: function(location, propertyName, propertyNameWasString, pattern, defaultValueExpression) {
		this.position = new jsc.TextPosition(location.line, location.begin, location.lineBegin);
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
	initialize: function($super, location, boundName, bindingContextKind) {
		$super(jsc.AST.NodeKind.BINDING_PATTERN, location);

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
	initialize: function(name, begin, end) {
		this.name = name;
		this.begin = begin;
		this.end = end;
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
	initialize: function(expr, count, op) {
		this.expression = expr;
		this.count = count;
		this.op = op;
	}
});


/** @class */
jsc.AST.BinaryOperand = Object.define({
	initialize: function(expr, hasAssignments) {
		this.expression = expr;
		this.hasAssignments = hasAssignments;
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