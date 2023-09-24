const a = function () {
	console.log('a', this);
	const b = function () {
		console.log('b', this);
		const c = {
			hi: function(){
				console.log('c', this);
			}
		}
		c.hi();
	}
	b()
}
a();

// 

const a = {
	name: 'Anil Kapoor',
	sing(){
		console.log('a', this);
		var another = function (){
			console.log('b', this);
		}
		another();
	}
}
a.sing();

// solution for it is 

const a = {
	name: 'Anil Kapoor',
	sing(){
		console.log('a', this);
		var another = () =>{
			console.log('b', this);
		}
		another();
	}
}
a.sing();


// another one is 

const a = {
	name: 'Anil Kapoor',
	sing(){
		console.log('a', this);
		var another = function (){
			console.log('b', this);
		}
		return another.bind(this);
	}
}
a.sing()();

// another is 
const a = {
	name: 'Anil Kapoor',
	sing(){
		var self = this;
		console.log('a', this);
		var another = function (){
			console.log('b', self);
		}
		return another;
	}
}
a.sing()();