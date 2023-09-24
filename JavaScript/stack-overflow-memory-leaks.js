/*
	Stack overflow : when we execute the code which have implementation in such a way that call stack goes over the max limit.
	its called stack overflow
*/

function x(){
	x();
}
x(); //Uncaught RangeError: Maximum call stack size exceeded 

// Above code is the example of stack overflow;


/*
	Memory leaks :-
*/

let a = [];

for (let i = 5; i > 1; i++){
	a.push(i - 1);
}

// out will be memory leak browser will crash

/*
 	Reason of memory leaks 
	1. Global Variables
	2. Event listeners
	3. use of setinterval
	4. 
*/