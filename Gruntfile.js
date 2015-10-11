module.exports = function(grunt) {
	require("time-grunt")(grunt);
	
	var pkg = grunt.file.readJSON("package.json");
	
	grunt.initConfig({
		pkg: pkg,
		dirs: {
			output: "build",
			output_temp: "build-temp",
			source: "src",
			tasks: "tasks",
			tests: "tests",
			docs: "docs"
		},
		
		jshint: {
			build: [
				"Gruntfile.js",
				"<%= dirs.tasks %>/*.js",
				"<%= dirs.source %>/*.js",
				"<%= nodeunit.tests %>/*.js"
			],
			options: {
				jshintrc: ".jshintrc",
				reporter: require("jshint-stylish")
			}
		},

		jsdoc : {
			build : {
				options: {
					destination: "<%= dirs.docs %>",
					configure: "./jsdoc.conf.json"
				}
			}
		},

		nodeunit: {
			tests: ["<%= dirs.tests %>/*.js"],
			options: {
				reporter: "nested"
			}
		},

		concat: {
			js: {
				src: "<%= dirs.source %>/*.js",
				dest: "<%= dirs.output_temp %>/<%= pkg.name %>.js"
			}
		},

		copy: {
			js: {
				src: "<%= dirs.output_temp %>/<%= pkg.name %>.js",
				dest: "<%= dirs.output %>/<%= pkg.name %>.js"
			}
		},

		clean: {
			build_output_temp: "<%= dirs.output_temp %>",
			build_output: ["<%= dirs.output %>/<%= pkg.name %>.js"]
		}
	});
	
	grunt.loadTasks("tasks");
	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks("grunt-contrib-nodeunit");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-contrib-concat");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-jsdoc");
	
	grunt.registerTask("build", "Build the source tree.", ["clean:build_output_temp", "jshint", "concat", "clean:build_output", "copy", "clean:build_output_temp"]);
	grunt.registerTask("build-clean", "Cleans the build output.", ["clean"]);
	
	grunt.registerTask("test", "Run the <%= pkg.name %> tests.", ["jshint", "nodeunit"]);
	grunt.registerTask("docs", "Generate the <%= pkg.name %> documentation.", ["jsdoc"]);
	
	grunt.registerTask("default", ["build"]);
}