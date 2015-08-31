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
			lastKeyword: null,
			pendingNewLineCount: 0,
			pendingSemicolonCount: 0,
			pendingSemicolon: false
		};
	},

	writeNode: function(astNode) {
		if(jsc.Utils.isNull(astNode))
			return;

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
	},

	writeArgumentListNode: function(node) {
		this.printNode(node);
	},

	writeArrayExpression: function(node) {
		this.printNode(node);
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
		this.write(node.value ? "true" : "false");
	},

	writeBracketAccessorExpression: function(node) {
		this.writeNode(node.base);
		this.writeBracketAccessor(node.subscript);
	},

	writeBreakStatement: function(node) {
		this.printNode(node);
	},

	writeCommaExpression: function(node) {
		this.printNode(node);
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
		this.printNode(node);
	},

	writeConstStatement: function(node) {
		this.printNode(node);
	},

	writeContinueStatement: function(node) {
		this.printNode(node);
	},

	writeDebuggerStatement: function(node) {
		this.write("debugger");
		this.writeSemicolon();
	},

	writeDeleteBracketExpression: function(node) {
		this.printNode(node);
	},

	writeDeleteDotExpression: function(node) {
		this.printNode(node);
	},

	writeDeleteResolveExpression: function(node) {
		this.printNode(node);
	},

	writeDeleteValueExpression: function(node) {
		this.printNode(node);
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
		// TODO: add option to omit empty statements
		this.writeSemicolon(
			!this.isLastNodeOfKind(jsc.AST.NodeKind.EMPTY));
	},

	writeEvalStatement: function(node) {
		this.printNode(node);
	},
	
	writeExpressionStatement: function(node) {
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeForStatement: function(node) {
		this.printNode(node);
	},

	writeForInStatement: function(node) {
		this.printNode(node);
	},

	writeFunctionNode: function(node) {
		this.write("function %s", node.name);

		this.write("(");
		this.writeList(node.parameterNames);
		this.write(")");

		this.writeSpace();

		this.writeLine('{');

		this.pushIndent();
		this.writeStatements(node);
		this.popIndent();

		// function expression will be terminated by a semicolon, so don't write
		// a newline after the curly brace
		if(node.ownerKind === jsc.AST.NodeKind.FUNCTION_EXPR)
			this.write('}');
		else
			this.writeLine('}');
	},

	writeApplyDotFunctionCallExpression: function(node) {
		this.printNode(node);
	},

	writeCallDotFunctionCallExpression: function(node) {
		this.printNode(node);
	},

	writeFunctionDeclarationStatement: function(node) {
		this.writeLine();
		this.writeNode(node.functionNode);
	},

	writeFunctionExpression: function(node) {
		this.writeNode(node.functionNode);
	},

	writeBracketFunctionCallExpression: function(node) {
		this.printNode(node);
	},

	writeDotFunctionCallExpression: function(node) {
		this.printNode(node);
	},

	writeEvalFunctionCallExpression: function(node) {
		this.printNode(node);
	},

	writeResolveFunctionCallExpression: function(node) {
		this.printNode(node);
	},

	writeValueFunctionCallExpression: function(node) {
		this.printNode(node);
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
		this.printNode(node);
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
		this.printNode(node);
	},

	writeNullExpression: function(node) {
		this.write("null");
	},

	writeNumberExpression: function(node) {
		this.write(node.value);
	},

	writeObjectLiteralExpression: function(node) {
		this.printNode(node);
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
		this.printNode(node);
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
		this.printNode(node);
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
		this.write("\"%s\"", node.value);
	},

	writeSwitchStatement: function(node) {
		this.printNode(node);
	},

	writeThisExpression: function(node) {
		this.write("this");
	},

	writeThrowStatement: function(node) {
		this.printNode(node);
	},

	writeTryStatement: function(node) {
		this.printNode(node);
	},

	writeTypeOfResolveExpression: function(node) {
		this.printNode(node);
	},

	writeTypeOfValueExpression: function(node) {
		this.printNode(node);
	},

	writeUnaryPlusExpression: function(node) {
		this.printNode(node);
	},

	writeVarStatement: function(node) {
		this.write("var");
		this.writeSpace();
		this.writeNode(node.expression);
		this.writeSemicolon();
	},

	writeVoidExpression: function(node) {
		this.printNode(node);
	},

	writeWhileStatement: function(node) {
		this.writeKeyword(jsc.AST.Keyword.WHILE);
		this.writeParenthesizedExpression(node.expression);
		this.writeBlock(node.statement);
	},

	writeWithStatement: function(node) {
		this.printNode(node);
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

	writeParenthesizedExpression: function(node) {
		this.write('(');
		this.writeNode(node);
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

		this.state.pendingSemicolon = true;
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
		return;
		if(this.state.pendingSemicolon)
		{
			this.writeImpl(";");
			this.state.pendingSemicolon = false;
		}
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
	}
});



/**
 * The writer options.
 *
 * @class
 */
jsc.Writers.Writer.Options = Object.define({
	initialize: function(tabSize, newLineStyle) {
		this.tabSize = jsc.Utils.valueOrDefault(tabSize, 4);
		this.newLineStyle = jsc.Utils.valueOrDefault(newLineStyle, jsc.Writers.Writer.NewLineStyle.Unix);
	}
});

Object.extend(jsc.Writers.Writer.Options, {
	get Default() {
		return new jsc.Writers.Writer.Options();
	}
});


module.exports = jsc.Writers.Writer;