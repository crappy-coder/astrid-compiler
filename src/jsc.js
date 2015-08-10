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
		Lexer: lexer,
		Parser: parser.Parser,
		ParserScope: parser.ParserScope,
		SourceCode: source,
		TextBuffer: text.TextBuffer,
		TextPosition: text.TextPosition,
		TextSpan: text.TextSpan,
		TextUtils: text.TextUtils,
		Token: token,
		Utils: utils
	};
	
	Object.extend(jsc, {
		parse: function(source, debugMode) {
			var parser = new jsc.Parser(source, null, false);
			var parserResult = null;
			
			parser.debugMode = jsc.Utils.valueOrDefault(debugMode, false);
			parserResult = parser.parse();
			
			if(!debugMode && parser.hasError)
			{
				var err = new Error(parser.error);
				err.name = "Parse Error";
				
				throw err;
			}
		}
	});
	
	module.exports = exports = jsc;
})();

