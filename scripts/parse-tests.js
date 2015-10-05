"use strict"

var jsc = require("../src/jsc");
var path = require("path");
var fs = require("fs");
var useColors = (!process.browser && (jsc.Utils.isNotUndefined(process.env.ASTRID_COLORS)));
var indent = {
	n: 0,
	push: function() {
		this.n++;
	},
	pop: function() {
		this.n--;
	},
	toString: function() {
		var str = "";

		for(var i = 0; i < this.n; i++)
			str += "    ";

		return str;
	}
};

var styles = {
	default: jsc.Utils.FormatStyle.Reset,
	working: jsc.Utils.FormatStyle.Bold.Blue(),
	checkmark: jsc.Utils.FormatStyle.Bold.Green(),
	error: jsc.Utils.FormatStyle.Bold.Red(),
	errorMessage: jsc.Utils.FormatStyle.Bold.Red(false, true),
	ok: jsc.Utils.FormatStyle.Green(),
	fail: jsc.Utils.FormatStyle.Red(),
	warn: jsc.Utils.FormatStyle.Bold.Yellow(false, true)
};

var symbols = {
	ok : (process.platform === 'win32' ? '\u221A' : '?'),
	error: (process.platform === 'win32' ? '\u00D7' : '?'),
	dot: (process.platform === 'win32' ? '.' : '?')
};

var files = [
	"./tests/files/additive-operators.js",
	"./tests/files/multiplicative-operators.js",
	"./tests/files/equality-operators.js",
	"./tests/files/logical-operators.js",
	"./tests/files/function-rest-parameters.js"
];

function parseFile(filePath) {
	var fileName = path.basename(filePath, path.extname(filePath));
	var error = null;
	var start = Date.now();

	if(!fs.existsSync(filePath))
	{
		error = jsc.Utils.format("The file '%s' does not exist.", filePath);
	}
	else
	{
		try
		{
			var data = fs.readFileSync(filePath);
			var source = new jsc.SourceCode(data.toString(), filePath);

			jsc.parse(source, function(parseResult, parseError) {
				if(parseError)
					error = parseError.message + "\n\tat " + parseError.fileName + ":" + parseError.line + ":" + parseError.column;
			});
		}
		catch(e)
		{
			error = e.message;
		}
	}

	var end = Date.now();
	var delta = end - start;

	if(error)
	{
		write("%c%s %c%s", symbols.error, fileName, styles.error, styles.fail);
		write("    %c%s", error, styles.errorMessage);
	}
	else
	{
		write("%c%s %c%s %c(%dms)", symbols.ok, fileName, delta, styles.checkmark, styles.ok, styles.working);
	}
}

function write(str) {
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(colorize(str));
	str = jsc.Utils.format.apply(null, args);

	console.log(indent.toString() + str);
}

function colorize(fmt) {
	if(useColors)
		return fmt;

	return String(fmt).replace(/%[c]/g, function(m) {
		if(m === "%c")
			return "";
	});
}

(function() {

	for(var i = 0; i < files.length; i++)
	{
		parseFile(path.resolve(files[i]));
	}
})();
