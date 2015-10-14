"use strict"

var jsc = require("../src/jsc");
var path = require("path");
var fs = require("fs");
var outDir = "./tests/output/write/es5";
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
	"./tests/files/function-rest-parameters.js",
	"./tests/files/import-all.js",
	"./tests/files/import-default-member.js",
	"./tests/files/import-default-member-with-all.js",
	"./tests/files/import-default-member-with-members.js",
	"./tests/files/import-member.js",
	"./tests/files/import-member-as-alias.js",
	"./tests/files/import-members.js",
	"./tests/files/import-members-as-alias.js",
	"./tests/files/import-module.js",
	"./tests/files/import-name.js",
	"./tests/files/export-default.js",
	"./tests/files/export-name.js",
	"./tests/files/export-names.js",
	"./tests/files/class.js",
	"./tests/files/class-extends.js"
];

function processFile(filePath) {
	var fileName = path.basename(filePath);
	var outputFilePath = path.resolve(path.join(outDir, fileName));
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
			var parseResult = parseFile(filePath);

			if(parseResult)
				writeFile(outputFilePath, parseResult);
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

function parseFile(filePath) {
	var data = fs.readFileSync(filePath);
	var source = new jsc.SourceCode(data.toString(), filePath);
	var result = null;

	jsc.parse(source, function(parseResult, parseError) {
		if(parseError)
			throw new Error(parseError.message + "\n\tat " + parseError.fileName + ":" + parseError.line + ":" + parseError.column);

		result = parseResult;
	});

	return result;
}

function writeFile(outputFilePath, program) {
	var generator = new jsc.Generator(jsc.Writers.ES5());
	var script = generator.run(program);

	if(generator.hasErrors)
		throw new Error(generator.errors.join("\n"));

	if(fs.existsSync(outputFilePath))
		fs.unlinkSync(outputFilePath);

	if(script.length == 0)
		throw new Error("Unable to generate source code.");

	fs.writeFileSync(outputFilePath, script);

	parseFile(outputFilePath);
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

function createDirectory(dirPath) {
	var success = true;

	dirPath.split(/[\/\\]/g).reduce(function(parts, part) {
		parts += part + '/';
		var subpath = path.resolve(parts);

		if (!fs.existsSync(subpath))
		{
			try
			{
        		fs.mkdirSync(subpath);
      		}
      		catch(e)
      		{
      			success = false;
        		console.log("Unable to create directory '%s' (Error Code: %s).", subpath, e.code);
      		}
		}

		return parts;

	}, '');

	return success;
}

(function() {

	if(!fs.existsSync(outDir))
	{
		if(!createDirectory(outDir) || !fs.existsSync(outDir))
		{
			write("%c%s %c%s", symbols.error, "Unable to create the output directory '" + path.resolve(outDir) + "'.", styles.error, styles.fail);
			return;
		}
	}

	for(var i = 0; i < files.length; i++)
	{
		processFile(path.resolve(files[i]));
	}
})();
