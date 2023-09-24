var intArray = [4,2,1,5,7,8];
function quickSort(start, end){
	if(end - start <= 0){
		return;
	} else {
		var pivot = intArray[end];
      	var partitionPoint = partition(start, end, pivot);
      	quickSort(start, partitionPoint-1);
      	quickSort(partitionPoint+1, end);
	}
}


function partition(start, end, pivot) {
   	var leftPointer 	= start - 1;
   	var rightPointer 	= end;

   	while(true) {
      	while(intArray[++leftPointer] < pivot) {
        	//do nothing
      	}
		
      	while(rightPointer > 0 && intArray[--rightPointer] > pivot) {
        	//do nothing
      	}

      	if(leftPointer >= rightPointer) {
        	break;
      	} else {
         	var temp 				= intArray[leftPointer];
         	intArray[leftPointer] 	= intArray[rightPointer];
         	intArray[rightPointer] 	= temp;

      	}
   	}
	
   	var temp 				= intArray[leftPointer];
	intArray[leftPointer] 	= intArray[right];
	intArray[right] 		= temp;

   	return leftPointer;
}
