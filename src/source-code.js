var jsc = require("./jsc");
require("./text");
require("./utils");

jsc.SourceCode = Object.define({
	initialize: function(source, url, beginLine, beginColumn, begin, end) {
		this.source = jsc.Utils.valueOrDefault(source, "");
		this.url = jsc.Utils.valueOrDefault(url, "");
		this.beginLine = Math.max(jsc.Utils.valueOrDefault(beginLine, 1), 1);
		this.beginColumn = Math.max(jsc.Utils.valueOrDefault(beginColumn, 1), 1);
		this.span = jsc.TextSpan.fromRange(
			jsc.Utils.valueOrDefault(begin, 0),
			jsc.Utils.valueOrDefault(end, this.source.length));

		this.buffer = new jsc.TextBuffer(this.source, jsc.TextBuffer.ENCODING.UTF16, this.span.begin, this.span.length);

		// immutable
		Object.freeze(this);
	},
	
	get begin() {
		return this.span.begin;
	},
	
	get end() {
		return this.span.end;
	},

	getString: function(begin, end) {
		begin = jsc.Utils.valueOrDefault(begin, 0);
		end = jsc.Utils.valueOrDefault(end, this.buffer.length);

		if(this.source.length === 0)
			return "";

		return this.buffer.getString(begin, end - begin);
	},

	toSourceCode: function(braceBegin, braceEnd, beginLine, beginColumn) {
		return new jsc.SourceCode(this.source, this.url, beginLine, beginColumn+1, braceBegin, braceEnd+1);
	},
	
	toString: function() {
		return this.getString();
	}
});

Object.extend(jsc.SourceCode, {
	FromRange: function(source, url, begin, end) {
		return new jsc.SourceCode(source, url, 1, 1, begin, end);
	}
});

module.exports = jsc.SourceCode