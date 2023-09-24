/*
	JavaScript Runtime means how javascript will execute
*/

console.log('A');
setTimeout(function(){
	console.log('B');
}, 1000);
console.log('C');
//output is 
// A
// C
// B 
//Same result will come if we decrese the time

console.log('A');
setTimeout(function(){
	console.log('B');
}, 0);
console.log('C');
//output is 
// A
// C
// B

// Asynchronous exexcution 
/*
	1. Call stack
	2. Memory Heap
	3. Web Api
	4. Event loop
	5. Callback Queue
*/