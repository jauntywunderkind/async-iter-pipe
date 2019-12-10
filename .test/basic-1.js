#!/usr/bin/env node
"use module"

import tape from "tape"
import Immediate from "p-immediate"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

tape( "next then push", async function( t){
	t.plan( 1)
	const
	  pipe= new Pipe(),
	  v1= pipe.next()
	pipe.push( 10)
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")
	t.end()
})
tape( "next then push, x2", async function( t){
	t.plan( 2)
	const pipe= new Pipe()

	const v1= pipe.next()
	pipe.push( 10)
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")

	const v2= pipe.next()
	pipe.push( 20)
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")
	t.end()
})
tape( "next x2 then push x2", async function( t){
	t.plan( 2)
	const
	  pipe= new Pipe(),
	  v1= pipe.next(),
	  v2= pipe.next()
	pipe.push( 10)
	pipe.push( 20)
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")
	t.end()

})

tape( "push then next", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.push( 20)
	const v1= pipe.next()
	t.deepEqual( await v1, { value: 20, done: false}, "gets 20")
	t.end()
})
tape( "push then next, x2", async function( t){
	t.plan( 2)
	const pipe= new Pipe()

	pipe.push( 10)
	const v1= pipe.next()
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")

	pipe.push( 20)
	const v2= pipe.next()
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")

	t.end()
})
tape( "push x2 the nnext x2", async function( t){
	t.plan( 2)
	const pipe= new Pipe()
	pipe.push( 10)
	pipe.push( 20)
	const
	  v1= pipe.next(),
	  v2= pipe.next()
	t.deepEqual( await v1, { value: 10, done: false}, "gets 10")
	t.deepEqual( await v2, { value: 20, done: false}, "gets 20")
	t.end()
})

// so headsup none of the above tests have finished!
tape( "return", async function( t){
	t.plan( 1)
	const pipe= new Pipe()

	// end
	pipe.return()
	const end= pipe.next()
	t.deepEqual( await end, { value: null, done: true}, "got done")
	t.end()
})
tape( "throw", async function( t){
	t.plan( 1)
	const pipe= new Pipe()

	// end
	pipe.return()
	const end= pipe.next()
	t.deepEqual( await end, { value: null, done: true}, "got done")
	t.end()
})
tape( "throw", async function( t){
	t.plan( 1)
	const pipe= new Pipe()

	// end
	pipe.return()
	const end= pipe.next()
	t.deepEqual( await end, { value: null, done: true}, "got done")
	t.end()
})

//tape( "push then consume", async function( t){
//	t.plan( 3)
//	const aip= new Pipe()
//	aip.push( 111)
//	aip.push( 222)
//
//	const
//	  next1= aip.next(),
//	  next2= aip.next()
//
//	console.log( next1, "n1")
//
//	t.equal( (await next1).value, 111, "value 111 was eventually pushd")
//	t.equal( (await next2).value, 222, "value 222 was eventually pushd")
//
//	const 
//		//aip.end()
//	  next3= aip.next()
//	console.log( next3)
//
//	// TODO: sleep, validate 3 not resolved
//	t.end()
//})
//
//tape( "consume then push", async function( t){
//	t.plan( 7)
//	const aip= new Pipe()
//	let i= 0
//	aip.next().then( cur=> {
//		t.equal( cur.value, 111, "pushd first value, 111")
//		t.equal( i++, 0, "pushd first value")
//	})
//	aip.next().then( cur=> {
//		t.equal( i++, 1, "pushd second value, 222")
//		t.equal( cur.value, 222, "pushd second value")
//	})
//	await Immediate()
//	t.equal( i, 0, "saw nothing")
//
//	aip.push( 111)
//	await Immediate()
//	t.equal( i, 1, "saw first value")
//
//	aip.push( 222)
//	await Immediate()
//	t.equal( i, 2, "saw second value")
//	t.end()
//})
//
//tape( "consume then end", async function( t){
//	t.plan( 6)
//	const aip= new Pipe()
//	aip.push( 111)
//	let next111= aip.next() // consume, successfully
//	let next222= aip.next() // consume, successfully
//	aip.push( 222)
//	aip.return( 42) // end
//	let nextReturned= aip.next() // consume, but had ended
//
//	next111= await next111
//	t.equal( next111.value, 111, "got first value")
//	t.equal( next111.done, false, "first was not done")
//
//	next222= await next222
//	t.equal( next222.value, 222, "got first value")
//	t.equal( next222.done, false, "first was not done")
//
//	nextReturned= await nextReturned
//	t.equal( nextReturned.value, 42, "got return value")
//	t.equal( nextReturned.done, true, "second was done")
//	t.end()
//})
//
//tape( "return then consume fails", async function( t){
//	t.plan( 4)
//	const aip= new Pipe()
//	aip.push( 111) // gets dropped by return
//	t.equal( aip.queueCount, 1, "one write queued")
//
//
//	aip.return( 42) // end
//	t.equal( aip.queueCount, 0, "queued write dropped")
//	let nextReturned= aip.next() // going to fail
//	nextReturned= await nextReturned
//	t.equal( nextReturned.value, 42, "got return value")
//	t.equal( nextReturned.done, true, "second was done")
//	t.end()
//})
//
//tape( "return then push fails", async function( t){
//	t.plan( 5)
//	const aip= new Pipe()
//	let nextReturned= aip.next()
//	t.equal( aip.queueCount, -1, "queued read")
//	aip.return( 42) // end
//	t.equal( aip.queueCount, 0, "dropped queued read")
//
//	aip.push( 43)
//
//	try{
//		aip.push( 44)
//		t.fail( "unexpected success of push")
//	}catch( ex){
//		t.ok( ex instanceof PipeAbortError, "got expected PipeAbortError from push")
//		t.equal( aip.queueCount, 0, "push did not change queueCount")
//	}
//
//	nextReturned.then( function( done){
//		console.log( "DONE", { done})
//		t.equal( done.done, true, "got done")
//		t.end()
//	})
//})
//
//tape( "pushAfterReturn", async function( t){
//	t.plan( 4)
//	const aip= new Pipe({ pushAfterReturn: true})
//	let
//	  next1= aip.next(),
//	  return1= aip.return( 42)
//	aip.push( 111)
//
//	next1= await next1
//	t.equal( next1.value, 111, "got 111")
//	t.equal( next1.done, false, "was not done")
//
//	return1= await return1
//	t.equal( return1.value, 42, "return value")
//	t.equal( return1.done, true, "return done")
//	t.end()
//})
//
//tape( "count", async function( t){
//	t.plan( 2)
//	const aip= new Pipe()
//	let
//	  read1= aip.next(),
//	  read2= aip.next()
//	t.equal( aip.queueCount, -2, "has two outstanding read requests")
//	aip.push( 1)
//	aip.push( 2)
//	aip.push( 3)
//	aip.push( 4)
//	t.equal( aip.queueCount, 2, "has two queued writes")
//	t.end()
//})
