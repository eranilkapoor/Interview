/*
	Calling any function or execution is called function invocation
*/

function india(){
	console.log("Delhi")
}
var country = function(){
	console.log("India");
}
country();
india();
// Every function have this keyword and arguments object by default