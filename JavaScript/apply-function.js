const a = {
	name: 'Anil Kapoor',
	display (){
		console.log(this.name);
	}
}
a.display();
a.display.apply();

const b = {
	name: 'Sunita Kapoor'
}

a.display.apply(b);

// 

const array = [1,2,3];

// in this case, the 'this' keyword doesn't matter!
function getMaxNumber(arr){
  return Math.max.apply(null, arr);  
}

getMaxNumber(array);

function getMinNumber(arr){
  return Math.min.apply(null, arr);  
}

getMinNumber(array)