#!/usr/bin/env node
"use module"
/** module .test/flow.js
* test for the control flow commands
*/
import tape from "tape"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

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
	const fixtureError= new Error("fixture-error")
	pipe.throw( fixtureError)
	const end= pipe.next()
	t.deepEqual( await end, { value: null, done: true}, "got done")
	t.end()
})
tape( "abort", async function( t){
	process.on("uncaughtException", console.error)
	process.on("unhandledRejection", console.error)

	t.plan( 1)
	const pipe= new Pipe()
	pipe.abort()
	console.log("")
	let end,
	  end2
	try{
		console.log("hi")
		end= pipe.next()
		console.log("h2")
		end2= await end
		console.log("++went")
	}catch(ex){
		console.log("++didnt")
	}
	console.log("HI", end, end2)
	//t.deepEqual( await end, { value: null, done: true}, "got done")
	t.end()
})
tape( "drain", async function( t){
	t.end()
})
