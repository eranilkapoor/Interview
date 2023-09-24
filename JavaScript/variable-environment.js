/*
	Variable enviroment means where a variable can execute and has a scope of execution
*/

function two() {
	var isValid;
	console.log(isValid);
}

function one(){
	var isValid = true;
	console.log(isValid);
	two();
	console.log(isValid);
}

var isValid = false;
console.log(isValid);
one();