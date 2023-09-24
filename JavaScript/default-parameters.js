/*
	Default parameter is used to pass default value of already exist parameters.
*/

function f (x, y = 7, z = 42) {
    return x + y + z
}
f(1) === 50