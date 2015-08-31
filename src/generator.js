var jsc = require("./jsc");
require("./ast");
require("./utils");

/**
 * The JavaScript source generator.
 *
 * @class
 */
jsc.Generator = Object.define({
	initialize: function(writer) {
		this.writer = jsc.Utils.valueOrDefault(writer, jsc.Writers.Default);
		this.optimizers = [];
		this.errors = [];
	},

	get hasErrors() {
		return (this.errors.length !== 0);
	},

	clearOptimizers: function() {
		this.optimizers = [];
	},

	addOptimizers: function(/* optimizerFunc1, [optimizerFuncN, ...] */) {
		for(var i = 0; i < arguments.length; i++)
		{
			if(!jsc.Utils.isFunction(arguments[i]))
				throw new Error("The argument at " + i + " is not an optimizer function.");

			this.optimizers.push(arguments[i]);
		}
	},

	run: function(astNode) {
		this.errors = [];

		this.writer.writeNode(astNode);

		return this.writer.toString();
	}
});

module.exports = jsc.Generator;