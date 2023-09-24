/*
	Call stack & Memory Heap is the main part of javascript engine to execute the code.
	Any variable, function or object created in the javascript code stored in memory heap e.g
*/

const a = 100; // Means allocate memory for a in memeory heap
const b = 'Anil'; // Means allocate memory for b in memory heap
const obj = { //Means allocate memory for b in memory heap
	firstName:"ANIL",
	lastName:"Kapoor"
}

function substract(c){
	return c - 2;
}

function calculate(a, b){
	let x = a + b;

	return substract(x);
}

debugger;

calculate(2,5);

/*
	Every executed function goes through a call stack, in First In Last Out or (LIFO) form for execute the whole code.
*/

