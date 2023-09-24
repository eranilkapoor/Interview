/*
	What is callback?
	Callback is a function that passed as an argumnet into another function. which is invoked inside the outer function to complete some kind of routine or action.
*/

/* synchronous callback 

function greeting(name) {
  alert('Hello ' + name);
}

function processUserInput(callback) {
  var name = prompt('Please enter your name.');
  callback(name);
}

processUserInput(greeting);

*/

/*
	Callbacks are often used to continue code execution after an asynchronous operation has completed — these are called asynchronous callbacks. 
	A good example is the callback functions executed inside a .then() block chained onto the end of a promise after that promise fulfills or rejects. 
	This structure is used in many modern web APIs, such as fetch(). 
*/


fetch('https://jsonplaceholder.typicode.com/todos/1')
  .then(response => response.json())
  .then(json => console.log(json))


/*
What is callback hell?
	This is a big issue caused by coding with complex nested callbacks. 
	Here, each and every callback takes an argument that is a result of the previous callbacks. 
	In this manner, The code structure looks like a pyramid, making it difficult to read and maintain. 
	Also, if there is an error in one function, then all other functions get affected.
*/