var utils = require("./utils");
var text = require("./text");
var jsc = jsc || {};

jsc.SourceCode = function(text, url, startLine, startIndex, endIndex) {
	this.text = utils.valueOrDefault(text, "");
	this.url = url;
	this.startLine = Math.max(utils.valueOrDefault(startIndex, 1), 1);
	this.span = new text.TextSpan(0, this.text.length);

	if(!utils.isNull(startIndex) && !utils.isNull(endIndex))
	{
		this.span = text.TextSpan.fromRange(
			utils.valueOrDefault(startIndex, 0), utils.valueOrDefault(endIndex, 0));
	}
	
	this.buffer = new text.TextBuffer(this.text, text.TextBuffer.ENCODING.UTF16, this.span.begin, this.span.length);

	// immutable
	Object.freeze(this);
}

jsc.SourceCode.prototype = {
	get offsetBegin() {
		return this.span.begin;
	},
	
	get offsetEnd() {
		return this.span.end;
	}
}