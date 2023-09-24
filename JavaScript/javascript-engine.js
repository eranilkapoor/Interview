/*
	1. JavaScript is a single treaded language.
	2. JavaScript is a interpreaded langauge initialy but its depends on implementation now javascript can be compile as well.
	3. JavaScript engine or ECMAScript engine interpret the javascript code into machine language like 0,1 format to understand the machine.
	4. There are multiple javaScript engine :-
		a. V8 
		b. Chakra
		c. SpiderMonkey
		d. JavaScript Core
	5. Very first created javascript engine is spidermonkey by brendan eich.

	JavaScript Engine Work Flow :-

	Javascript file -----> Parser ----> Abstract Syntax Tree (AST)------>Interpreter --------->Byte Code
	 																	---------->Profiler------>Compiler------->Optimzed Code
*/

/* Simple JavaScript Engine Program */

function jsengine(code){
	return code.split(/\s+/);
}

jsengine('var a = 5');

// Output [ 'var', 'a', '=', '5' ]

/*
	JavaScript Engine have 2 parts 
	1. Call Stack
	2. Memory Heap
*/