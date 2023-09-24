/*
	Scope chain is defined or bind the variable into their execution scopes	
*/

function printMyName(){
	var a = 10;
	return function getMyName(){
		var b = 20;

		return function myName() {
			var c = 30;
			return 'Anil Kapoor';
		}
	}
}

printMyName()()();


// leakage of global variable

function wired(){
	height = 50;
	return height;
}

wired(); // output is 50 

// Use of strict mode
'use strict';
function wired(){
	height = 50;
	return height;
}

wired(); // will give the error

var hayhay = function doodle(){
	return 'hayhay';
}
hayhay();// hayhay
doodle()// error