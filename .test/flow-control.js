#!/usr/bin/env node
"use module"
/** module .test/flow.js
* test for the control flow commands
*/
import tape from "tape"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

// base case, run all four control-flow operators: return/throw/abort/drain, then .next()
tape( "return", async function( t){
	t.plan( 1)
	const pipe= new Pipe()

	// end
	pipe.return()
	const end= pipe.next()
	t.deepEqual( await end, { value: undefined, done: true}, "got done")
	t.end()
})
tape( "throw", async function( t){
	t.plan( 2)
	const
	  pipe= new Pipe(),
	  fixtureError= new Error("fixture-error")
	try{
		await pipe.throw( fixtureError)
		t.fail( "should have thrown")
	}catch( ex){
		t.equal( ex, fixtureError, "threw fixture-error")
	}
	const isDone= await pipe.next()
	t.deepEqual( isDone, { done: true, value: undefined})
	t.end()
})
tape( "abort", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.abort()

	let next= await pipe.next()
	t.deepEqual( next, { done: true, value: undefined})
	t.end()
})
tape( "drain", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.drain()

	let next= await pipe.next()
	t.deepEqual( next, { done: true, value: undefined})
	t.end()
})

// test pushing to done pipes

// test next'ing done pipes
