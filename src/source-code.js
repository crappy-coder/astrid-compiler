var jsc = require("./jsc");
require("./text");
require("./utils");

jsc.SourceCode = Object.define({
	initialize: function(source, url, startLine, startIndex, endIndex) {
		this.source = jsc.Utils.valueOrDefault(source, "");
		this.url = url;
		this.startLine = Math.max(jsc.Utils.valueOrDefault(startIndex, 1), 1);
		this.span = new jsc.TextSpan(0, this.source.length);

		if(!jsc.Utils.isNull(startIndex) && !jsc.Utils.isNull(endIndex))
		{
			this.span = jsc.TextSpan.fromRange(
				jsc.Utils.valueOrDefault(startIndex, 0), jsc.Utils.valueOrDefault(endIndex, 0));
		}
		
		this.buffer = new jsc.TextBuffer(this.source, jsc.TextBuffer.ENCODING.UTF16, this.span.begin, this.span.length);

		// immutable
		Object.freeze(this);
	},
	
	get offsetBegin() {
		return this.span.begin;
	},
	
	get offsetEnd() {
		return this.span.end;
	},

	toSourceCode: function(braceBegin, braceEnd, beginLine) {
		return new jsc.SourceCode(this.source, this.url, beginLine, braceBegin, braceEnd+1);
	},
	
	toString: function() {
		var begin = 0;
		var end = this.buffer.length;
		
		if(arguments.length === 2)
		{
			begin = arguments[0];
			end = arguments[1];
		}
		
		if(this.source.length === 0)
			return "";

		return this.buffer.toString(begin, end - begin);
	}
});

module.exports = jsc.SourceCode