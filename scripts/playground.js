"use strict"

var jsc = require("../src/jsc");
var path = require("path");
var fs = require("fs");
var srcFilePath = path.join(path.dirname(module.filename), "playground-script.js");
var dstFilePath = path.join(path.dirname(module.filename), "playground-writer-output.js");

fs.readFile(srcFilePath, function(err, data) {

	jsc.parse(new jsc.SourceCode(data.toString(), srcFilePath), function(result, parseError) {
		if(result)
		{
			var generator = new jsc.Generator(jsc.Writers.ES5());
			var script = generator.run(result);

			if(generator.hasErrors)
			{
				console.log("GENERATION ERRORS:");
				console.log(generator.errors);
				return;
			}

			fs.writeFile(dstFilePath, script, null, function(writeErr) {
				if(writeErr)
					console.error(writeErr);
				else
				{
					console.log();
					console.log("SCRIPT WRITTEN TO: " + dstFilePath);
					console.log("-----------------------------------------------------------------");
					console.log(script);
					console.log("-----------------------------------------------------------------");
				}
			});
		}

	}, true);
});

;(function() {

})();
