var utils = require("./utils");
var text = require("./text");

jsc.SourceCode = function(source, url, startLine, startIndex, endIndex) {
	this.source = utils.valueOrDefault(source, "");
	this.url = url;
	this.startLine = Math.max(utils.valueOrDefault(startIndex, 1), 1);
	this.span = new text.TextSpan(0, this.source.length);

	if(!utils.isNull(startIndex) && !utils.isNull(endIndex))
	{
		this.span = text.TextSpan.fromRange(
			utils.valueOrDefault(startIndex, 0), utils.valueOrDefault(endIndex, 0));
	}
	
	this.buffer = new text.TextBuffer(this.source, text.TextBuffer.ENCODING.UTF16, this.span.begin, this.span.length);

	// immutable
	Object.freeze(this);
}

jsc.SourceCode.prototype = {
	get offsetBegin() {
		return this.span.begin;
	},
	
	get offsetEnd() {
		return this.span.end;
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
}

module.exports = {
	SourceCode: jsc.SourceCode
};