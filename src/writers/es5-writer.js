var jsc = require("./../jsc");

/** @namespace */
jsc.Writers = jsc.Writers || {};


/**
 * An ECMAScript 5.1 AST writer. This will transform unsupported AST nodes to be
 * compatible with ECMAScript 5.1.
 *
 * @class
 */
jsc.Writers.ES5Writer = Object.define(jsc.Writers.Writer, {
	initialize: function($super, options) {
		$super(options || jsc.Writers.ES5Writer.Options.Default);
	}
});



/**
 * The ES5 writer options.
 *
 * @class
 */
jsc.Writers.ES5Writer.Options = Object.define(jsc.Writers.Writer.Options, {
	initialize: function($super, tabSize, newLineStyle) {
		$super(tabSize, newLineStyle);
	}
});

Object.extend(jsc.Writers.ES5Writer.Options, {
	get Default() {
		return new jsc.Writers.ES5Writer.Options();
	}
});


module.exports = jsc.Writers.ES5Writer;