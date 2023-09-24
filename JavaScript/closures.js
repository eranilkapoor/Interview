/*
	A closure is a function having access to the parent scope, even after the parent function has closed.
*/


function displayName(name) { 
    const greeting = "Hello, " + name + " Welcome "; 
    const sayName = function() {
        console.log(greeting); 
    };
    return sayName; 
}

const sayMyName = displayName("Anil");
sayMyName();  // Hello, Anil Welcome