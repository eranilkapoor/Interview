/*
What is promises in javascript?
	A promise is an object that may produce a single value some time in the future: either a resolved value, or a reason that it’s not resolved (e.g., a network error occurred). 
	A promise may be in one of 3 possible states: fulfilled, rejected, or pending. Promise users can attach callbacks to handle the fulfilled value or the reason for rejection.

	Promises are eager, meaning that a promise will start doing whatever task you give it as soon as the promise constructor is invoked. Promise is immuatable means after calling the promise we can not change it.

	Promise Chaining

	Error Handling

*/

const wait = time => new Promise((resolve) => setTimeout(resolve, time));

wait(3000).then(() => console.log('Hello!'));

var promise = new Promise(function(resolve, reject) { 
  	const x = "geeksforgeeks"; 
  	const y = "geeksforgeeks1"
  	if(x === y) { 
    	resolve(); 
  	} else { 
    	reject(); 
  	} 
}); 
  
promise. 
    then(function () { 
        console.log('Success, You are a GEEK'); 
    }). 
    catch(function () { 
        console.log('Some error has occured'); 
    }).
    finally(function(){
    	console.log("After promise settled");
    }); 