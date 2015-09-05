var jsc = require("./../jsc");

/** @namespace */
jsc.Writers = jsc.Writers || {};


/**
 * The default AST writer. This is a pass-through writer that does not perform any
 * translations of the AST nodes.
 *
 * @class
 */
jsc.Writers.Writer = Object.define({
	initialize: function(options) {
		this.options = options || jsc.Writers.Writer.Options.Default;
		this.buffer = "";
		this.state = {
			position: jsc.TextPosition.Zero,
			indentLevel: 0,
			indentString: "",
			lastNode: null,
			lastStatement: null,
			lastExpression: null,
			lastKeyword: null,
			pendingNewLineCount: 0,
			pendingSemicolonCount: 0
		};
	},

	writeNode: function(astNode) {
		if(jsc.Utils.isNull(astNode))
			return;

		if(this.state.lastStatement && astNode.isStatement && (astNode.lineNumber - this.state.lastStatement.lineNumber) > 1 && this.state.pendingSemicolonCount > 0)
			this.writeLine();

		switch(astNode.kind)
		{
			// binary expression node
			case jsc.AST.NodeKind.ADD:
			case jsc.AST.NodeKind.BITWISE_AND:
			case jsc.AST.NodeKind.BITWISE_OR:
			case jsc.AST.NodeKind.BITWISE_XOR:
			case jsc.AST.NodeKind.DIVIDE:
			case jsc.AST.NodeKind.EQUAL:
			case jsc.AST.NodeKind.EQUAL_STRICT:
			case jsc.AST.NodeKind.GREATER:
			case jsc.AST.NodeKind.GREATER_EQ:
			case jsc.AST.NodeKind.IN:
			case jsc.AST.NodeKind.INSTANCEOF:
			case jsc.AST.NodeKind.LEFT_SHIFT:
			case jsc.AST.NodeKind.LESS:
			case jsc.AST.NodeKind.LESS_EQ:
			case jsc.AST.NodeKind.MODULUS:
			case jsc.AST.NodeKind.MULTIPLY:
			case jsc.AST.NodeKind.NOT_EQUAL:
			case jsc.AST.NodeKind.NOT_EQUAL_STRICT:
			case jsc.AST.NodeKind.RIGHT_SHIFT:
			case jsc.AST.NodeKind.RIGHT_SHIFT_UNSIGNED:
			case jsc.AST.NodeKind.SUBTRACT:
				this.writeBinaryExpression(astNode);
				break;


			case jsc.AST.NodeKind.ARGUMENT_LIST:
				this.writeArgumentListNode(astNode);
				break;

			case jsc.AST.NodeKind.ARRAY:
				this.writeArrayExpression(astNode);
				break;

			case jsc.AST.NodeKind.ASSIGN_BRACKET:
				this.writeAssignBracketExpression(astNode);
				break;

			case jsc.AST.NodeKind.ASSIGN_DOT:
				this.writeAssignDotExpression(astNode);
				break;

			case jsc.AST.NodeKind.ASSIGN_ERROR:
				this.writeAssignErrorExpression(astNode);
				break;

			case jsc.AST.NodeKind.ASSIGN_RESOLVE:
				this.writeAssignResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.BITWISE_NOT:
				this.writeBitwiseNotExpression(astNode);
				break;

			case jsc.AST.NodeKind.BLOCK:
				this.writeBlockStatement(astNode);
				break;

			case jsc.AST.NodeKind.BOOLEAN:
				this.writeBooleanExpression(astNode);
				break;

			case jsc.AST.NodeKind.BRACKET_ACCESSOR:
				this.writeBracketAccessorExpression(astNode);
				break;

			case jsc.AST.NodeKind.BREAK:
				this.writeBreakStatement(astNode);
				break;

			case jsc.AST.NodeKind.COMMA:
				this.writeCommaExpression(astNode);
				break;

			case jsc.AST.NodeKind.CONDITIONAL:
				this.writeConditionalExpression(astNode);
				break;

			case jsc.AST.NodeKind.CONST_DECL:
				this.writeConstantDeclarationExpression(astNode);
				break;

			case jsc.AST.NodeKind.CONST_STATEMENT:
				this.writeConstStatement(astNode);
				break;

			case jsc.AST.NodeKind.CONTINUE:
				this.writeContinueStatement(astNode);
				break;

			case jsc.AST.NodeKind.DEBUGGER:
				this.writeDebuggerStatement(astNode);
				break;

			case jsc.AST.NodeKind.DELETE_BRACKET:
				this.writeDeleteBracketExpression(astNode);
				break;

			case jsc.AST.NodeKind.DELETE_DOT:
				this.writeDeleteDotExpression(astNode);
				break;

			case jsc.AST.NodeKind.DELETE_RESOLVE:
				this.writeDeleteResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.DELETE_VALUE:
				this.writeDeleteValueExpression(astNode);
				break;

			case jsc.AST.NodeKind.DOT_ACCESSOR:
				this.writeDotAccessorExpression(astNode);
				break;

			case jsc.AST.NodeKind.DO_WHILE:
				this.writeDoWhileStatement(astNode);
				break;

			case jsc.AST.NodeKind.EMPTY:
				this.writeEmptyStatement(astNode);
				break;

			case jsc.AST.NodeKind.EVAL:
				this.writeEvalStatement(astNode);
				break;

			case jsc.AST.NodeKind.EXPR_STATEMENT:
				this.writeExpressionStatement(astNode);
				break;

			case jsc.AST.NodeKind.FOR:
				this.writeForStatement(astNode);
				break;

			case jsc.AST.NodeKind.FOR_IN:
				this.writeForInStatement(astNode);
				break;

			case jsc.AST.NodeKind.FUNCTION:
				this.writeFunctionNode(astNode);
				break;

			case jsc.AST.NodeKind.FUNCTION_APPLY:
				this.writeApplyDotFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNCTION_CALL:
				this.writeCallDotFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNCTION_DECL:
				this.writeFunctionDeclarationStatement(astNode);
				break;

			case jsc.AST.NodeKind.FUNCTION_EXPR:
				this.writeFunctionExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNC_CALL_BRACKET:
				this.writeBracketFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNC_CALL_DOT:
				this.writeDotFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNC_CALL_EVAL:
				this.writeEvalFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNC_CALL_RESOLVE:
				this.writeResolveFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.FUNC_CALL_VALUE:
				this.writeValueFunctionCallExpression(astNode);
				break;

			case jsc.AST.NodeKind.IF:
				this.writeIfStatement(astNode);
				break;

			case jsc.AST.NodeKind.IF_ELSE:
				this.writeIfStatement(astNode);
				break;

			case jsc.AST.NodeKind.LABEL:
				this.writeLabelStatement(astNode);
				break;

			case jsc.AST.NodeKind.LOGICAL_NOT:
				this.writeLogicalNotExpression(astNode);
				break;

			case jsc.AST.NodeKind.LOGICAL_OP:
				this.writeLogicalExpression(astNode);
				break;

			case jsc.AST.NodeKind.NEGATE:
				this.writeNegateExpression(astNode);
				break;

			case jsc.AST.NodeKind.NEW:
				this.writeNewExpression(astNode);
				break;

			case jsc.AST.NodeKind.NULL:
				this.writeNullExpression(astNode);
				break;

			case jsc.AST.NodeKind.NUMBER:
				this.writeNumberExpression(astNode);
				break;

			case jsc.AST.NodeKind.OBJECT_LITERAL:
				this.writeObjectLiteralExpression(astNode);
				break;

			case jsc.AST.NodeKind.POSTFIX_BRACKET:
				this.writePostfixBracketExpression(astNode);
				break;

			case jsc.AST.NodeKind.POSTFIX_DOT:
				this.writePostfixDotExpression(astNode);
				break;

			case jsc.AST.NodeKind.POSTFIX_ERROR:
				this.writePostfixErrorExpression(astNode);
				break;

			case jsc.AST.NodeKind.POSTFIX_RESOLVE:
				this.writePostfixResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.PREFIX_BRACKET:
				this.writePrefixBracketExpression(astNode);
				break;

			case jsc.AST.NodeKind.PREFIX_DOT:
				this.writePrefixDotExpression(astNode);
				break;

			case jsc.AST.NodeKind.PREFIX_ERROR:
				this.writePrefixErrorExpression(astNode);
				break;

			case jsc.AST.NodeKind.PREFIX_RESOLVE:
				this.writePrefixResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.PROPERTY_LIST:
				this.writePropertyListNode(astNode);
				break;

			case jsc.AST.NodeKind.READ_MODIFY_BRACKET:
				this.writeReadModifyBracketExpression(astNode);
				break;

			case jsc.AST.NodeKind.READ_MODIFY_DOT:
				this.writeReadModifyDotExpression(astNode);
				break;

			case jsc.AST.NodeKind.READ_MODIFY_RESOLVE:
				this.writeReadModifyResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.REGEX:
				this.writeRegExExpression(astNode);
				break;

			case jsc.AST.NodeKind.RESOLVE:
				this.writeResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.RETURN:
				this.writeReturnStatement(astNode);
				break;

			case jsc.AST.NodeKind.SCRIPT:
				this.writeScriptNode(astNode);
				break;

			case jsc.AST.NodeKind.STRING:
				this.writeStringExpression(astNode);
				break;

			case jsc.AST.NodeKind.SWITCH:
				this.writeSwitchStatement(astNode);
				break;

			case jsc.AST.NodeKind.THIS:
				this.writeThisExpression(astNode);
				break;

			case jsc.AST.NodeKind.THROW:
				this.writeThrowStatement(astNode);
				break;

			case jsc.AST.NodeKind.TRY:
				this.writeTryStatement(astNode);
				break;

			case jsc.AST.NodeKind.TYPEOF_RESOLVE:
				this.writeTypeOfResolveExpression(astNode);
				break;

			case jsc.AST.NodeKind.TYPEOF_VALUE:
				this.writeTypeOfValueExpression(astNode);
				break;

			case jsc.AST.NodeKind.UNARY_PLUS:
				this.writeUnaryPlusExpression(astNode);
				break;

			case jsc.AST.NodeKind.VAR:
				this.writeVarStatement(astNode);
				break;

			case jsc.AST.NodeKind.VOID:
				this.writeVoidExpression(astNode);
				break;

			case jsc.AST.NodeKind.WHILE:
				this.writeWhileStatement(astNode);
				break;

			case jsc.AST.NodeKind.WITH:
				this.writeWithStatement(astNode);
				break;
		}

		this.state.lastNode = astNode;

		if(astNode.isStatement)
			this.state.lastStatement = astNode;

		if(astNode.isExpression)
			this.state.lastExpression = astNode;
	},

	writeArgumentListNode: function(node) {
		for(var a = node; a !== null; a = a.next)
		{
			this.writeNode(a.expression);

			if(!jsc.Utils.isNull(a.next))
			{
				this.write(',');
				this.writeSpace();
			}
		}
	},

	writeArrayExpression: function(node) {
		var i;

		this.write('[');

		for(var el = node.elements; el !== null; el = el.nextElement)
		{
			// write a space only between two elements that contain a value
			if(el !== node.elements && el.elision === 0)
				this.writeSpace();

			// write in empty elements
			for(i = 0; i < el.elision; i++)
				this.write(',');

			// write the element value
			this.writeNode(el.expression);

			if(el.nextElement || node.elision)
				this.write(',');
		}

		// write the remaining empties
		for(i = 0; i < node.elision; i++)
			this.write(',');

		this.write(']');
	},

	writeAssignBracketExpression: function(node) {
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
		this.writeAssignmentOperator(jsc.AST.AssignmentOperatorKind.EQUAL);
		this.writeNode(node.right);
	},

	writeAssignDotExpression: function(node) {
		this.writeDotAccessor(node);
		this.writeAssignmentOperator(jsc.AST.AssignmentOperatorKind.EQUAL);
		this.writeNode(node.right);
	},

	writeAssignErrorExpression: function(node) {
		this.writeNode(node.left);
		this.writeAssignmentOperator(jsc.AST.AssignmentOperatorKind.EQUAL);
		this.writeNode(node.right);
	},

	writeAssignResolveExpression: function(node) {
		this.write(node.name);
		this.writeAssignmentOperator(jsc.AST.AssignmentOperatorKind.EQUAL);
		this.writeNode(node.right);
	},

	writeBitwiseNotExpression: function(node) {
		this.write('~');
		this.writeNode(node.expression);
	},

	writeBlockStatement: function(node) {
		this.writeLine('{');
		this.pushIndent();
		this.writeStatements(node);
		this.popIndent();
		this.writeLine('}');
	},

	writeBooleanExpression: function(node) {
		this.write(node.value ? jsc.AST.Keyword.TRUE : jsc.AST.Keyword.FALSE);
	},

	writeBracketAccessorExpression: function(node) {
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
	},

	writeBreakStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.BREAK);

		if(!jsc.Utils.isStringNullOrEmpty(node.name))
		{
			this.writeSpace();
			this.write(node.name);
		}

		this.writeSemicolon();
	},

	writeCommaExpression: function(node) {
		for(var i = 0; i < node.count; i++)
		{
			var expression = node.get(i);

			if(!jsc.Utils.isNull(expression))
			{
				if(i !== 0)
				{
					this.write(',');
					this.writeSpace();
				}

				this.writeNode(expression);
			}
		}
	},

	writeConditionalExpression: function(node) {
		this.writeNode(node.conditionExpression);

		this.writeSpace();
		this.write('?');
		this.writeSpace();

		this.writeNode(node.leftExpression);

		this.writeSpace();
		this.write(':');
		this.writeSpace();

		this.writeNode(node.rightExpression);
	},

	writeConstantDeclarationExpression: function(node) {
		for(var c = node; c !== null; c = c.next)
		{
			this.write(c.name);

			if(c.hasInitializer)
			{
				this.writeAssignmentOperator(jsc.AST.AssignmentOperatorKind.EQUAL);
				this.writeNode(c.initializeExpression);
			}

			if(!jsc.Utils.isNull(c.next))
			{
				this.write(',');
				this.writeSpace();
			}
		}
	},

	writeConstStatement: function(node) {
		this.write(jsc.AST.Keyword.CONST);
		this.writeSpace();
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeContinueStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.CONTINUE);

		if(!jsc.Utils.isStringNullOrEmpty(node.name))
		{
			this.writeSpace();
			this.write(node.name);
		}

		this.writeSemicolon();
	},

	writeDebuggerStatement: function(node) {
		void(node);

		this.writeKeyword(jsc.AST.Keyword.DEBUGGER);
		this.writeSemicolon();
	},

	writeDeleteBracketExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.DELETE);
		this.writeSpace();
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
	},

	writeDeleteDotExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.DELETE);
		this.writeSpace();
		this.writeDotAccessor(node);
	},

	writeDeleteResolveExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.DELETE);
		this.writeSpace();
		this.write(node.name);
	},

	writeDeleteValueExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.DELETE);
		this.writeSpace();
		this.writeNode(node.expression);
	},

	writeDotAccessorExpression: function(node) {
		this.writeDotAccessor(node);
	},

	writeDoWhileStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.DO);
		this.writeBlock(node.statement);

		this.writeKeyword(jsc.AST.Keyword.WHILE);
		this.writeParenthesizedExpression(node.expression);
		this.writeSemicolon();
	},

	writeEmptyStatement: function(node) {
		void(node);

		// TODO: add option to omit empty statements
		this.writeSemicolon(
			!this.isLastNodeOfKind(jsc.AST.NodeKind.EMPTY));
	},

	writeEvalStatement: function(node) {
		void(node);

		throw new Error("Eval statement is not supported.");
	},
	
	writeExpressionStatement: function(node) {
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeForStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.FOR);
		this.writeSpace();
		this.write('(');

		if(node.isFirstExpressionVarDeclaration)
		{
			this.writeKeyword(jsc.AST.Keyword.VAR);
			this.writeSpace();
		}

		this.writeNode(node.initializeExpression);
		this.writeSemicolon(false);

		if(!jsc.Utils.isNull(node.conditionExpression))
		{
			this.writeSpace();
			this.writeNode(node.conditionExpression);
		}

		this.writeSemicolon(false);

		if(!jsc.Utils.isNull(node.incrementExpression))
		{
			this.writeSpace();
			this.writeNode(node.incrementExpression);
		}

		this.write(')');
		this.writeBlock(node.statement);
	},

	writeForInStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.FOR);
		this.writeSpace();
		this.write('(');

		if(node.nameIsVarDeclaration)
		{
			this.writeKeyword(jsc.AST.Keyword.VAR);
			this.writeSpace();
		}

		if(jsc.Utils.isNull(node.initializeExpression))
		{
			this.writeNode(node.leftExpression);
			this.writeSpace();
		}
		else
		{
			this.writeNode(node.initializeExpression);
			this.writeSpace();
		}

		this.writeKeyword(jsc.AST.Keyword.IN);
		this.writeSpace();

		this.writeNode(node.rightExpression);

		this.write(')');
		this.writeBlock(node.statement);
	},

	writeFunctionNode: function(node, isGetterOrSetter) {
		isGetterOrSetter = jsc.Utils.valueOrDefault(isGetterOrSetter, false);

		if(!isGetterOrSetter)
		{
			this.writeKeyword(jsc.AST.Keyword.FUNCTION);

			if(!jsc.Utils.isStringNullOrEmpty(node.name))
			{
				this.writeSpace();
				this.write(node.name);
			}
		}

		this.write('(');
		this.writeList(node.parameterNames);
		this.write(')');

		this.writeSpace();

		this.writeLine('{');

		this.pushIndent();
		this.writeStatements(node);
		this.popIndent();

		this.write('}');
	},

	writeApplyDotFunctionCallExpression: function(node) {
		this.writeDotAccessor(node);
		this.writeParenthesizedExpression(node.args);
	},

	writeCallDotFunctionCallExpression: function(node) {
		this.writeDotAccessor(node);
		this.writeParenthesizedExpression(node.args);
	},

	writeFunctionDeclarationStatement: function(node) {
		this.writeLine();
		this.writeNode(node.functionNode);
	},

	writeFunctionExpression: function(node) {
		this.writeNode(node.functionNode);
	},

	writeBracketFunctionCallExpression: function(node) {
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
		this.writeParenthesizedExpression(node.args);
	},

	writeDotFunctionCallExpression: function(node) {
		this.writeDotAccessor(node);
		this.writeParenthesizedExpression(node.args);
	},

	writeEvalFunctionCallExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.EVAL);
		this.writeParenthesizedExpression(node.args);
	},

	writeResolveFunctionCallExpression: function(node) {
		this.write(node.name);
		this.writeParenthesizedExpression(node.args);
	},

	writeValueFunctionCallExpression: function(node) {
		this.writeNode(node.expression);
		this.writeParenthesizedExpression(node.args);
	},

	writeIfStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.IF);
		this.writeSpace();
		this.writeParenthesizedExpression(node.conditionExpression);

		this.writeBlock(node.ifBlock);

		if(this.isNodeOfKind(node, jsc.AST.NodeKind.IF_ELSE))
		{
			this.writeKeyword(jsc.AST.Keyword.ELSE);
			this.writeBlock(node.elseBlock);
		}
	},

	writeLabelStatement: function(node) {
		this.write(node.name);
		this.writeLine(':');

		this.pushIndent();
		this.writeNode(node.statement);
		this.popIndent();
	},

	writeLogicalNotExpression: function(node) {
		this.write('!');
		this.writeNode(node.expression);
	},

	writeLogicalExpression: function(node) {
		this.writeNode(node.leftExpression);
		this.writeSpace();

		switch(node.logicalOperator)
		{
			case jsc.AST.LogicalOperatorKind.AND:
				this.write("&&");
				break;
			case jsc.AST.LogicalOperatorKind.OR:
				this.write("||");
				break;
		}

		this.writeSpace();
		this.writeNode(node.rightExpression);
	},

	writeNegateExpression: function(node) {
		this.write('-');
		this.writeNode(node.expression);
	},

	writeNewExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.NEW);
		this.writeSpace();
		this.writeNode(node.expression);
		this.writeParenthesizedExpression(node.args);
	},

	writeNullExpression: function(node) {
		void(node);

		this.writeKeyword(jsc.AST.Keyword.NULL);
	},

	writeNumberExpression: function(node) {
		this.write(node.value);
	},

	writeObjectLiteralExpression: function(node) {
		this.writeLine('{');
		this.pushIndent();
		this.writeNode(node.properties);
		this.popIndent();
		this.write('}');
	},

	writePostfixBracketExpression: function(node) {
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
		this.writeAssignmentOperator(node.operatorKind);
	},

	writePostfixDotExpression: function(node) {
		this.writeDotAccessor(node);
		this.writeAssignmentOperator(node.operatorKind);
	},

	writePostfixErrorExpression: function(node) {
		this.writeNode(node.expression);
		this.writeAssignmentOperator(node.operatorKind);
	},

	writePostfixResolveExpression: function(node) {
		this.write(node.name);
		this.writeAssignmentOperator(node.operatorKind);
	},

	writePrefixBracketExpression: function(node) {
		this.writeAssignmentOperator(node.operatorKind);
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
	},

	writePrefixDotExpression: function(node) {
		this.writeAssignmentOperator(node.operatorKind);
		this.writeDotAccessor(node);
	},

	writePrefixErrorExpression: function(node) {
		this.writeAssignmentOperator(node.operatorKind);
		this.writeNode(node.expression);
	},

	writePrefixResolveExpression: function(node) {
		this.writeAssignmentOperator(node.operatorKind);
		this.write(node.name);
	},

	writePropertyListNode: function(node) {
		for(var p = node; p !== null; p = p.next)
		{
			if(this.writePropertyNode(p.property) && p.next)
				this.write(',');

			this.writeLine();
		}
	},

	writePropertyNode: function(node) {
		if(jsc.Utils.isNull(node))
			return false;

		if(node.isGetter || node.isSetter)
		{
			this.writeKeyword(node.isGetter ? jsc.AST.Keyword.GET : jsc.AST.Keyword.SET);
			this.writeSpace();
			this.write(node.name);
			this.writeFunctionNode(node.expression.functionNode, true);
		}
		else
		{
			this.write(node.name);
			this.write(':');
			this.writeSpace();
			this.writeNode(node.expression);
		}

		return true;
	},

	writeReadModifyBracketExpression: function(node) {
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
		this.writeAssignmentOperator(node.operatorKind);
		this.writeNode(node.right);
	},

	writeReadModifyDotExpression: function(node) {
		this.writeDotAccessor(node);
		this.writeAssignmentOperator(node.operatorKind);
		this.writeNode(node.right);
	},

	writeReadModifyResolveExpression: function(node) {
		this.write(node.name);
		this.writeAssignmentOperator(node.operatorKind);
		this.writeNode(node.right);
	},

	writeRegExExpression: function(node) {
		this.write('/');
		this.write(node.pattern);
		this.write('/');
		this.write(node.flags);
	},

	writeResolveExpression: function(node) {
		this.write(node.name);
	},

	writeReturnStatement: function(node) {
		this.write("return");
		this.writeSpace();
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeScriptNode: function(node) {
		this.writeStatements(node);
		this.finish();
	},

	writeStringExpression: function(node) {
		this.writeString(node.value);
	},

	writeSwitchStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.SWITCH);
		this.writeParenthesizedExpression(node.expression);
		this.writeSpace();
		this.writeLine('{');

		this.pushIndent();
		this.writeSwitchClauseListNode(jsc.AST.Keyword.CASE, node.firstClauseList);
		this.writeSwitchClauseListNode(jsc.AST.Keyword.DEFAULT, node.defaultClause);
		this.writeSwitchClauseListNode(jsc.AST.Keyword.CASE, node.secondClauseList);
		this.popIndent();
		this.writeLine('}');
	},

	writeSwitchClauseListNode: function(keyword, node) {
		for(var c = node; c !== null; c = c.next)
		{
			this.writeKeyword(keyword);

			if(keyword !== jsc.AST.Keyword.DEFAULT)
				this.writeSpace();

			if(!jsc.Utils.isNull(c.statements) && c.statements.length && this.isNodeOfKind(c.statements[0], jsc.AST.NodeKind.BLOCK))
			{
				this.writeNode(c.expression);
				this.write(':');
				this.writeSpace();

				this.writeStatements(c);
			}
			else
			{
				this.writeNode(c.expression);
				this.writeLine(':');

				this.pushIndent();
				this.writeStatements(c);
				this.popIndent();
			}
		}
	},

	writeThisExpression: function(node) {
		void(node);

		this.write("this");
	},

	writeThrowStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.THROW);
		this.writeSpace();
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeTryStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.TRY);
		this.writeBlock(node.tryBlock);

		if(!jsc.Utils.isNull(node.catchBlock))
		{
			this.writeKeyword(jsc.AST.Keyword.CATCH);
			this.writeParenthesizedExpression(node.exceptionVarName);
			this.writeBlock(node.catchBlock);
		}

		if(!jsc.Utils.isNull(node.finallyBlock))
		{
			this.writeKeyword(jsc.AST.Keyword.FINALLY);
			this.writeBlock(node.finallyBlock);
		}
	},

	writeTypeOfResolveExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.TYPEOF);
		this.writeSpace();
		this.write(node.name);
	},

	writeTypeOfValueExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.TYPEOF);
		this.writeSpace();
		this.writeNode(node.expression);
	},

	writeUnaryPlusExpression: function(node) {
		this.write('+');
		this.writeNode(node.expression);
	},

	writeVarStatement: function(node) {
		this.write(jsc.AST.Keyword.VAR);
		this.writeSpace();
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeVoidExpression: function(node) {
		this.writeKeyword(jsc.AST.Keyword.VOID);

		if(node.expression.isNumber)
		{
			this.writeParenthesizedExpression(node.expression);
			return;
		}

		this.writeSpace();
		this.writeNode(node.expression);
	},

	writeWhileStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.WHILE);
		this.writeParenthesizedExpression(node.expression);
		this.writeBlock(node.statement);
	},

	writeWithStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.WITH);
		this.writeParenthesizedExpression(node.expression);
		this.writeBlock(node.statement);
	},

	writeStatements: function(node) {
		if(jsc.Utils.isNull(node.statements))
			return;

		for(var i = 0; i < node.statements.length; i++)
			this.writeNode(node.statements[i]);
	},

	writeBlock: function(block) {
		if(block.isEmpty)
		{
			this.writeNode(block);
			return;
		}

		if(block.isIfOrIfElse || this.isNodeOfKind(block, jsc.AST.NodeKind.BLOCK))
		{
			this.writeSpace();
			this.writeNode(block);
		}
		else
		{
			this.writeLine();
			this.pushIndent();
			this.writeNode(block);
			this.popIndent();
		}
	},

	writeDotAccessor: function(node) {
		this.writeNode(node.base);
		this.write('.');
		this.write(node.name);
	},

	writeBracketAccessor: function(node) {
		this.write('[');
		this.writeNode(node);
		this.write(']');
	},

	writeParenthesizedExpression: function(nodeOrString) {
		this.write('(');

		if(jsc.Utils.isString(nodeOrString))
			this.write(nodeOrString);
		else
			this.writeNode(nodeOrString);

		this.write(')');
	},

	writeAssignmentOperator: function(assignmentOpKind) {
		// no spacing for '++' or '--'
		if(assignmentOpKind === jsc.AST.AssignmentOperatorKind.PLUS_PLUS || assignmentOpKind === jsc.AST.AssignmentOperatorKind.MINUS_MINUS)
		{
			this.write(assignmentOpKind === jsc.AST.AssignmentOperatorKind.PLUS_PLUS ? "++" : "--");
			return;
		}

		this.writeSpace();

		switch(assignmentOpKind)
		{
			case jsc.AST.AssignmentOperatorKind.EQUAL:
				this.write("=");
				break;
			case jsc.AST.AssignmentOperatorKind.PLUS_EQUAL:
				this.write("+=");
				break;
			case jsc.AST.AssignmentOperatorKind.MINUS_EQUAL:
				this.write("-=");
				break;
			case jsc.AST.AssignmentOperatorKind.MULTIPLY_EQUAL:
				this.write("*=");
				break;
			case jsc.AST.AssignmentOperatorKind.DIVIDE_EQUAL:
				this.write("/=");
				break;
			case jsc.AST.AssignmentOperatorKind.LSHIFT_EQUAL:
				this.write("<<=");
				break;
			case jsc.AST.AssignmentOperatorKind.RSHIFT_EQUAL:
				this.write(">>=");
				break;
			case jsc.AST.AssignmentOperatorKind.RSHIFT_EQUAL_UNSIGNED:
				this.write(">>>=");
				break;
			case jsc.AST.AssignmentOperatorKind.AND_EQUAL:
				this.write("&=");
				break;
			case jsc.AST.AssignmentOperatorKind.OR_EQUAL:
				this.write("|=");
				break;
			case jsc.AST.AssignmentOperatorKind.XOR_EQUAL:
				this.write("^=");
				break;
			case jsc.AST.AssignmentOperatorKind.MOD_EQUAL:
				this.write("%=");
				break;
		}

		this.writeSpace();
	},

	writeBinaryExpression: function(node) {
		this.writeNode(node.leftExpression);
		this.writeSpace();

		// TODO: need to add operator grouping by operator precedence

		switch(node.opCode)
		{
			case jsc.AST.OpCode.ADD:
				this.write('+');
				break;
			case jsc.AST.OpCode.BITWISE_AND:
				this.write('&');
				break;
			case jsc.AST.OpCode.BITWISE_OR:
				this.write('|');
				break;
			case jsc.AST.OpCode.BITWISE_XOR:
				this.write('^');
				break;
			case jsc.AST.OpCode.DIVIDE:
				this.write('/');
				break;
			case jsc.AST.OpCode.EQUAL:
				this.write('==');
				break;
			case jsc.AST.OpCode.EQUAL_STRICT:
				this.write('===');
				break;
			case jsc.AST.OpCode.GREATER:
				this.write('>');
				break;
			case jsc.AST.OpCode.GREATER_EQ:
				this.write('>=');
				break;
			case jsc.AST.OpCode.IN:
				this.write('in');
				break;
			case jsc.AST.OpCode.INSTANCEOF:
				this.write('instanceof');
				break;
			case jsc.AST.OpCode.LEFT_SHIFT:
				this.write('<<');
				break;
			case jsc.AST.OpCode.LESS:
				this.write('<');
				break;
			case jsc.AST.OpCode.LESS_EQ:
				this.write('<=');
				break;
			case jsc.AST.OpCode.MODULUS:
				this.write('%');
				break;
			case jsc.AST.OpCode.MULTIPLY:
				this.write('*');
				break;
			case jsc.AST.OpCode.NOT_EQUAL:
				this.write('!=');
				break;
			case jsc.AST.OpCode.NOT_EQUAL_STRICT:
				this.write('!==');
				break;
			case jsc.AST.OpCode.RIGHT_SHIFT:
				this.write('>>');
				break;
			case jsc.AST.OpCode.RIGHT_SHIFT_UNSIGNED:
				this.write('>>>');
				break;
			case jsc.AST.OpCode.SUBTRACT:
				this.write('-');
				break;
		}

		this.writeSpace();
		this.writeNode(node.rightExpression);
	},

	writeList: function(list, delimiter) {
		delimiter = jsc.Utils.valueOrDefault(delimiter, ', ');

		if(jsc.Utils.isNull(list))
			return;

		var str = [];

		for(var i = 0; i < list.length; i++)
		{
			str.push(list[i]);
			str.push(delimiter);
		}

		if(str.length > 1)
			str.length -= 1;

		this.write(str.join(''));
	},

	writeKeyword: function(keyword) {
		this.write(keyword);
		this.state.lastKeyword = keyword;
	},

	writeSpace: function(count) {
		count = jsc.Utils.valueOrDefault(count, 1);

		if(count === 1)
			this.write(' ');
		else
		{
			for(var i = 0; i < count; ++i)
				this.write(' ');
		}
	},

	writeSemicolon: function(withLineBreak) {
		withLineBreak = jsc.Utils.valueOrDefault(withLineBreak, true);

		if(withLineBreak)
			this.writeLine();

		this.state.pendingSemicolonCount++;
	},

	write: function(str) {
		this.writePendingSemicolons();
		this.writePendingNewLines();

		if(arguments.length == 0)
			return;

		if(arguments.length > 1)
			str = jsc.Utils.format.apply(null, arguments);

		this.writeImpl(str);
	},

	writeString: function(str) {
		str = str.replace(/([\\])/g, '\\$1');
		str = str.replace(this.options.stringStyle === jsc.Writers.Writer.StringStyle.DoubleQuote ? /(["])/g : /(['])/g, '\\$1');
		str = str.replace(/[\f]/g, "\\f");
		str = str.replace(/[\b]/g, "\\b");
		str = str.replace(/[\n]/g, "\\n");
		str = str.replace(/[\t]/g, "\\t");
		str = str.replace(/[\r]/g, "\\r");

		this.write(this.options.stringStyle);
		this.write(str);
		this.write(this.options.stringStyle);
	},

	writeLine: function(str) {
		str = jsc.Utils.valueOrDefault(str, "");

		if(arguments.length > 1)
			str = jsc.Utils.format.apply(null, arguments);

		this.write(str);
		this.writeNewLine();
	},

	writeNewLine: function() {
		this.state.pendingNewLineCount += 1;
	},

	writePendingNewLines: function() {
		for(var i = 0; i < this.state.pendingNewLineCount; i++)
		{
			this.writeImpl(this.options.newLineStyle);
			this.writeImpl(this.state.indentString);
		}

		this.state.pendingNewLineCount = 0;
	},

	writePendingSemicolons: function() {
		for(var i = 0; i < this.state.pendingSemicolonCount; i++)
			this.writeImpl(';');

		this.state.pendingSemicolonCount = 0;
	},

	finish: function() {
		this.writePendingSemicolons();
		this.writePendingNewLines();
	},

	writeImpl: function(str) {
		this.buffer += str;
	},

	pushIndent: function() {
		this.state.indentLevel += this.options.tabSize;
		this.updateIndentString();
	},

	popIndent: function() {
		this.state.indentLevel = Math.max(0, this.state.indentLevel - this.options.tabSize);
		this.updateIndentString();
	},

	updateIndentString: function() {
		this.state.indentString = "";

		for(var i = 0; i < this.state.indentLevel; i++)
			this.state.indentString += ' ';
	},

	isNodeOfKind: function(node, kind) {
		return (node && node.kind === kind);
	},

	isLastNodeOfKind: function(kind) {
		return (this.state.lastNode && this.state.lastNode.kind === kind);
	},

	printNode: function(node) {
		console.log(jsc.AST.NodeKind.getName(node.kind));
		console.log(node);
		console.log();
	},

	toString: function() {
		return this.buffer;
	}
});

Object.extend(jsc.Writers.Writer, {
	NewLineStyle: {
		Windows: '\r\n',
		Unix: '\n'
	},

	StringStyle: {
		SingleQuote: '\'',
		DoubleQuote: '"'
	}
});



/**
 * The writer options.
 *
 * @class
 */
jsc.Writers.Writer.Options = Object.define({
	initialize: function(tabSize, newLineStyle, stringStyle) {
		this.tabSize = jsc.Utils.valueOrDefault(tabSize, 4);
		this.newLineStyle = jsc.Utils.valueOrDefault(newLineStyle, jsc.Writers.Writer.NewLineStyle.Unix);
		this.stringStyle = jsc.Utils.valueOrDefault(stringStyle, jsc.Writers.Writer.StringStyle.DoubleQuote);
	}
});

Object.extend(jsc.Writers.Writer.Options, {
	get Default() {
		return new jsc.Writers.Writer.Options();
	}
});


module.exports = jsc.Writers.Writer;