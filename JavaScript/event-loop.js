/*
	What is event loop?
	The event loop is a constantly running process that monitors both the callback queue and the call stack.
	There are 3 part of the event loop 1.) Call Stack 2.) Calback Queue 3.) Heap

	JavaScript single-threaded model : JavaScript is a single-threaded programming language. In other words, it can do only one thing at a time.
	JavaScript engine executes a script from the top and works its way down creating execution contexts and pushing and popping functions onto and off the call stack.
*/

/*
function task(message) {
    // emulate time consuming task
    let n = 10000;
    while (n > 0){
        n--;
    }
    console.log(message);
}
*/

/*
console.log('Start script...');
task('Download a file.');
console.log('Done!');
*/

/*
console.log('Start script...');

setTimeout(() => {
    task('Download a file.');
}, 1000);

console.log('Done!');
*/
function callACallback(callback){
	if(typeof callback == "function"){
		callback(console.log("By callback"));
	} else {
		console.log("Failed");
	}
}

console.log('Start script...');
callACallback(function(){
	console.log('After callback');
});
console.log('Done!');