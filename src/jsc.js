var ast = require("./ast");
var lexer = require("./lexer");
var parser = require("./parser");
var source = require("./source-code");
var text = require("./text");
var token = require("./token");
var utils = require("./utils");

;(function() {
	var jsc = {
		AST: ast,
		Generator: require("./generator"),
		Lexer: lexer,
		Parser: parser.Parser,
		ParserScope: parser.ParserScope,
		SourceCode: source,
		TextBuffer: text.TextBuffer,
		TextPosition: text.TextPosition,
		TextSpan: text.TextSpan,
		TextUtils: text.TextUtils,
		Token: token,
		Utils: utils,
		Optimizers: require("./optimizers"),
		Writers: require("./writers")
	};
	
	Object.extend(jsc, {
		parse: function(source, callback, debugMode) {
			var parser = new jsc.Parser(source, null, false);
			var parserResult = null;

			parser.debugMode = jsc.Utils.valueOrDefault(debugMode, false);
			parserResult = parser.parse();

			callback(parserResult, parser.hasError ? parser.error : null);
		}
	});
	
	module.exports = exports = jsc;
})();

